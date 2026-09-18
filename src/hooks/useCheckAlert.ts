import { useEffect, useState } from 'react';
import type { Chess, Square } from 'chess.js';
import { CHECK_FLASH_MS } from '../lib/animation';
import type { AnimatedPiece } from '../types/chess';

// Phát hiệu ứng (nhấp nháy đỏ + rung) và âm thanh cảnh báo mỗi khi có một nước đi
// mới khiến bên đi tiếp theo bị chiếu. Chỉ bắn hiệu ứng một lần cho mỗi nước đi
// (không lặp lại liên tục trong lúc vẫn đang bị chiếu).
export function useCheckAlert(game: Chess, pieces: AnimatedPiece[], playCheck: () => void) {
    const [isFlashing, setIsFlashing] = useState(false);

    const inCheck = game.inCheck();

    useEffect(() => {
        if (!inCheck) {
            // Vua đã thoát chiếu (hoặc ván vừa mới bắt đầu) — tắt hiệu ứng ngay,
            // đừng chỉ dựa vào timer cũ vì nó có thể đã bị huỷ bởi lượt đi tiếp theo
            // đến trước khi kịp tự tắt (đặc biệt khi máy phản hồi rất nhanh).
            setIsFlashing(false);
            return;
        }

        setIsFlashing(true);
        playCheck();

        const timer = setTimeout(() => setIsFlashing(false), CHECK_FLASH_MS);
        return () => clearTimeout(timer);
    }, [game, inCheck, playCheck]);

    const checkedKingSquare: Square | null = inCheck
        ? (pieces.find((p) => p.type === 'k' && p.color === game.turn())?.square ?? null)
        : null;

    return { isFlashing, checkedKingSquare };
}
