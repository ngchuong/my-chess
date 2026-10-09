import type { MoveQuality } from '../../types/analysis';
import { QUALITY_BADGE_CLASSES, QUALITY_LABELS, QUALITY_SYMBOLS } from './qualityMeta';

interface QualityBadgeProps {
    readonly quality: MoveQuality;
    readonly size?: 'sm' | 'md' | 'lg';
    readonly className?: string;
}

const SIZE_CLASSES = {
    sm: 'w-4 h-4 text-[9px]',
    md: 'w-5 h-5 text-[11px]',
    lg: 'w-7 h-7 text-sm',
};

// Huy hiệu tròn có ký hiệu cho một mức đánh giá nước đi (!!, !, ★, ?, ??...).
export default function QualityBadge({ quality, size = 'md', className = '' }: QualityBadgeProps) {
    return (
        <span
            title={QUALITY_LABELS[quality]}
            aria-label={QUALITY_LABELS[quality]}
            className={`inline-flex items-center justify-center rounded-full shrink-0 font-bold leading-none text-white shadow ring-1 ring-black/20 ${SIZE_CLASSES[size]} ${QUALITY_BADGE_CLASSES[quality]} ${className}`}
        >
            {QUALITY_SYMBOLS[quality]}
        </span>
    );
}
