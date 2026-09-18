import { Fragment } from 'react';
import type { Chess, Square as SquareName } from 'chess.js';
import { FILES, RANKS, coordsToSquare } from '../../lib/boardUtils';
import type { LastMove, Premove } from '../../types/chess';
import Square from './Square';

interface BoardProps {
    game: Chess;
    onSquareClick: (row: number, col: number) => void;
    selectedSquare: SquareName | null;
    possibleMoves: string[];
    lastMove: LastMove | null;
    premoveFrom: SquareName | null;
    premove: Premove | null;
}

// Bàn cờ 8x8 kèm tọa độ ở rìa, co giãn theo chiều rộng màn hình (lưới CSS Grid
// theo tỉ lệ thay vì kích thước ô cố định) để không tràn trên điện thoại.
export default function Board({ game, onSquareClick, selectedSquare, possibleMoves, lastMove, premoveFrom, premove }: BoardProps) {
    const board = game.board();

    return (
        <div className="w-full max-w-120 border-4 border-slate-700 rounded-lg overflow-hidden shadow-2xl bg-slate-800">
            <div className="grid grid-cols-[20px_repeat(8,minmax(0,1fr))] sm:grid-cols-[24px_repeat(8,minmax(0,1fr))]">
                {board.map((row, rowIndex) => (
                    <Fragment key={RANKS[rowIndex]}>
                        <div className="flex items-center justify-center text-xs font-semibold text-slate-400">
                            {RANKS[rowIndex]}
                        </div>
                        {row.map((square, colIndex) => {
                            const squareNotation = coordsToSquare(rowIndex, colIndex);

                            return (
                                <Square
                                    key={`${RANKS[rowIndex]}${FILES[colIndex]}`}
                                    piece={square}
                                    isDark={(rowIndex + colIndex) % 2 === 1}
                                    isSelected={selectedSquare === squareNotation}
                                    isPossibleMove={possibleMoves.includes(squareNotation)}
                                    isLastMove={lastMove !== null && (lastMove.from === squareNotation || lastMove.to === squareNotation)}
                                    isPremoveFrom={premoveFrom === squareNotation}
                                    isPremoveQueued={premove !== null && (premove.from === squareNotation || premove.to === squareNotation)}
                                    onClick={() => onSquareClick(rowIndex, colIndex)}
                                />
                            );
                        })}
                    </Fragment>
                ))}
                <div />
                {FILES.map((file) => (
                    <div key={file} className="h-5 sm:h-6 flex items-center justify-center text-xs font-semibold text-slate-400">
                        {file}
                    </div>
                ))}
            </div>
        </div>
    );
}
