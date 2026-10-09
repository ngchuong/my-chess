import { useCallback, useEffect, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import { CAPTURE_CLEANUP_MS, PROMOTE_CLEANUP_MS } from '../lib/animation';
import { applyMoveToPieces, createInitialPieces, piecesFromFen } from '../lib/pieceTracking';
import type { AnimatedPiece, LastMove } from '../types/chess';
import type { MoveRecord } from '../types/analysis';

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

function toMoveRecord(move: Move, plyIndex: number): MoveRecord {
    return {
        from: move.from,
        to: move.to,
        san: move.san,
        color: move.color,
        piece: move.piece,
        captured: move.captured,
        promotion: move.promotion,
        isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
        moveNumber: Math.floor(plyIndex / 2) + 1,
        fenBefore: move.before,
        fenAfter: move.after,
    };
}

// Bản sao giữ nguyên lịch sử nước đi. Không dùng `new Chess(game.fen())`: FEN không
// chứa lịch sử nên chess.js sẽ không bao giờ phát hiện được hòa do lặp lại 3 lần,
// và cũng không `undo()` được.
function cloneGame(game: Chess): Chess {
    const next = new Chess();
    for (const san of game.history()) next.move(san);
    return next;
}

interface GameState {
    game: Chess;
    history: MoveRecord[];
    pieces: AnimatedPiece[];
    lastMove: LastMove | null;
}

// Dựng lại ván từ danh sách nước đi (SAN) — dùng để tiếp tục ván đã lưu. Gặp nước
// không hợp lệ (dữ liệu lưu hỏng) thì dừng lại ở vị trí hợp lệ cuối cùng.
function buildGameState(sanMoves: readonly string[]): GameState {
    const game = new Chess();
    const history: MoveRecord[] = [];

    for (const san of sanMoves) {
        try {
            history.push(toMoveRecord(game.move(san), history.length));
        } catch {
            break;
        }
    }

    return {
        game,
        history,
        pieces: history.length > 0 ? piecesFromFen(game.fen()) : createInitialPieces(),
        lastMove: history.at(-1) ?? null,
    };
}

// Nguồn sự thật duy nhất cho trạng thái ván cờ. Mọi nơi cần thực hiện nước đi
// (click của người chơi, AI, premove) đều gọi qua `applyMove` để tránh lặp lại
// logic "tạo Chess mới để React nhận biết thay đổi" ở nhiều chỗ.
// Ngoài trạng thái luật cờ (`game`), hook này còn theo dõi danh sách quân có id
// ổn định (`pieces`) để Board có thể animate quân trượt/biến mất mượt mà.
export function useChessGame(initialSanMoves: readonly string[] = []) {
    const [initial] = useState(() => buildGameState(initialSanMoves));
    const [game, setGame] = useState<Chess>(initial.game);
    const [lastMove, setLastMove] = useState<LastMove | null>(initial.lastMove);
    const [pieces, setPieces] = useState<AnimatedPiece[]>(initial.pieces);
    const [moveHistory, setMoveHistory] = useState<MoveRecord[]>(initial.history);

    const applyMove = useCallback((input: MoveInput): boolean => {
        const next = cloneGame(game);
        let move;
        try {
            move = next.move(input);
        } catch {
            return false;
        }
        if (!move) return false;

        const record = toMoveRecord(move, game.history().length);
        setPieces((prev) => applyMoveToPieces(prev, move));
        setLastMove(record);
        setMoveHistory((prev) => [...prev, record]);
        setGame(next);
        return true;
    }, [game]);

    // Lùi lại `plies` nửa nước. Quân được dựng lại từ FEN (không animate) — lùi nước
    // là thao tác "nhảy" vị trí chứ không phải một nước đi thật.
    const undoMoves = useCallback((plies: number) => {
        const total = game.history().length;
        const count = Math.min(plies, total);
        if (count <= 0) return;

        const next = cloneGame(game);
        for (let i = 0; i < count; i++) next.undo();

        setGame(next);
        setPieces(piecesFromFen(next.fen()));
        setMoveHistory((prev) => prev.slice(0, total - count));
        setLastMove(moveHistory[total - count - 1] ?? null);
    }, [game, moveHistory]);

    const resetGame = useCallback(() => {
        setGame(new Chess());
        setLastMove(null);
        setPieces(createInitialPieces());
        setMoveHistory([]);
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

    return { game, lastMove, pieces, moveHistory, applyMove, undoMoves, resetGame };
}
