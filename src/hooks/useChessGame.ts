import { useCallback, useEffect, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { CAPTURE_CLEANUP_MS, PROMOTE_CLEANUP_MS } from '../lib/animation';
import { applyMoveToPieces, createInitialPieces } from '../lib/pieceTracking';
import type { AnimatedPiece, LastMove } from '../types/chess';

export interface MoveInput {
    from: Square;
    to: Square;
    promotion?: string;
}

export type ApplyMoveFn = (input: MoveInput) => boolean;

function clearPieceEffect(pieces: AnimatedPiece[], pieceId: string, effect: AnimatedPiece['effect']): AnimatedPiece[] {
    if (effect === 'captured') {
        return pieces.filter((p) => p.id !== pieceId);
    }
    return pieces.map((p) => (p.id === pieceId ? { ...p, effect: undefined } : p));
}

// Nguồn sự thật duy nhất cho trạng thái ván cờ. Mọi nơi cần thực hiện nước đi
// (click của người chơi, AI, premove) đều gọi qua `applyMove` để tránh lặp lại
// logic "mutate rồi tạo Chess mới để React nhận biết thay đổi" ở nhiều chỗ.
// Ngoài trạng thái luật cờ (`game`), hook này còn theo dõi danh sách quân có id
// ổn định (`pieces`) để Board có thể animate quân trượt/biến mất mượt mà.
export function useChessGame() {
    const [game, setGame] = useState<Chess>(() => new Chess());
    const [lastMove, setLastMove] = useState<LastMove | null>(null);
    const [pieces, setPieces] = useState<AnimatedPiece[]>(createInitialPieces);

    const applyMove = useCallback((input: MoveInput): boolean => {
        let move;
        try {
            move = game.move(input);
        } catch {
            return false;
        }
        if (!move) return false;

        setPieces((prev) => applyMoveToPieces(prev, move));
        setLastMove({
            from: move.from,
            to: move.to,
            san: move.san,
            color: move.color,
            piece: move.piece,
            captured: move.captured,
            promotion: move.promotion,
            isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
        });
        setGame(new Chess(game.fen()));
        return true;
    }, [game]);

    const resetGame = useCallback(() => {
        setGame(new Chess());
        setLastMove(null);
        setPieces(createInitialPieces());
    }, []);

    // Dọn hiệu ứng tạm thời (quân bị ăn / vừa phong cấp) sau khi animation kết thúc:
    // quân bị ăn được gỡ khỏi danh sách, quân phong cấp chỉ tắt cờ hiệu ứng.
    useEffect(() => {
        const pending = pieces.filter((p) => p.effect);
        if (pending.length === 0) return;

        const timers = pending.map((p) => {
            const delay = p.effect === 'captured' ? CAPTURE_CLEANUP_MS : PROMOTE_CLEANUP_MS;
            return setTimeout(() => {
                setPieces((prev) => clearPieceEffect(prev, p.id, p.effect));
            }, delay);
        });

        return () => timers.forEach(clearTimeout);
    }, [pieces]);

    return { game, lastMove, pieces, applyMove, resetGame };
}
