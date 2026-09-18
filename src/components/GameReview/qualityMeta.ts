import type { MoveQuality } from '../../types/analysis';

export const QUALITY_LABELS: Record<MoveQuality, string> = {
    excellent: 'Xuất sắc',
    great: 'Tốt',
    normal: 'Bình thường',
    bad: 'Tệ',
};

export const QUALITY_TEXT_CLASSES: Record<MoveQuality, string> = {
    excellent: 'text-emerald-400',
    great: 'text-sky-400',
    normal: 'text-slate-400',
    bad: 'text-rose-400',
};

export const QUALITY_DOT_CLASSES: Record<MoveQuality, string> = {
    excellent: 'bg-emerald-400',
    great: 'bg-sky-400',
    normal: 'bg-slate-500',
    bad: 'bg-rose-500',
};
