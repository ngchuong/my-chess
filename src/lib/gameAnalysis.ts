import { Chess } from 'chess.js';
import { REVIEW_DEPTH } from './engine/difficulty';
import { MATE_SCORE_CP, analyse, parseUciMove } from './engine/stockfish';
import type { MoveAnalysis, MoveRecord } from '../types/analysis';

const EXCELLENT_MAX_LOSS = 10;
const GREAT_MAX_LOSS = 40;
const NORMAL_MAX_LOSS = 120;

function classify(centipawnLoss: number): MoveAnalysis['quality'] {
    if (centipawnLoss <= EXCELLENT_MAX_LOSS) return 'excellent';
    if (centipawnLoss <= GREAT_MAX_LOSS) return 'great';
    if (centipawnLoss <= NORMAL_MAX_LOSS) return 'normal';
    return 'bad';
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

            onProgress(index - 1, {
                ...record,
                quality: classify(centipawnLoss),
                centipawnLoss,
                bestSan: sanOf(record.fenBefore, previous.bestMove) ?? record.san,
            });
        }

        previous = { scoreCp, bestMove: analysis.bestMove };
    }
}
