import { memo } from 'react';
import { PIECE_IMAGES, squareToCoords } from '../../lib/boardUtils';
import { CAPTURE_IMPACT_DELAY_MS, MOVE_SLIDE_MS, PROMOTE_DELAY_MS } from '../../lib/animation';
import type { AnimatedPiece } from '../../types/chess';

interface PieceSpriteProps {
    readonly piece: AnimatedPiece;
    readonly isSelected: boolean;
}

function getAnimationDelayMs(effect: AnimatedPiece['effect']): number | undefined {
    if (effect === 'captured') return CAPTURE_IMPACT_DELAY_MS;
    if (effect === 'promoted') return PROMOTE_DELAY_MS;
    return undefined;
}

// Một quân cờ trong lớp phủ animation, đặt tuyệt đối theo % trên bàn cờ 8x8 và
// transition khi `square` đổi để tạo hiệu ứng trượt. `effect` (nếu có) phát thêm
// animation "vỡ tan" khi bị ăn hoặc "bừng sáng" khi vừa phong cấp.
function PieceSprite({ piece, isSelected }: PieceSpriteProps) {
    const { row, col } = squareToCoords(piece.square);
    const isCaptured = piece.effect === 'captured';
    const isPromoted = piece.effect === 'promoted';
    const animationDelayMs = getAnimationDelayMs(piece.effect);

    return (
        <div
            className={`
                absolute w-[12.5%] h-[12.5%] flex items-center justify-center pointer-events-none ease-out
                ${isCaptured ? 'animate-piece-capture' : ''}
                ${isPromoted ? 'animate-piece-promote' : ''}
            `}
            style={{
                left: `${col * 12.5}%`,
                top: `${row * 12.5}%`,
                zIndex: isCaptured ? 1 : 2,
                transitionProperty: 'left, top',
                transitionDuration: `${MOVE_SLIDE_MS}ms`,
                animationDelay: animationDelayMs !== undefined ? `${animationDelayMs}ms` : undefined,
            }}
        >
            <img
                src={PIECE_IMAGES[piece.color][piece.type]}
                alt={`${piece.color} ${piece.type}`}
                className={`w-[85%] h-[85%] object-contain transition-transform duration-100 ${isSelected ? 'scale-110' : ''}`}
                draggable={false}
            />
        </div>
    );
}

export default memo(PieceSprite);
