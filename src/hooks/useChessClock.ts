import { useCallback, useEffect, useRef, useState } from 'react';
import type { Chess } from 'chess.js';
import type { TimeControlMinutes } from '../types/game';

// Đồng hồ đếm ngược thật cho cả hai bên — chạy cho bên đang tới lượt, hết giờ thì
// bên đó thua (`flagFall`). Dùng `gameRef` để đọc lượt đi hiện tại bên trong
// interval mà không phải huỷ/tạo lại interval mỗi khi có nước đi mới. Nhận sẵn
// `isGameOver` từ nơi gọi thay vì tự tính lại `game.isGameOver()` — tránh gọi hàm
// này (tốn công sinh nước đi hợp lệ) 2 lần mỗi render.
export function useChessClock(game: Chess, timeControlMinutes: TimeControlMinutes, isGameOver: boolean) {
    const initialSeconds = timeControlMinutes === null ? null : timeControlMinutes * 60;

    const [whiteTime, setWhiteTime] = useState<number | null>(initialSeconds);
    const [blackTime, setBlackTime] = useState<number | null>(initialSeconds);
    const [flagFall, setFlagFall] = useState<'w' | 'b' | null>(null);

    const gameRef = useRef(game);
    useEffect(() => {
        gameRef.current = game;
    }, [game]);

    const isClockRelevant = timeControlMinutes !== null;
    const isOver = isGameOver || flagFall !== null;

    useEffect(() => {
        if (!isClockRelevant || isOver) return;

        const id = setInterval(() => {
            const turn = gameRef.current.turn();
            const setTime = turn === 'w' ? setWhiteTime : setBlackTime;

            setTime((prev) => {
                if (prev === null) return prev;
                if (prev <= 1) {
                    setFlagFall(turn);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(id);
    }, [isClockRelevant, isOver]);

    const resetClock = useCallback(() => {
        setWhiteTime(initialSeconds);
        setBlackTime(initialSeconds);
        setFlagFall(null);
    }, [initialSeconds]);

    return { whiteTime, blackTime, flagFall, resetClock };
}
