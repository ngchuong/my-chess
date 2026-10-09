import { Chess, type PieceSymbol } from 'chess.js';
import type { PieceColor } from '../types/chess';

const PIECE_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const STARTING_COUNTS: Record<Exclude<PieceSymbol, 'k'>, number> = { q: 1, r: 2, b: 2, n: 2, p: 8 };
// Quân giá trị cao đứng trước, giống cách chess.com/lichess xếp quân đã ăn.
const DISPLAY_ORDER = ['q', 'r', 'b', 'n', 'p'] as const;

export interface MaterialSummary {
    // Quân của đối phương mà mỗi bên đã ăn được, ví dụ `captured.w` là quân Đen Trắng đã ăn.
    captured: Record<PieceColor, PieceSymbol[]>;
    // Số điểm lực lượng bên đó hơn đối phương (0 nếu không hơn).
    advantage: Record<PieceColor, number>;
}

// Đọc từ bàn cờ thực tế thay vì đếm các nước ăn quân, nên tự đúng cả khi lùi nước
// hay tiếp tục ván đã lưu. Tốt đã phong cấp tính là "mất" một Tốt — số quân bị ăn có
// thể lệch một chút, nhưng điểm chênh lệch lực lượng (tính theo quân đang có) vẫn đúng.
export function getMaterialSummary(fen: string): MaterialSummary {
    const counts: Record<PieceColor, Record<PieceSymbol, number>> = {
        w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
        b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    };
    const points: Record<PieceColor, number> = { w: 0, b: 0 };

    for (const row of new Chess(fen).board()) {
        for (const cell of row) {
            if (!cell) continue;
            counts[cell.color][cell.type] += 1;
            points[cell.color] += PIECE_VALUES[cell.type];
        }
    }

    const capturedFrom = (victim: PieceColor): PieceSymbol[] =>
        DISPLAY_ORDER.flatMap((type) => {
            const missing = Math.max(STARTING_COUNTS[type] - counts[victim][type], 0);
            return new Array<PieceSymbol>(missing).fill(type);
        });

    return {
        captured: { w: capturedFrom('b'), b: capturedFrom('w') },
        advantage: { w: Math.max(points.w - points.b, 0), b: Math.max(points.b - points.w, 0) },
    };
}
