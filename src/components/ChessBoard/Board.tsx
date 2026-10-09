import { Fragment, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Square as SquareName } from 'chess.js';
import { FILES, RANKS, coordsToSquare, squareToCoords } from '../../lib/boardUtils';
import type { MoveHint } from '../../lib/moveHint';
import type { AnimatedPiece, LastMove, Premove } from '../../types/chess';
import PieceSprite from './PieceSprite';
import Square from './Square';

interface BoardProps {
    readonly pieces: AnimatedPiece[];
    readonly onSquareClick: (square: SquareName) => void;
    readonly selectedSquare: SquareName | null;
    readonly possibleMoves: string[];
    readonly lastMove: LastMove | null;
    readonly premoveFrom: SquareName | null;
    readonly premove: Premove | null;
    readonly checkedKingSquare: SquareName | null;
    readonly isCheckFlashing: boolean;
    readonly hint: MoveHint | null;
    // Xoay bàn cờ để quân Đen ở phía dưới (người chơi cầm Đen).
    readonly flipped?: boolean;
    // Quân trên ô này có được kéo không. Bỏ trống = bàn cờ chỉ để xem (không kéo được).
    readonly canDragFrom?: (square: SquareName) => boolean;
    // Nội dung nhỏ gắn ở góc trên phải một ô — ví dụ huy hiệu đánh giá nước vừa đi ở
    // màn hình xem lại ván.
    readonly squareBadge?: { square: SquareName; content: ReactNode } | null;
}

// Kéo quá ngưỡng này (px) mới tính là kéo thả; ít hơn thì coi như một lần bấm.
const DRAG_THRESHOLD_PX = 5;

interface DragState {
    pointerId: number;
    from: SquareName;
    pieceId: string;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
    isDragging: boolean;
}

// Bàn cờ 8x8 kèm tọa độ ở rìa, co giãn theo chiều rộng màn hình (lưới CSS Grid
// theo tỉ lệ thay vì kích thước ô cố định) để không tràn trên điện thoại.
// Quân cờ nằm ở một lớp phủ định vị tuyệt đối riêng (PieceSprite) để có thể
// trượt mượt qua các ô khi di chuyển. Lớp phủ này KHÔNG phải grid item (tránh
// việc nó "chiếm chỗ" cả vùng 8x8 khiến 64 ô auto-placement bị đẩy sai vị trí)
// mà định vị bằng inset khớp đúng với cột nhãn hàng/hàng nhãn cột.
//
// Đi quân bằng cả bấm (chọn quân rồi bấm ô đích) lẫn kéo thả. Cả hai đều quy về
// `onSquareClick` — nhấn xuống là "bấm" ô xuất phát, thả ra ở ô khác là "bấm" ô đích —
// nên mọi luật (lượt đi, premove, phong cấp) chỉ nằm ở một chỗ phía trên.
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
    hint,
    flipped = false,
    canDragFrom,
    squareBadge = null,
}: BoardProps) {
    const activeSelection = selectedSquare ?? premoveFrom;
    const ranks = flipped ? [...RANKS].reverse() : RANKS;
    const files = flipped ? [...FILES].reverse() : FILES;

    const overlayRef = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<DragState | null>(null);
    // Quân vừa được thả: đặt thẳng vào ô đích, không trượt từ ô xuất phát sang nữa
    // (nó đã "bay" theo con trỏ tới đó rồi).
    const [droppedPieceId, setDroppedPieceId] = useState<string | null>(null);

    const isInteractive = canDragFrom !== undefined;

    const squareAtPoint = (clientX: number, clientY: number): SquareName | null => {
        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
        const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return coordsToSquare(row, col, flipped);
    };

    const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!isInteractive || e.button !== 0) return;
        const square = squareAtPoint(e.clientX, e.clientY);
        if (!square) return;

        setDroppedPieceId(null);
        onSquareClick(square);

        const piece = pieces.find((p) => p.square === square && !p.effect);
        if (!piece || !canDragFrom(square)) return;

        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({
            pointerId: e.pointerId,
            from: square,
            pieceId: piece.id,
            startX: e.clientX,
            startY: e.clientY,
            dx: 0,
            dy: 0,
            isDragging: false,
        });
    };

    const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (drag?.pointerId !== e.pointerId) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const isDragging = drag.isDragging || Math.hypot(dx, dy) > DRAG_THRESHOLD_PX;
        setDrag({ ...drag, dx, dy, isDragging });
    };

    const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (drag?.pointerId !== e.pointerId) return;
        setDrag(null);
        if (!drag.isDragging) return;

        const target = squareAtPoint(e.clientX, e.clientY);
        if (target && target !== drag.from) {
            setDroppedPieceId(drag.pieceId);
            onSquareClick(target);
        }
    };

    const handlePointerCancel = () => setDrag(null);

    // Bàn phím (Tab + Enter/Space) vẫn đi quân được qua nút của từng ô. Click bằng
    // chuột/cảm ứng đã được xử lý ở pointerdown nên bỏ qua (`detail > 0`).
    const handleKeyboardClick = (square: SquareName) => (e: ReactMouseEvent) => {
        if (e.detail === 0) onSquareClick(square);
    };

    const draggedId = drag?.isDragging ? drag.pieceId : null;

    return (
        <div className={`relative w-full max-w-120 border-4 rounded-lg overflow-hidden shadow-2xl bg-slate-800 transition-colors duration-150 ${isCheckFlashing ? 'border-red-500 animate-board-shake' : 'border-slate-700'}`}>
            <div
                className={`grid grid-cols-[20px_repeat(8,minmax(0,1fr))] sm:grid-cols-[24px_repeat(8,minmax(0,1fr))] ${isInteractive ? 'touch-none' : ''}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
            >
                {ranks.map((rank, rowIndex) => (
                    <Fragment key={rank}>
                        <div className="flex items-center justify-center text-xs font-semibold text-slate-400">
                            {rank}
                        </div>
                        {files.map((file, colIndex) => {
                            const squareNotation = coordsToSquare(rowIndex, colIndex, flipped);

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
                                    isHintFrom={hint?.from === squareNotation}
                                    isHintTo={hint?.to === squareNotation}
                                    onClick={handleKeyboardClick(squareNotation)}
                                />
                            );
                        })}
                    </Fragment>
                ))}
                <div />
                {files.map((file) => (
                    <div key={file} className="h-5 sm:h-6 flex items-center justify-center text-xs font-semibold text-slate-400">
                        {file}
                    </div>
                ))}
            </div>

            <div ref={overlayRef} className="absolute left-5 sm:left-6 top-0 right-0 bottom-5 sm:bottom-6 pointer-events-none">
                {pieces.map((piece) => (
                    <PieceSprite
                        key={piece.id}
                        piece={piece}
                        isSelected={activeSelection === piece.square}
                        flipped={flipped}
                        dragOffset={piece.id === draggedId && drag ? { x: drag.dx, y: drag.dy } : null}
                        skipSlide={piece.id === droppedPieceId}
                    />
                ))}

                {squareBadge && (() => {
                    const { row, col } = squareToCoords(squareBadge.square, flipped);
                    return (
                        <div
                            className="absolute z-40"
                            style={{ left: `${(col + 1) * 12.5}%`, top: `${row * 12.5}%`, transform: 'translate(-85%, 8%)' }}
                        >
                            {squareBadge.content}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
