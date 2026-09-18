import { useCallback, useEffect, useState } from 'react';
import { playCaptureSound, playCheckSound, playMoveSound } from '../lib/sound';

const STORAGE_KEY = 'chess-sound-muted';

function readStoredMuted(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

// Bật/tắt âm thanh, nhớ lựa chọn của người dùng giữa các lần chơi.
export function useSoundSettings() {
    const [muted, setMuted] = useState(readStoredMuted);

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
        } catch {
            // localStorage không khả dụng (chế độ riêng tư, ...) — bỏ qua.
        }
    }, [muted]);

    const toggleMuted = useCallback(() => setMuted((prev) => !prev), []);

    const playMove = useCallback(() => {
        if (!muted) playMoveSound();
    }, [muted]);

    const playCapture = useCallback(() => {
        if (!muted) playCaptureSound();
    }, [muted]);

    const playCheck = useCallback(() => {
        if (!muted) playCheckSound();
    }, [muted]);

    return { muted, toggleMuted, playMove, playCapture, playCheck };
}
