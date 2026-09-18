import { useCallback, useState } from 'react';
import type { Chess, Move, PieceSymbol, Square } from 'chess.js';
import type { ApplyMoveFn } from './useChessGame';
import type { PendingPromotion } from '../types/chess';

// Chọn quân + thực hiện nước đi bình thường (đến lượt của chính mình). Tách riêng
// khỏi ChessBoard để có thể tái dùng cho các bàn cờ khác sau này (ví dụ bàn phân
// tích ván đấu) mà không cần các phần logic đồng hồ/AI/premove đi kèm.
// Khi nước đi là phong cấp, không thực hiện ngay mà chờ người chơi chọn quân qua
// `choosePromotion` (xem PromotionModal) thay vì mặc định luôn phong Hậu.
export function useMoveSelection(game: Chess, applyMove: ApplyMoveFn) {
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
    const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

    const clearSelection = useCallback(() => {
        setSelectedSquare(null);
        setPossibleMoves([]);
        setPendingPromotion(null);
    }, []);

    const handleSquareClick = useCallback((squareNotation: Square) => {
        const pieceOnSquare = game.get(squareNotation);

        if (pieceOnSquare?.color === game.turn()) {
            setSelectedSquare(squareNotation);
            const moves = game.moves({ square: squareNotation, verbose: true }) as Move[];
            setPossibleMoves(moves.map((m) => m.to));
            return;
        }

        if (selectedSquare) {
            const moves = game.moves({ square: selectedSquare, verbose: true }) as Move[];
            const isPromotion = moves.some((m) => m.to === squareNotation && m.promotion);

            if (isPromotion) {
                setPendingPromotion({ from: selectedSquare, to: squareNotation, color: game.turn() });
                setPossibleMoves([]);
                return;
            }

            applyMove({ from: selectedSquare, to: squareNotation });
        }

        clearSelection();
    }, [game, selectedSquare, applyMove, clearSelection]);

    const choosePromotion = useCallback((promotion: PieceSymbol) => {
        if (!pendingPromotion) return;
        applyMove({ from: pendingPromotion.from, to: pendingPromotion.to, promotion });
        clearSelection();
    }, [pendingPromotion, applyMove, clearSelection]);

    return { selectedSquare, possibleMoves, pendingPromotion, handleSquareClick, clearSelection, choosePromotion };
}
