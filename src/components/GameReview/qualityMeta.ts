import type { MoveQuality } from '../../types/analysis';

export const QUALITY_LABELS: Record<MoveQuality, string> = {
    best: 'Tốt nhất',
    excellent: 'Xuất sắc',
    good: 'Tốt',
    inaccuracy: 'Thiếu chính xác',
    mistake: 'Sai lầm',
    blunder: 'Nước hớ',
};

export const QUALITY_TEXT_CLASSES: Record<MoveQuality, string> = {
    best: 'text-emerald-400',
    excellent: 'text-green-400',
    good: 'text-sky-400',
    inaccuracy: 'text-yellow-400',
    mistake: 'text-orange-400',
    blunder: 'text-rose-400',
};

export const QUALITY_DOT_CLASSES: Record<MoveQuality, string> = {
    best: 'bg-emerald-400',
    excellent: 'bg-green-400',
    good: 'bg-sky-400',
    inaccuracy: 'bg-yellow-400',
    mistake: 'bg-orange-400',
    blunder: 'bg-rose-500',
};
