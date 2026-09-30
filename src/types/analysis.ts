import type { LastMove } from './chess';

// Thứ tự từ tốt nhất tới tệ nhất — giao diện dựa vào thứ tự này để hiển thị.
export const MOVE_QUALITIES = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'] as const;

export type MoveQuality = (typeof MOVE_QUALITIES)[number];

// Một nước đi đã thực hiện trong ván, kèm FEN trước/sau để có thể dựng lại vị trí
// ở bất kỳ nước nào khi xem lại, và để worker phân tích tính điểm mà không cần
// phát lại toàn bộ ván từ đầu.
export interface MoveRecord extends LastMove {
    moveNumber: number;
    fenBefore: string;
    fenAfter: string;
}

export interface MoveAnalysis extends MoveRecord {
    quality: MoveQuality;
    // Số centipawn (1/100 tốt) thiệt hại so với nước đi tốt nhất theo engine, luôn >= 0.
    centipawnLoss: number;
    // Phần trăm cơ hội thắng bị đánh rơi (0–100) — thước đo dùng để xếp loại nước đi.
    winChanceLoss: number;
    bestSan: string;
}
