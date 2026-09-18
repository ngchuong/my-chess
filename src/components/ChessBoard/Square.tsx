import { memo } from 'react';
import type { PieceSymbol } from 'chess.js';
import { PIECE_IMAGES } from '../../lib/boardUtils';

interface SquarePiece {
    type: PieceSymbol;
    color: 'w' | 'b';
}

interface SquareProps {
    piece: SquarePiece | null | undefined;
    isDark: boolean;
    isSelected: boolean;
    isPossibleMove: boolean;
    isLastMove: boolean;
    isPremoveFrom: boolean;
    isPremoveQueued: boolean;
    onClick: () => void;
}

// Một ô của bàn cờ. Tách riêng để dễ thêm hiệu ứng sau này (chiếu hết, nhập
// thành, ...) mà không phải đụng vào logic ván cờ trong ChessBoard.
function Square({ piece, isDark, isSelected, isPossibleMove, isLastMove, isPremoveFrom, isPremoveQueued, onClick }: SquareProps) {
    return (
        <button
            onClick={onClick}
            className={`
                relative aspect-square flex items-center justify-center cursor-pointer transition-colors duration-150
                ${isDark ? 'bg-board-dark' : 'bg-board-light'}
                ${isSelected || isPremoveFrom ? 'bg-board-selected!' : ''}
                hover:brightness-95
            `}
        >
            {isLastMove && !isSelected && !isPremoveFrom && !isPremoveQueued && (
                <div className="absolute inset-0 bg-yellow-300/25 pointer-events-none" />
            )}

            {isPremoveQueued && !isPremoveFrom && (
                <div className="absolute inset-0 bg-sky-400/35 pointer-events-none" />
            )}

            {isPossibleMove && (
                <div className="absolute w-4 h-4 bg-black/30 rounded-full z-10 pointer-events-none" />
            )}

            {piece && (
                <img
                    src={PIECE_IMAGES[piece.color][piece.type]}
                    alt={`${piece.color} ${piece.type}`}
                    className={`w-[85%] h-[85%] object-contain pointer-events-none transition-transform duration-100 ${isSelected ? 'scale-110' : ''}`}
                    draggable={false}
                />
            )}
        </button>
    );
}

export default memo(Square);
