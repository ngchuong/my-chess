import { useEffect, useRef, useState } from 'react';
import type { Chess, Square } from 'chess.js';
import { AI_COLOR } from '../lib/boardUtils';
import type { ApplyMoveFn } from './useChessGame';
import type { AIWorkerMove } from '../types/chess';
import type { Difficulty, GameMode } from '../types/game';

// Ở độ Dễ/Trung bình, máy có thể tính xong nước đi trong vài trăm ms — nhanh hơn
// thời gian người chơi cần để nhìn bàn cờ và click 2 ô cho một nước "đặt trước"
// (premove), khiến tính năng đó gần như không có cơ hội hoạt động. Đặt thời gian
// "suy nghĩ" tối thiểu để luôn có một khoảng chờ ổn định, bất kể độ khó.
const MIN_THINKING_MS = 500;

// Điều khiển Web Worker tính nước đi AI. Chỉ hoạt động ở chế độ PvE và khi đến lượt máy.
export function useAIOpponent(
    game: Chess,
    applyMove: ApplyMoveFn,
    mode: GameMode,
    difficulty: Difficulty,
    isMatchOver: boolean,
) {
    const workerRef = useRef<Worker | null>(null);
    const aiThinkingRef = useRef(false);
    const [isThinking, setIsThinking] = useState(false);

    useEffect(() => {
        if (mode !== 'pve') return;

        const worker = new Worker(new URL('../lib/chessAI.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        return () => {
            worker.terminate();
            workerRef.current = null;
        };
    }, [mode]);

    useEffect(() => {
        const worker = workerRef.current;
        if (!worker || mode !== 'pve' || isMatchOver || game.turn() !== AI_COLOR || aiThinkingRef.current) {
            return;
        }

        aiThinkingRef.current = true;
        setIsThinking(true);
        const requestStartedAt = Date.now();
        let applyTimeoutId: ReturnType<typeof setTimeout> | null = null;

        const finish = (move: AIWorkerMove | null) => {
            aiThinkingRef.current = false;
            setIsThinking(false);
            if (move) {
                applyMove({ from: move.from as Square, to: move.to as Square, promotion: move.promotion });
            }
        };

        const handleMessage = (event: MessageEvent<AIWorkerMove | null>) => {
            const remaining = MIN_THINKING_MS - (Date.now() - requestStartedAt);
            if (remaining > 0) {
                applyTimeoutId = setTimeout(() => finish(event.data), remaining);
            } else {
                finish(event.data);
            }
        };

        worker.addEventListener('message', handleMessage);
        worker.postMessage({ fen: game.fen(), difficulty });

        return () => {
            worker.removeEventListener('message', handleMessage);
            if (applyTimeoutId) clearTimeout(applyTimeoutId);
            aiThinkingRef.current = false;
            setIsThinking(false);
        };
    }, [game, mode, difficulty, isMatchOver, applyMove]);

    return { isThinking };
}
