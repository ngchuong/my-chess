import { useEffect } from 'react';
import type { LastMove } from '../types/chess';

// Phát tiếng "cạch" khi đi quân thường, tiếng "huỵch" khi ăn quân — mỗi khi có
// một `lastMove` mới (không phát khi mới mount, vì lastMove khởi đầu là null).
export function useMoveSound(lastMove: LastMove | null, playMove: () => void, playCapture: () => void) {
    useEffect(() => {
        if (!lastMove) return;
        if (lastMove.captured) {
            playCapture();
        } else {
            playMove();
        }
    }, [lastMove, playMove, playCapture]);
}
