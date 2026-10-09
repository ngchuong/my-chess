import { MATE_THRESHOLD_CP } from '../../lib/engine/stockfish';
import { winChance } from '../../lib/gameAnalysis';

interface EvalBarProps {
    // Đánh giá theo góc nhìn Trắng.
    readonly evalCp: number;
    readonly evalMate: number | null;
    readonly flipped: boolean;
}

// Thanh đánh giá dọc cạnh bàn cờ: phần trắng/đen tỉ lệ theo cơ hội thắng của mỗi bên
// (không theo centipawn thô — hơn 10 hay 20 Tốt thì thanh đều gần đầy, đúng với thực tế
// là ván đã ngã ngũ). Phía của mỗi màu khớp với phía quân màu đó trên bàn cờ.
export default function EvalBar({ evalCp, evalMate, flipped }: EvalBarProps) {
    const whitePercent = winChance(evalCp);
    // Kiểu nhãn quen thuộc của lichess/chess.com: "M3" là chiếu hết sau 3 nước, còn lại
    // là số Tốt đang hơn; "#" là ván đã kết thúc bằng chiếu hết.
    let label = (Math.abs(evalCp) / 100).toFixed(1);
    if (evalMate !== null && evalMate !== 0) label = `M${Math.abs(evalMate)}`;
    else if (Math.abs(evalCp) >= MATE_THRESHOLD_CP) label = '#';
    const isWhiteBetter = evalMate !== null && evalMate !== 0 ? evalMate > 0 : evalCp >= 0;
    // Nhãn nằm ở đầu thanh thuộc về bên đang hơn.
    const labelAtBottom = isWhiteBetter !== flipped;

    return (
        <div className={`relative w-5 sm:w-6 self-stretch rounded overflow-hidden bg-slate-950 flex ${flipped ? 'flex-col' : 'flex-col-reverse'}`}>
            <div className="bg-slate-100 transition-all duration-500 ease-out" style={{ height: `${whitePercent}%` }} />
            <span
                className={`absolute left-0 right-0 text-center text-[9px] sm:text-[10px] font-bold ${labelAtBottom ? 'bottom-1' : 'top-1'} ${isWhiteBetter ? 'text-slate-900' : 'text-slate-100'}`}
            >
                {label}
            </span>
        </div>
    );
}
