import type { PieceSymbol, Square } from 'chess.js';

export type PieceColor = 'w' | 'b';

export interface LastMove {
    from: Square;
    to: Square;
    san: string;
    color: PieceColor;
    piece: PieceSymbol;
    captured?: PieceSymbol;
    promotion?: PieceSymbol;
    isCastle: boolean;
}

export interface Premove {
    from: Square;
    to: Square;
}

// Nước phong cấp đang chờ người chơi chọn quân (Hậu/Xe/Tượng/Mã) — xem PromotionModal.
export interface PendingPromotion {
    from: Square;
    to: Square;
    color: PieceColor;
}

export interface AIWorkerMove {
    from: string;
    to: string;
    promotion?: string;
    san: string;
    color: PieceColor;
}

// Một quân cờ được theo dõi xuyên suốt ván đấu bằng `id` cố định (gán từ ô xuất
// phát), phục vụ animation trượt mượt khi quân di chuyển giữa các ô.
export interface AnimatedPiece {
    id: string;
    type: PieceSymbol;
    color: PieceColor;
    square: Square;
    // Hiệu ứng tạm thời đang phát cho quân này (tự xoá sau khi animation xong).
    effect?: 'captured' | 'promoted';
}
