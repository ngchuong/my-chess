import { useCallback, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import type { LastMove } from '../types/chess';

export interface MoveInput {
    from: Square;
    to: Square;
    promotion?: string;
}

export type ApplyMoveFn = (input: MoveInput) => boolean;

// Nguồn sự thật duy nhất cho trạng thái ván cờ. Mọi nơi cần thực hiện nước đi
// (click của người chơi, AI, premove) đều gọi qua `applyMove` để tránh lặp lại
// logic "mutate rồi tạo Chess mới để React nhận biết thay đổi" ở nhiều chỗ.
export function useChessGame() {
    const [game, setGame] = useState<Chess>(() => new Chess());
    const [lastMove, setLastMove] = useState<LastMove | null>(null);

    const applyMove = useCallback((input: MoveInput): boolean => {
        let move;
        try {
            move = game.move(input);
        } catch {
            return false;
        }
        if (!move) return false;

        setLastMove({ from: move.from, to: move.to, san: move.san, color: move.color });
        setGame(new Chess(game.fen()));
        return true;
    }, [game]);

    const resetGame = useCallback(() => {
        setGame(new Chess());
        setLastMove(null);
    }, []);

    return { game, lastMove, applyMove, resetGame };
}
