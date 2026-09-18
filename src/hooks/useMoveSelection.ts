import { useCallback, useState } from 'react';
import type { Chess, Move, Square } from 'chess.js';
import type { ApplyMoveFn } from './useChessGame';

// Chọn quân + thực hiện nước đi bình thường (đến lượt của chính mình). Tách riêng
// khỏi ChessBoard để có thể tái dùng cho các bàn cờ khác sau này (ví dụ bàn phân
// tích ván đấu) mà không cần các phần logic đồng hồ/AI/premove đi kèm.
export function useMoveSelection(game: Chess, applyMove: ApplyMoveFn) {
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<string[]>([]);

    const clearSelection = useCallback(() => {
        setSelectedSquare(null);
        setPossibleMoves([]);
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
            applyMove({ from: selectedSquare, to: squareNotation, promotion: 'q' });
        }

        clearSelection();
    }, [game, selectedSquare, applyMove, clearSelection]);

    return { selectedSquare, possibleMoves, handleSquareClick, clearSelection };
}
