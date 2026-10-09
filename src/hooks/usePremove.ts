import { useCallback, useEffect, useState } from 'react';
import type { Chess, Move, PieceSymbol, Square } from 'chess.js';
import { oppositeColor } from '../lib/boardUtils';
import type { ApplyMoveFn } from './useChessGame';
import type { PendingPromotion, PieceColor, Premove } from '../types/chess';
import type { GameMode } from '../types/game';

// Cho phép người chơi chọn trước quân + ô đích trong lúc máy đang suy nghĩ
// (kiểu premove của chess.vn/chess.com). Ngay khi tới lượt người chơi, nước đi
// được tự thực hiện nếu vẫn hợp lệ; nếu không thì âm thầm huỷ. Nếu premove là một
// nước phong cấp, chờ người chơi chọn quân qua `choosePromotion` giống hệt nước đi
// thường thay vì tự động phong Hậu.
export function usePremove(
    game: Chess,
    applyMove: ApplyMoveFn,
    mode: GameMode,
    humanColor: PieceColor,
    isMatchOver: boolean,
) {
    const aiColor = oppositeColor(humanColor);
    const [premoveFrom, setPremoveFrom] = useState<Square | null>(null);
    const [premove, setPremove] = useState<Premove | null>(null);
    const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

    const isPremoveMode = mode === 'pve' && !isMatchOver && game.turn() === aiColor;

    useEffect(() => {
        if (mode !== 'pve' || isMatchOver || game.turn() === aiColor || !premove) return;

        const queued = premove;
        setPremove(null);

        const legalMoves = game.moves({ square: queued.from, verbose: true }) as Move[];
        const matchingMove = legalMoves.find((m) => m.to === queued.to);
        if (!matchingMove) return;

        if (matchingMove.promotion) {
            setPendingPromotion({ from: queued.from, to: queued.to, color: game.turn() });
            return;
        }

        applyMove({ from: queued.from, to: queued.to });
    }, [game, mode, aiColor, isMatchOver, premove, applyMove]);

    const handlePremoveSquareClick = useCallback((squareNotation: Square) => {
        const pieceOnSquare = game.get(squareNotation);

        if (pieceOnSquare?.color === humanColor) {
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
    }, [game, humanColor, premoveFrom]);

    const choosePromotion = useCallback((promotion: PieceSymbol) => {
        if (!pendingPromotion) return;
        applyMove({ from: pendingPromotion.from, to: pendingPromotion.to, promotion });
        setPendingPromotion(null);
    }, [pendingPromotion, applyMove]);

    const resetPremove = useCallback(() => {
        setPremoveFrom(null);
        setPremove(null);
        setPendingPromotion(null);
    }, []);

    return {
        isPremoveMode,
        premoveFrom,
        premove,
        pendingPromotion,
        handlePremoveSquareClick,
        choosePromotion,
        cancelPremove: resetPremove,
        resetPremove,
    };
}
