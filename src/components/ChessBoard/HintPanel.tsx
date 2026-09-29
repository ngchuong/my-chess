import { formatEvalLabel, type MoveHint } from '../../lib/moveHint';

interface HintPanelProps {
    readonly hint: MoveHint | null;
    readonly isLoading: boolean;
}

// Điểm đánh giá đã quy về góc nhìn người chơi: dương là đang có lợi. Ngưỡng 0.5 tốt
// (~nửa con Tốt) là mức chênh lệch nhỏ, chưa đủ để gọi là bên nào hơn.
const EVEN_THRESHOLD = 50;

function evalToneClass(scoreForMover: number): string {
    if (scoreForMover > EVEN_THRESHOLD) return 'text-emerald-400';
    if (scoreForMover < -EVEN_THRESHOLD) return 'text-rose-400';
    return 'text-slate-300';
}

// Bảng gợi ý nước đi cho người chơi (chế độ đấu với máy). Chiều cao tối thiểu cố định
// để bàn cờ không bị nhảy lên xuống mỗi khi gợi ý xuất hiện/biến mất giữa các lượt.
export default function HintPanel({ hint, isLoading }: HintPanelProps) {
    return (
        <div className="w-full max-w-120 mt-3 min-h-18 bg-slate-800/60 border border-emerald-500/30 rounded-lg p-3 text-sm">
            {isLoading && <p className="text-slate-400 animate-pulse">Đang tìm nước tốt nhất cho bạn...</p>}

            {!isLoading && !hint && <p className="text-slate-500">Gợi ý sẽ hiện khi đến lượt bạn.</p>}

            {!isLoading && hint && (
                <div className="flex flex-col gap-1.5">
                    {hint.threatText && (
                        <p className="text-amber-300 text-xs">⚠ {hint.threatText}</p>
                    )}

                    <p className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-emerald-400 font-semibold">💡 Gợi ý: {hint.san}</span>
                        <span className="text-slate-500 text-xs">({hint.from} → {hint.to})</span>
                        <span className={`text-xs font-mono ${evalToneClass(hint.scoreForMover)}`}>
                            thế cờ sau nước này: {formatEvalLabel(hint.scoreForMover)}
                        </span>
                    </p>

                    <ul className="text-slate-300 text-xs space-y-0.5">
                        {hint.reasons.map((reason) => (
                            <li key={reason}>• {reason}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
