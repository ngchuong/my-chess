import { useState } from 'react';
import type { GameSettings, GameMode, Difficulty, TimeControlMinutes } from '../../types/game';

const TIME_OPTIONS: { label: string; value: TimeControlMinutes }[] = [
    { label: 'Không giới hạn', value: null },
    { label: '1 phút', value: 1 },
    { label: '3 phút', value: 3 },
    { label: '5 phút', value: 5 },
    { label: '10 phút', value: 10 },
    { label: '15 phút', value: 15 },
    { label: '30 phút', value: 30 },
];

const DIFFICULTY_OPTIONS: { label: string; value: Difficulty }[] = [
    { label: 'Dễ', value: 'easy' },
    { label: 'Trung bình', value: 'medium' },
    { label: 'Khó', value: 'hard' },
];

interface GameMenuProps {
    onStart: (settings: GameSettings) => void;
}

export default function GameMenu({ onStart }: GameMenuProps) {
    const [mode, setMode] = useState<GameMode>('pvp');
    const [difficulty, setDifficulty] = useState<Difficulty>('medium');
    const [timeControlMinutes, setTimeControlMinutes] = useState<TimeControlMinutes>(5);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
            <h1 className="text-3xl font-bold mb-8 tracking-wide text-slate-100">Cờ Vua</h1>

            <div className="w-full max-w-sm bg-slate-800 rounded-xl shadow-2xl p-6 space-y-6">
                <div>
                    <h2 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Chế độ chơi</h2>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setMode('pvp')}
                            className={`py-2.5 rounded-lg font-medium transition-colors cursor-pointer ${mode === 'pvp' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            2 người
                        </button>
                        <button
                            onClick={() => setMode('pve')}
                            className={`py-2.5 rounded-lg font-medium transition-colors cursor-pointer ${mode === 'pve' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            Đấu với máy
                        </button>
                    </div>
                </div>

                {mode === 'pve' && (
                    <div>
                        <h2 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Độ khó</h2>
                        <div className="grid grid-cols-3 gap-2">
                            {DIFFICULTY_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setDifficulty(opt.value)}
                                    className={`py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer ${difficulty === opt.value ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <h2 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Thời gian</h2>
                    <div className="grid grid-cols-3 gap-2">
                        {TIME_OPTIONS.map((opt) => (
                            <button
                                key={opt.label}
                                onClick={() => setTimeControlMinutes(opt.value)}
                                className={`py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer ${timeControlMinutes === opt.value ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={() => onStart({ mode, difficulty, timeControlMinutes })}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md transition-all active:scale-95 cursor-pointer text-lg"
                >
                    Bắt đầu
                </button>
            </div>
        </div>
    );
}
