import type { LastMove } from './chess';

export type MoveQuality = 'excellent' | 'great' | 'normal' | 'bad';

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
    bestSan: string;
}

// Worker phân tích từng nước một và báo kết quả ngay khi xong (thay vì tính hết cả
// ván rồi mới gửi một lần), để danh sách nước đi lên dần thay vì đợi rồi hiện hết
// cùng lúc.
export type AnalysisProgressMessage =
    | { type: 'progress'; index: number; result: MoveAnalysis }
    | { type: 'done' };
