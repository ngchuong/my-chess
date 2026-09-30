import { Chess } from 'chess.js';
import { REVIEW_DEPTH } from './engine/difficulty';
import { MATE_SCORE_CP, analyse, parseUciMove } from './engine/stockfish';
import type { MoveAnalysis, MoveQuality, MoveRecord } from '../types/analysis';

// Chấm theo cơ hội thắng thay vì centipawn thô, giống cách lichess/chess.com làm: mất
// 100cp khi thế cờ cân bằng là sai lầm thật, nhưng mất 100cp khi đang hơn cả con Xe thì
// gần như không đổi kết quả ván. Hệ số là đường cong lichess khớp từ dữ liệu ván thật.
const WIN_CHANCE_SLOPE = 0.00368208;

function winChance(scoreCp: number): number {
    return 100 / (1 + Math.exp(-WIN_CHANCE_SLOPE * scoreCp));
}

// Ngưỡng (theo % cơ hội thắng bị mất) tương tự thang "expected points" của chess.com.
const EXCELLENT_MAX_LOSS = 2;
const GOOD_MAX_LOSS = 5;
const INACCURACY_MAX_LOSS = 10;
const MISTAKE_MAX_LOSS = 20;

function classify(isBestMove: boolean, winChanceLoss: number): MoveQuality {
    // "Tốt nhất" chỉ dành cho đúng nước engine chọn, không suy ra từ độ lệch điểm — hai
    // lượt tìm kiếm độc lập luôn lệch nhau vài centipawn nên so điểm sẽ thưởng nhầm.
    if (isBestMove) return 'best';
    if (winChanceLoss <= EXCELLENT_MAX_LOSS) return 'excellent';
    if (winChanceLoss <= GOOD_MAX_LOSS) return 'good';
    if (winChanceLoss <= INACCURACY_MAX_LOSS) return 'inaccuracy';
    if (winChanceLoss <= MISTAKE_MAX_LOSS) return 'mistake';
    return 'blunder';
}

function uciOf(record: MoveRecord): string {
    return `${record.from}${record.to}${record.promotion ?? ''}`;
}

// Vị trí đã hết nước đi thì engine không trả về điểm nào — tự xác định lấy.
function terminalScore(fen: string): number {
    // Bên tới lượt bị chiếu hết = thua; còn lại (hết nước đi, lặp vị trí, 50 nước...) là hòa.
    return new Chess(fen).isCheckmate() ? -MATE_SCORE_CP : 0;
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

// Chấm điểm cả ván đấu, báo kết quả từng nước ngay khi tính xong (thay vì đợi xong hết
// rồi trả một lần) để danh sách nước đi lên dần thay vì hiện cùng lúc.
//
// Mỗi *vị trí* chỉ phải phân tích đúng một lần, không phải mỗi nước hai lần: điểm của
// vị trí sau nước thứ i cũng chính là điểm của vị trí trước nước thứ i+1. Ván N nước
// vì thế chỉ tốn N+1 lượt tìm kiếm.
export async function analyzeGame(
    history: readonly MoveRecord[],
    onProgress: (index: number, result: MoveAnalysis) => void,
    shouldContinue: () => boolean,
): Promise<void> {
    if (history.length === 0) return;

    const positions = [history[0].fenBefore, ...history.map((record) => record.fenAfter)];
    let previous: { scoreCp: number; bestMove: string | null } | null = null;

    for (const [index, fen] of positions.entries()) {
        if (!shouldContinue()) return;

        const analysis = await analyse({ fen, depth: REVIEW_DEPTH, freshGame: index === 0 });
        if (!shouldContinue()) return;

        const scoreCp = analysis.lines[0]?.scoreCp ?? terminalScore(fen);

        if (previous) {
            const record = history[index - 1];
            // `previous.scoreCp` tính theo góc nhìn bên vừa đi, `scoreCp` theo góc nhìn
            // đối thủ (giờ mới tới lượt họ). Cộng lại chính là phần lợi thế bị đánh rơi:
            // nước hoàn hảo cho tổng bằng 0, thả con Hậu cho tổng khoảng +900.
            const centipawnLoss = Math.max(0, previous.scoreCp + scoreCp);
            const winChanceLoss = Math.max(0, winChance(previous.scoreCp) - winChance(-scoreCp));

            onProgress(index - 1, {
                ...record,
                quality: classify(uciOf(record) === previous.bestMove, winChanceLoss),
                centipawnLoss,
                winChanceLoss,
                bestSan: sanOf(record.fenBefore, previous.bestMove) ?? record.san,
            });
        }

        previous = { scoreCp, bestMove: analysis.bestMove };
    }
}
