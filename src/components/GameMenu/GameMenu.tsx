import { useState } from 'react';
import type { GameSettings, GameMode, Difficulty, TimeControlMinutes } from '../../types/game';
import Button from '../ui/Button';
import OptionGroup from './OptionGroup';

const MODE_OPTIONS: { label: string; value: GameMode }[] = [
    { label: '2 người', value: 'pvp' },
    { label: 'Đấu với máy', value: 'pve' },
];

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
    readonly onStart: (settings: GameSettings) => void;
}

export default function GameMenu({ onStart }: GameMenuProps) {
    const [mode, setMode] = useState<GameMode>('pvp');
    const [difficulty, setDifficulty] = useState<Difficulty>('medium');
    const [timeControlMinutes, setTimeControlMinutes] = useState<TimeControlMinutes>(5);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
            <h1 className="text-3xl font-bold mb-8 tracking-wide text-slate-100">Chuong's Chess</h1>

            <div className="w-full max-w-sm bg-slate-800 rounded-xl shadow-2xl p-6 space-y-6">
                <OptionGroup label="Chế độ chơi" options={MODE_OPTIONS} value={mode} onChange={setMode} columns={2} />

                {mode === 'pve' && (
                    <OptionGroup label="Độ khó" options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} columns={3} />
                )}

                <OptionGroup label="Thời gian" options={TIME_OPTIONS} value={timeControlMinutes} onChange={setTimeControlMinutes} columns={3} />

                <Button variant="primary" size="lg" fullWidth onClick={() => onStart({ mode, difficulty, timeControlMinutes })}>
                    Bắt đầu
                </Button>
            </div>
        </div>
    );
}
