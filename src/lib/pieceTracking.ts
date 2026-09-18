import type { Move, PieceSymbol, Square } from 'chess.js';
import type { AnimatedPiece, PieceColor } from '../types/chess';

interface StartingPiece {
    square: Square;
    type: PieceSymbol;
    color: PieceColor;
}

const BACK_RANK: PieceSymbol[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function startingPosition(): StartingPiece[] {
    return FILES.flatMap((file, i) => [
        { square: `${file}1` as Square, type: BACK_RANK[i], color: 'w' },
        { square: `${file}2` as Square, type: 'p' as PieceSymbol, color: 'w' },
        { square: `${file}7` as Square, type: 'p' as PieceSymbol, color: 'b' },
        { square: `${file}8` as Square, type: BACK_RANK[i], color: 'b' },
    ]);
}

// Id gắn với ô xuất phát — chỉ dùng để nhận diện quân xuyên suốt ván đấu, không
// đại diện cho vị trí hiện tại (đọc từ trường `square`).
export function createInitialPieces(): AnimatedPiece[] {
    return startingPosition().map((p) => ({
        id: `${p.color}-${p.type}-${p.square}`,
        type: p.type,
        color: p.color,
        square: p.square,
    }));
}

const CASTLE_ROOK_SQUARES: Record<PieceColor, Record<'k' | 'q', { from: Square; to: Square }>> = {
    w: { k: { from: 'h1', to: 'f1' }, q: { from: 'a1', to: 'd1' } },
    b: { k: { from: 'h8', to: 'f8' }, q: { from: 'a8', to: 'd8' } },
};

// Cập nhật danh sách quân theo một nước đi hợp lệ (từ chess.js), xử lý cả bắt
// tốt qua đường, nhập thành (xe đi cùng) và phong cấp. Quân bị bắt không bị xoá
// ngay mà được đánh dấu `effect: 'captured'` để có thời gian phát animation trước
// khi bị dọn khỏi state (xem CAPTURE_CLEANUP_MS ở nơi gọi).
export function applyMoveToPieces(pieces: AnimatedPiece[], move: Move): AnimatedPiece[] {
    let next = pieces;

    if (move.captured) {
        const capturedSquare = move.isEnPassant() ? (`${move.to[0]}${move.from[1]}` as Square) : move.to;
        next = next.map((p) => (p.square === capturedSquare ? { ...p, effect: 'captured' } : p));
    }

    if (move.isKingsideCastle() || move.isQueensideCastle()) {
        const side = move.isKingsideCastle() ? 'k' : 'q';
        const { from: rookFrom, to: rookTo } = CASTLE_ROOK_SQUARES[move.color][side];
        next = next.map((p) => (p.square === rookFrom ? { ...p, square: rookTo } : p));
    }

    next = next.map((p) => {
        if (p.square !== move.from) return p;
        return {
            ...p,
            square: move.to,
            type: move.promotion ?? p.type,
            effect: move.promotion ? 'promoted' : undefined,
        };
    });

    return next;
}
