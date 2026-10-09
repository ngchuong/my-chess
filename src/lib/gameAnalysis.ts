import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { REVIEW_DEPTH, REVIEW_MULTIPV } from './engine/difficulty';
import { MATE_SCORE_CP, analyse, parseUciMove, type AnalysisResult } from './engine/stockfish';
import { PIECE_VALUES, isEnPrise } from './moveHint';
import type { MoveAnalysis, MoveQuality, MoveRecord } from '../types/analysis';

// Chấm theo cơ hội thắng thay vì centipawn thô, giống cách lichess/chess.com làm: mất
// 100cp khi thế cờ cân bằng là sai lầm thật, nhưng mất 100cp khi đang hơn cả con Xe thì
// gần như không đổi kết quả ván. Hệ số là đường cong lichess khớp từ dữ liệu ván thật.
const WIN_CHANCE_SLOPE = 0.00368208;

export function winChance(scoreCp: number): number {
    return 100 / (1 + Math.exp(-WIN_CHANCE_SLOPE * scoreCp));
}

// Ngưỡng (theo % cơ hội thắng bị mất) tương tự thang "expected points" của chess.com.
const EXCELLENT_MAX_LOSS = 2;
const GOOD_MAX_LOSS = 5;
const INACCURACY_MAX_LOSS = 10;
const MISTAKE_MAX_LOSS = 20;

// Tuyệt vời (!): nước tốt nhất, và phương án tốt nhì kém hơn ít nhất chừng này % cơ hội
// thắng — tức là gần như chỉ có nước này giữ được thế cờ.
const GREAT_MIN_GAP = 10;

// Thiên tài (!!): thí quân (bỏ lại ít nhất ~2 Tốt giá trị cho đối phương ăn) mà vẫn là
// nước tốt nhất/gần tốt nhất, sau nước đó không bị kém thế, và trước đó chưa thắng chắc
// (đang thắng áp đảo thì thí quân không còn là gì đặc biệt).
const SACRIFICE_MIN_CP = 200;
const BRILLIANT_MIN_WIN_AFTER = 50;
const BRILLIANT_MAX_WIN_BEFORE = 95;

// Bỏ lỡ: đối thủ vừa đi sai trao cho bạn thế thắng (ít nhất chừng này % cơ hội thắng),
// nhưng nước của bạn đánh rơi cơ hội đó.
const MISS_MIN_WIN_BEFORE = 60;
const OPPONENT_ERRORS: ReadonlySet<MoveQuality> = new Set(['mistake', 'blunder', 'miss']);

// Độ chính xác (0–100) của một nước theo cơ hội thắng bị mất — công thức của lichess.
export function moveAccuracy(winChanceLoss: number): number {
    const raw = 103.1668 * Math.exp(-0.04354 * winChanceLoss) - 3.1669;
    return Math.min(Math.max(raw, 0), 100);
}

function classifyByLoss(winChanceLoss: number): MoveQuality {
    if (winChanceLoss <= EXCELLENT_MAX_LOSS) return 'excellent';
    if (winChanceLoss <= GOOD_MAX_LOSS) return 'good';
    if (winChanceLoss <= INACCURACY_MAX_LOSS) return 'inaccuracy';
    if (winChanceLoss <= MISTAKE_MAX_LOSS) return 'mistake';
    return 'blunder';
}

function uciOf(record: MoveRecord): string {
    return `${record.from}${record.to}${record.promotion ?? ''}`;
}

function sanOf(fen: string, uci: string | null): string | null {
    if (!uci) return null;

    const game = new Chess(fen);
    try {
        return game.move(parseUciMove(uci)).san;
    } catch {
        return null;
    }
}

// Đánh giá một vị trí, theo góc nhìn bên đang tới lượt.
interface PositionEval {
    bestMove: string | null;
    // Điểm của từng phương án engine xét, theo thứ tự tốt dần giảm.
    lines: { move: string; scoreCp: number }[];
    scoreCp: number;
    mateIn: number | null;
}

function toPositionEval(fen: string, result: AnalysisResult): PositionEval {
    const lines = result.lines
        .filter((line) => line.moves.length > 0)
        .map((line) => ({ move: line.moves[0], scoreCp: line.scoreCp }));
    const best = result.lines[0];
    if (best) return { bestMove: result.bestMove, lines, scoreCp: best.scoreCp, mateIn: best.mateIn };

    // Vị trí đã hết nước đi thì engine không trả về điểm nào — tự xác định lấy: bên tới
    // lượt bị chiếu hết = thua; còn lại (hết nước đi, lặp vị trí, 50 nước...) là hòa.
    const isCheckmate = new Chess(fen).isCheckmate();
    return { bestMove: null, lines: [], scoreCp: isCheckmate ? -MATE_SCORE_CP : 0, mateIn: null };
}

// Nước đi có bỏ lại quân cho đối phương ăn không: chính quân vừa đi đứng ở ô bị ăn mà
// không được bù đủ, hoặc một quân khác vốn an toàn nay thành quân treo (ví dụ rời bỏ
// vị trí bảo vệ nó). Xấp xỉ bằng "quân treo" như phần gợi ý nước đi — đủ để nhận ra
// các pha thí quân rõ ràng, không cố bắt mọi trường hợp tinh vi.
function isSacrifice(record: MoveRecord): boolean {
    const before = new Chess(record.fenBefore);
    const after = new Chess(record.fenAfter);
    const capturedValue = record.captured ? PIECE_VALUES[record.captured] : 0;

    const offersPiece = (square: Square, type: PieceSymbol): boolean => {
        if (type === 'p' || type === 'k' || !isEnPrise(after, square)) return false;
        if (square === record.to) return PIECE_VALUES[type] - capturedValue >= SACRIFICE_MIN_CP;
        return !isEnPrise(before, square) && PIECE_VALUES[type] >= SACRIFICE_MIN_CP;
    };

    return after.board().some((row) => row.some((cell) =>
        cell !== null && cell.color === record.color && offersPiece(cell.square, cell.type)));
}

// Điểm của nước đã đi, theo góc nhìn người đi. Ưu tiên lấy từ chính lượt tìm kiếm của
// vị trí trước (cùng lượt với nước tốt nhất nên so sánh không bị nhiễu). Không có trong
// các phương án đó thì dùng điểm vị trí sau — nhưng không thể tốt hơn phương án cuối
// engine đã xét, vì engine đã xếp những phương án đó là tốt nhất.
function playedScoreOf(uci: string, before: PositionEval, after: PositionEval): number {
    if (uci === before.bestMove) return before.scoreCp;

    const matchingLine = before.lines.find((line) => line.move === uci);
    if (matchingLine) return matchingLine.scoreCp;

    const worstListed = before.lines.at(-1);
    const fromAfter = -after.scoreCp;
    return before.lines.length >= REVIEW_MULTIPV && worstListed ? Math.min(fromAfter, worstListed.scoreCp) : fromAfter;
}

interface MoveContext {
    record: MoveRecord;
    before: PositionEval;
    after: PositionEval;
    previousRecord: MoveRecord | undefined;
    previousQuality: MoveQuality | undefined;
}

// Nước tốt/gần tốt nhất có thể được nâng lên Thiên tài (thí quân) hoặc Tuyệt vời (gần
// như nước duy nhất). Nước chiếu hết thì giữ nguyên — kết thúc ván là đủ rõ rồi.
function upgradeGoodMove({ record, before, previousRecord }: MoveContext, isBest: boolean, winBefore: number, winAfter: number): MoveQuality | null {
    if (record.san.endsWith('#')) return null;

    if (isSacrifice(record) && winAfter >= BRILLIANT_MIN_WIN_AFTER && winBefore <= BRILLIANT_MAX_WIN_BEFORE) {
        return 'brilliant';
    }

    // Ăn lại quân vừa bị ăn thường là nước bắt buộc hiển nhiên, không đáng gọi là Tuyệt vời.
    const isRecapture = previousRecord?.captured !== undefined && previousRecord.to === record.to;
    const [bestLine, runnerUp] = before.lines;
    if (isBest && !isRecapture && bestLine && runnerUp
        && winChance(bestLine.scoreCp) - winChance(runnerUp.scoreCp) >= GREAT_MIN_GAP) {
        return 'great';
    }

    return null;
}

function judgeMove(context: MoveContext): MoveAnalysis {
    const { record, before, after, previousQuality } = context;
    const uci = uciOf(record);
    const isBest = uci === before.bestMove;
    const playedScore = playedScoreOf(uci, before, after);

    const winBefore = winChance(before.scoreCp);
    const winAfter = winChance(playedScore);
    const winChanceLoss = Math.max(0, winBefore - winAfter);

    let quality: MoveQuality = isBest ? 'best' : classifyByLoss(winChanceLoss);
    if (winChanceLoss <= EXCELLENT_MAX_LOSS) {
        quality = upgradeGoodMove(context, isBest, winBefore, winAfter) ?? quality;
    } else if (winChanceLoss > INACCURACY_MAX_LOSS && winBefore >= MISS_MIN_WIN_BEFORE
        && previousQuality !== undefined && OPPONENT_ERRORS.has(previousQuality)) {
        quality = 'miss';
    }

    // Đánh giá sau nước đi, quy về góc nhìn Trắng để hiển thị.
    const sign = record.color === 'w' ? 1 : -1;

    return {
        ...record,
        quality,
        centipawnLoss: Math.max(0, before.scoreCp - playedScore),
        winChanceLoss,
        bestSan: sanOf(record.fenBefore, before.bestMove) ?? record.san,
        evalCp: sign * playedScore,
        // `after` là góc nhìn đối thủ (bên tới lượt sau nước này) nên đổi dấu ngược lại.
        evalMate: after.mateIn === null ? null : -sign * after.mateIn,
    };
}

// Chấm điểm cả ván đấu, báo kết quả từng nước ngay khi tính xong (thay vì đợi xong hết
// rồi trả một lần) để danh sách nước đi lên dần thay vì hiện cùng lúc.
//
// Mỗi *vị trí* chỉ phải phân tích đúng một lần, không phải mỗi nước hai lần: vị trí
// sau nước thứ i cũng chính là vị trí trước nước thứ i+1. Ván N nước vì thế chỉ tốn
// N+1 lượt tìm kiếm.
export async function analyzeGame(
    history: readonly MoveRecord[],
    onProgress: (index: number, result: MoveAnalysis) => void,
    shouldContinue: () => boolean,
): Promise<void> {
    if (history.length === 0) return;

    const positions = [history[0].fenBefore, ...history.map((record) => record.fenAfter)];
    let previous: PositionEval | null = null;
    let previousQuality: MoveQuality | undefined;

    for (const [index, fen] of positions.entries()) {
        if (!shouldContinue()) return;

        // Vị trí cuối không còn nước nào của ván để chấm, chỉ cần điểm — 1 phương án là đủ.
        const isLast = index === positions.length - 1;
        const result = await analyse({ fen, depth: REVIEW_DEPTH, multipv: isLast ? 1 : REVIEW_MULTIPV, freshGame: index === 0 });
        if (!shouldContinue()) return;

        const current = toPositionEval(fen, result);

        if (previous) {
            const analysis = judgeMove({
                record: history[index - 1],
                before: previous,
                after: current,
                previousRecord: history[index - 2],
                previousQuality,
            });
            previousQuality = analysis.quality;
            onProgress(index - 1, analysis);
        }

        previous = current;
    }
}
