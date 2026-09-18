import type { PieceSymbol } from 'chess.js';
import { PIECE_IMAGES } from '../../lib/boardUtils';
import type { PieceColor } from '../../types/chess';

const PROMOTION_PIECES: readonly PieceSymbol[] = ['q', 'r', 'b', 'n'];

interface PromotionModalProps {
    readonly color: PieceColor;
    readonly onChoose: (piece: PieceSymbol) => void;
}

// Modal nhỏ, chỉ hiện lưới 2x2 gồm 4 quân có thể phong cấp — bật lên ngay khi tốt
// vừa đi tới hàng cuối, chặn các thao tác khác trên bàn cờ cho tới khi chọn xong.
export default function PromotionModal({ color, onChoose }: PromotionModalProps) {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-3 grid grid-cols-2 gap-2">
                {PROMOTION_PIECES.map((piece) => (
                    <button
                        key={piece}
                        onClick={() => onChoose(piece)}
                        className="bg-slate-700 hover:bg-slate-600 rounded-lg w-16 h-16 flex items-center justify-center transition-colors touch-manipulation cursor-pointer"
                    >
                        <img src={PIECE_IMAGES[color][piece]} alt={piece} className="w-11 h-11" draggable={false} />
                    </button>
                ))}
            </div>
        </div>
    );
}
