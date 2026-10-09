import type { PieceSymbol } from 'chess.js';
import { PIECE_IMAGES, formatTime, oppositeColor } from '../../lib/boardUtils';
import type { PieceColor } from '../../types/chess';

interface PlayerBarProps {
    readonly name: string;
    readonly color: PieceColor;
    readonly time: number | null;
    readonly isActive: boolean;
    // Quân đối phương bên này đã ăn được, và số điểm lực lượng đang hơn (0 = không hơn).
    readonly captured: readonly PieceSymbol[];
    readonly advantage: number;
}

// Một thanh thông tin người chơi đặt sát bàn cờ: tên, quân đã ăn, chênh lệch lực lượng
// và đồng hồ. Bên nào nằm phía nào của bàn cờ thì thanh của bên đó nằm phía đó, nên
// đồng hồ của người chơi luôn ở cạnh quân của họ (kể cả khi bàn cờ bị xoay).
// Chiều cao cố định để bàn cờ không nhảy khi danh sách quân bị ăn dài ra.
export default function PlayerBar({ name, color, time, isActive, captured, advantage }: PlayerBarProps) {
    const victimColor = oppositeColor(color);

    return (
        <div className="flex items-center justify-between gap-2 w-full max-w-120 h-10 my-1">
            <div className="flex items-center gap-2 min-w-0">
                <span className={`w-3 h-3 rounded-sm shrink-0 border border-slate-500 ${color === 'w' ? 'bg-slate-100' : 'bg-slate-950'}`} />
                <span className="text-sm font-semibold text-slate-200 shrink-0">{name}</span>
                <div className="flex items-center min-w-0 overflow-hidden">
                    {captured.map((type, i) => (
                        <img
                            key={`${type}-${i}`}
                            src={PIECE_IMAGES[victimColor][type]}
                            alt={type}
                            className={`w-4 h-4 shrink-0 ${i > 0 && captured[i - 1] === type ? '-ml-2' : ''}`}
                            draggable={false}
                        />
                    ))}
                    {advantage > 0 && <span className="ml-1 text-xs text-slate-400 shrink-0">+{advantage}</span>}
                </div>
            </div>
            <div className={`px-3 py-1 rounded-lg font-mono text-lg tabular-nums shrink-0 ${isActive ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                {formatTime(time)}
            </div>
        </div>
    );
}
