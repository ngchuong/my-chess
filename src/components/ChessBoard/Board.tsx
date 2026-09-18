import { Fragment } from 'react';
import type { Square as SquareName } from 'chess.js';
import { FILES, RANKS, coordsToSquare } from '../../lib/boardUtils';
import type { AnimatedPiece, LastMove, Premove } from '../../types/chess';
import PieceSprite from './PieceSprite';
import Square from './Square';

interface BoardProps {
    readonly pieces: AnimatedPiece[];
    readonly onSquareClick: (row: number, col: number) => void;
    readonly selectedSquare: SquareName | null;
    readonly possibleMoves: string[];
    readonly lastMove: LastMove | null;
    readonly premoveFrom: SquareName | null;
    readonly premove: Premove | null;
    readonly checkedKingSquare: SquareName | null;
    readonly isCheckFlashing: boolean;
}

// Bàn cờ 8x8 kèm tọa độ ở rìa, co giãn theo chiều rộng màn hình (lưới CSS Grid
// theo tỉ lệ thay vì kích thước ô cố định) để không tràn trên điện thoại.
// Quân cờ nằm ở một lớp phủ định vị tuyệt đối riêng (PieceSprite) để có thể
// trượt mượt qua các ô khi di chuyển. Lớp phủ này KHÔNG phải grid item (tránh
// việc nó "chiếm chỗ" cả vùng 8x8 khiến 64 ô auto-placement bị đẩy sai vị trí)
// mà định vị bằng inset khớp đúng với cột nhãn hàng/hàng nhãn cột.
export default function Board({
    pieces,
    onSquareClick,
    selectedSquare,
    possibleMoves,
    lastMove,
    premoveFrom,
    premove,
    checkedKingSquare,
    isCheckFlashing,
}: BoardProps) {
    const activeSelection = selectedSquare ?? premoveFrom;

    return (
        <div className={`relative w-full max-w-120 border-4 rounded-lg overflow-hidden shadow-2xl bg-slate-800 transition-colors duration-150 ${isCheckFlashing ? 'border-red-500 animate-board-shake' : 'border-slate-700'}`}>
            <div className="grid grid-cols-[20px_repeat(8,minmax(0,1fr))] sm:grid-cols-[24px_repeat(8,minmax(0,1fr))]">
                {RANKS.map((rank, rowIndex) => (
                    <Fragment key={rank}>
                        <div className="flex items-center justify-center text-xs font-semibold text-slate-400">
                            {rank}
                        </div>
                        {FILES.map((file, colIndex) => {
                            const squareNotation = coordsToSquare(rowIndex, colIndex);

                            return (
                                <Square
                                    key={`${rank}${file}`}
                                    isDark={(rowIndex + colIndex) % 2 === 1}
                                    isSelected={selectedSquare === squareNotation}
                                    isPossibleMove={possibleMoves.includes(squareNotation)}
                                    isLastMove={lastMove !== null && (lastMove.from === squareNotation || lastMove.to === squareNotation)}
                                    isPremoveFrom={premoveFrom === squareNotation}
                                    isPremoveQueued={premove !== null && (premove.from === squareNotation || premove.to === squareNotation)}
                                    isCheckedKing={checkedKingSquare === squareNotation}
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

            <div className="absolute left-5 sm:left-6 top-0 right-0 bottom-5 sm:bottom-6 pointer-events-none">
                {pieces.map((piece) => (
                    <PieceSprite key={piece.id} piece={piece} isSelected={activeSelection === piece.square} />
                ))}
            </div>
        </div>
    );
}
