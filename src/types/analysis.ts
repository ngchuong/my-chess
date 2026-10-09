import type { LastMove } from './chess';

// Thứ tự từ tốt nhất tới tệ nhất — giao diện dựa vào thứ tự này để hiển thị.
// Thang chấm giống chess.com: "brilliant" (!!) là nước thí quân đúng, "great" (!) là
// nước gần như duy nhất giữ được thế cờ, "miss" là bỏ lỡ cơ hội đối thủ vừa trao cho.
export const MOVE_QUALITIES = [
    'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'miss', 'blunder',
] as const;

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
    // Đánh giá thế cờ sau nước này theo góc nhìn bên Trắng (centipawn), và số nước tới
    // chiếu hết nếu có (dương = Trắng chiếu hết) — để hiển thị thanh/nhãn đánh giá.
    evalCp: number;
    evalMate: number | null;
}
