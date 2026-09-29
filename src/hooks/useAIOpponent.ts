import { useEffect, useState } from 'react';
import type { Chess, Square } from 'chess.js';
import { AI_COLOR } from '../lib/boardUtils';
import { aiStrength } from '../lib/engine/difficulty';
import { analyse, parseUciMove } from '../lib/engine/stockfish';
import type { ApplyMoveFn } from './useChessGame';
import type { Difficulty, GameMode } from '../types/game';

// Stockfish trả lời gần như tức thì ở các mức Elo này — nhanh hơn thời gian người chơi
// cần để nhìn bàn cờ và click 2 ô cho một nước "đặt trước" (premove), khiến tính năng đó
// gần như không có cơ hội hoạt động. Đặt thời gian "suy nghĩ" tối thiểu để luôn có một
// khoảng chờ ổn định, và để máy không đi nhanh đến mức giật cục.
const MIN_THINKING_MS = 500;

// Điều khiển máy đối thủ. Chỉ hoạt động ở chế độ PvE và khi đến lượt máy.
export function useAIOpponent(
    game: Chess,
    applyMove: ApplyMoveFn,
    mode: GameMode,
    difficulty: Difficulty,
    isMatchOver: boolean,
) {
    const [isThinking, setIsThinking] = useState(false);

    const fen = game.fen();
    const shouldMove = mode === 'pve' && !isMatchOver && game.turn() === AI_COLOR;

    useEffect(() => {
        if (!shouldMove) {
            setIsThinking(false);
            return;
        }

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const startedAt = Date.now();
        const { elo, movetimeMs } = aiStrength(difficulty);

        setIsThinking(true);

        analyse({ fen, movetimeMs, elo })
            .then((result) => {
                if (cancelled) return;

                const play = () => {
                    setIsThinking(false);
                    if (cancelled || !result.bestMove) return;

                    const { from, to, promotion } = parseUciMove(result.bestMove);
                    applyMove({ from: from as Square, to: to as Square, promotion });
                };

                const remaining = MIN_THINKING_MS - (Date.now() - startedAt);
                if (remaining > 0) timer = setTimeout(play, remaining);
                else play();
            })
            .catch(() => {
                if (!cancelled) setIsThinking(false);
            });

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            setIsThinking(false);
        };
    }, [fen, shouldMove, difficulty, applyMove]);

    return { isThinking };
}
