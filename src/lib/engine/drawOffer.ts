import type { PieceColor } from '../../types/chess';
import { analyse } from './stockfish';

// Máy nhận hòa khi nó không hơn quá nửa Tốt: thế cờ cân bằng thì hòa là hợp lý, còn
// đang thua thì càng nên nhận. Đang hơn rõ thì từ chối — giống người chơi thật.
const ACCEPT_MAX_ADVANTAGE_CP = 50;
// Trong khai cuộc (15 nước đầu) thế cờ gần như luôn cân bằng, nên nếu chỉ xét điểm thì
// máy sẽ nhận hòa ngay nước thứ nhất. Giai đoạn này chỉ nhận khi máy đang kém rõ rệt.
const OPENING_PLIES = 30;
const OPENING_ACCEPT_MAX_ADVANTAGE_CP = -150;
const DRAW_EVAL_MOVETIME_MS = 300;

// Đánh giá bằng engine ở mức mạnh nhất (không giới hạn Elo): quyết định nhận hòa cần
// biết thế cờ thật sự ra sao, không phải theo con mắt của một máy bị hạ sức.
export async function engineAcceptsDraw(fen: string, aiColor: PieceColor, plyCount: number): Promise<boolean> {
    const { lines } = await analyse({ fen, movetimeMs: DRAW_EVAL_MOVETIME_MS });
    const best = lines[0];
    if (!best) return true;

    // Điểm của engine theo góc nhìn bên đang tới lượt — quy về góc nhìn của máy.
    const sideToMove = fen.split(' ')[1] as PieceColor;
    const aiScore = sideToMove === aiColor ? best.scoreCp : -best.scoreCp;
    const threshold = plyCount < OPENING_PLIES ? OPENING_ACCEPT_MAX_ADVANTAGE_CP : ACCEPT_MAX_ADVANTAGE_CP;
    return aiScore <= threshold;
}
