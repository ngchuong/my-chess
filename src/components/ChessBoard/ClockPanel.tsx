import { formatTime } from '../../lib/boardUtils';

interface ClockPanelProps {
    whiteTime: number | null;
    blackTime: number | null;
    turn: 'w' | 'b';
    isMatchOver: boolean;
}

export default function ClockPanel({ whiteTime, blackTime, turn, isMatchOver }: ClockPanelProps) {
    return (
        <div className="flex justify-between w-full max-w-xs sm:max-w-sm mb-3">
            <div className={`px-4 py-1.5 rounded-lg font-mono text-lg ${turn === 'b' && !isMatchOver ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                Đen: {formatTime(blackTime)}
            </div>
            <div className={`px-4 py-1.5 rounded-lg font-mono text-lg ${turn === 'w' && !isMatchOver ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                Trắng: {formatTime(whiteTime)}
            </div>
        </div>
    );
}
