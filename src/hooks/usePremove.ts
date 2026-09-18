import { useCallback, useEffect, useState } from 'react';
import type { Chess, Move, Square } from 'chess.js';
import { AI_COLOR, HUMAN_COLOR } from '../lib/boardUtils';
import type { ApplyMoveFn } from './useChessGame';
import type { Premove } from '../types/chess';
import type { GameMode } from '../types/game';

// Cho phép người chơi chọn trước quân + ô đích trong lúc máy đang suy nghĩ
// (kiểu premove của chess.vn/chess.com). Ngay khi tới lượt người chơi, nước đi
// được tự thực hiện nếu vẫn hợp lệ; nếu không thì âm thầm huỷ.
export function usePremove(game: Chess, applyMove: ApplyMoveFn, mode: GameMode, isMatchOver: boolean) {
    const [premoveFrom, setPremoveFrom] = useState<Square | null>(null);
    const [premove, setPremove] = useState<Premove | null>(null);

    const isPremoveMode = mode === 'pve' && !isMatchOver && game.turn() === AI_COLOR;

    useEffect(() => {
        if (mode !== 'pve' || isMatchOver || game.turn() === AI_COLOR || !premove) return;

        const queued = premove;
        setPremove(null);

        const legalMoves = game.moves({ square: queued.from, verbose: true }) as Move[];
        if (!legalMoves.some((m) => m.to === queued.to)) return;

        applyMove({ from: queued.from, to: queued.to, promotion: 'q' });
    }, [game, mode, isMatchOver, premove, applyMove]);

    const handlePremoveSquareClick = useCallback((squareNotation: Square) => {
        const pieceOnSquare = game.get(squareNotation);

        if (pieceOnSquare?.color === HUMAN_COLOR) {
            setPremoveFrom(squareNotation);
            setPremove(null);
            return;
        }

        if (premoveFrom) {
            setPremove({ from: premoveFrom, to: squareNotation });
            setPremoveFrom(null);
            return;
        }

        setPremoveFrom(null);
        setPremove(null);
    }, [game, premoveFrom]);

    const resetPremove = useCallback(() => {
        setPremoveFrom(null);
        setPremove(null);
    }, []);

    return { isPremoveMode, premoveFrom, premove, handlePremoveSquareClick, cancelPremove: resetPremove, resetPremove };
}
