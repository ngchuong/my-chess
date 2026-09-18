import { memo } from 'react';

interface SquareProps {
    readonly isDark: boolean;
    readonly isSelected: boolean;
    readonly isPossibleMove: boolean;
    readonly isLastMove: boolean;
    readonly isPremoveFrom: boolean;
    readonly isPremoveQueued: boolean;
    readonly isCheckedKing: boolean;
    readonly onClick: () => void;
}

// Một ô của bàn cờ — chỉ lo nền/hiệu ứng highlight và click; quân cờ được vẽ ở
// lớp phủ riêng (xem PieceLayer) để có thể animate trượt qua nhiều ô.
function Square({
    isDark,
    isSelected,
    isPossibleMove,
    isLastMove,
    isPremoveFrom,
    isPremoveQueued,
    isCheckedKing,
    onClick,
}: SquareProps) {
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

            {isCheckedKing && (
                <div className="absolute inset-0 animate-king-check pointer-events-none" />
            )}

            {isPossibleMove && (
                <div className="absolute w-4 h-4 bg-black/30 rounded-full z-10 pointer-events-none" />
            )}
        </button>
    );
}

export default memo(Square);
