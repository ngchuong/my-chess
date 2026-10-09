import { useCallback, useEffect, useRef, useState } from 'react';
import type { Chess } from 'chess.js';
import type { PieceColor } from '../types/chess';
import type { TimeControlMinutes } from '../types/game';

// Kiểm tra thường xuyên để hết giờ được phát hiện gần như ngay lập tức; giao diện vẫn
// chỉ render lại khi số giây hiển thị thay đổi.
const TICK_MS = 100;

const toDisplaySeconds = (ms: number | null) => (ms === null ? null : Math.ceil(ms / 1000));

// Đồng hồ đếm ngược thật cho cả hai bên — chạy cho bên đang tới lượt, hết giờ thì
// bên đó thua (`flagFall`). Thời gian còn lại giữ bằng mili-giây trong ref và trừ
// đúng lượng thời gian thực đã trôi qua (`performance.now()`), kể cả phần lẻ giây
// khi đổi lượt — thay vì trừ tròn 1 giây mỗi nhịp cho bên đang tới lượt đúng lúc đó,
// vốn khiến người đi nhanh hơn 1 giây gần như không mất giờ.
// `isRunning` cho phép nơi gọi tạm dừng đồng hồ (chưa có nước đi đầu tiên, engine
// còn đang tải...). `resumeSeconds` là thời gian còn lại của ván đã lưu (tiếp tục ván
// sau khi tải lại trang); "Ván mới" luôn quay về thời gian đầy đủ.
// Nhận sẵn `isGameOver` thay vì tự tính lại `game.isGameOver()` — tránh gọi hàm này
// (tốn công sinh nước đi hợp lệ) 2 lần mỗi render.
export function useChessClock(
    game: Chess,
    timeControlMinutes: TimeControlMinutes,
    isGameOver: boolean,
    isRunning: boolean,
    resumeSeconds?: Record<PieceColor, number | null>,
) {
    const initialMs = timeControlMinutes === null ? null : timeControlMinutes * 60_000;
    const startMs = (color: PieceColor) => {
        const resumed = resumeSeconds?.[color];
        return initialMs === null || resumed == null ? initialMs : Math.min(resumed * 1000, initialMs);
    };

    const [startRemaining] = useState(() => ({ w: startMs('w'), b: startMs('b') }));
    const remainingRef = useRef<Record<PieceColor, number | null>>(startRemaining);
    const [whiteTime, setWhiteTime] = useState(() => toDisplaySeconds(startRemaining.w));
    const [blackTime, setBlackTime] = useState(() => toDisplaySeconds(startRemaining.b));
    const [flagFall, setFlagFall] = useState<PieceColor | null>(null);
    // Tăng mỗi lần reset: phần trừ giờ trong cleanup của lượt cũ (chạy SAU khi reset
    // vì lượt đổi về Trắng) không được trừ vào đồng hồ mới.
    const resetCountRef = useRef(0);

    const turn = game.turn();
    const isActive = initialMs !== null && !isGameOver && flagFall === null && isRunning;

    useEffect(() => {
        if (!isActive) return;

        const resetCount = resetCountRef.current;
        let last = performance.now();
        const setDisplay = turn === 'w' ? setWhiteTime : setBlackTime;

        const deductElapsed = () => {
            if (resetCountRef.current !== resetCount) return;
            const remaining = remainingRef.current[turn];
            if (remaining === null) return;

            const now = performance.now();
            const next = Math.max(remaining - (now - last), 0);
            last = now;

            remainingRef.current[turn] = next;
            setDisplay(toDisplaySeconds(next));
            if (next === 0) setFlagFall(turn);
        };

        const id = setInterval(deductElapsed, TICK_MS);
        return () => {
            clearInterval(id);
            deductElapsed();
        };
    }, [isActive, turn]);

    const resetClock = useCallback(() => {
        resetCountRef.current += 1;
        remainingRef.current = { w: initialMs, b: initialMs };
        setWhiteTime(toDisplaySeconds(initialMs));
        setBlackTime(toDisplaySeconds(initialMs));
        setFlagFall(null);
    }, [initialMs]);

    return { whiteTime, blackTime, flagFall, resetClock };
}
