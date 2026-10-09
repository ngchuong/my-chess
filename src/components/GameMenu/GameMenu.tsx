import { useState } from 'react';
import { difficultyLabel } from '../../lib/engine/difficulty';
import type { PieceColor } from '../../types/chess';
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

// Nhãn kèm Elo để người chơi biết mình chọn mức nào — độ khó được đặt bằng UCI_Elo
// của Stockfish chứ không phải giới hạn độ sâu tìm kiếm.
const DIFFICULTY_OPTIONS: { label: string; value: Difficulty }[] = (['easy', 'medium', 'hard'] as const)
    .map((value) => ({ label: difficultyLabel(value), value }));

const HINT_OPTIONS: { label: string; value: boolean }[] = [
    { label: 'Bật', value: true },
    { label: 'Tắt', value: false },
];

type ColorChoice = PieceColor | 'random';

// Trắng luôn đi trước — chọn màu quân cũng chính là chọn đi trước hay đi sau.
const COLOR_OPTIONS: { label: string; value: ColorChoice }[] = [
    { label: 'Trắng (đi trước)', value: 'w' },
    { label: 'Đen (đi sau)', value: 'b' },
    { label: 'Ngẫu nhiên', value: 'random' },
];

const resolveColor = (choice: ColorChoice): PieceColor => {
    if (choice !== 'random') return choice;
    return Math.random() < 0.5 ? 'w' : 'b';
};

interface GameMenuProps {
    readonly onStart: (settings: GameSettings) => void;
}

export default function GameMenu({ onStart }: GameMenuProps) {
    const [mode, setMode] = useState<GameMode>('pvp');
    const [difficulty, setDifficulty] = useState<Difficulty>('medium');
    const [timeControlMinutes, setTimeControlMinutes] = useState<TimeControlMinutes>(5);
    const [showHints, setShowHints] = useState(true);
    const [colorChoice, setColorChoice] = useState<ColorChoice>('w');

    const handleStart = () => {
        onStart({ mode, difficulty, timeControlMinutes, showHints, playerColor: resolveColor(colorChoice) });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
            <h1 className="text-3xl font-bold mb-8 tracking-wide text-slate-100">Chuong's Chess</h1>

            <div className="w-full max-w-sm bg-slate-800 rounded-xl shadow-2xl p-6 space-y-6">
                <OptionGroup label="Chế độ chơi" options={MODE_OPTIONS} value={mode} onChange={setMode} columns={2} />

                {mode === 'pve' && (
                    <>
                        <OptionGroup label="Quân của bạn" options={COLOR_OPTIONS} value={colorChoice} onChange={setColorChoice} columns={3} />
                        <OptionGroup label="Độ khó" options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} columns={3} />
                        <OptionGroup label="Gợi ý nước đi" options={HINT_OPTIONS} value={showHints} onChange={setShowHints} columns={2} />
                    </>
                )}

                <OptionGroup label="Thời gian" options={TIME_OPTIONS} value={timeControlMinutes} onChange={setTimeControlMinutes} columns={3} />

                <Button variant="primary" size="lg" fullWidth onClick={handleStart}>
                    Bắt đầu
                </Button>
            </div>
        </div>
    );
}
