import { useEffect, useRef } from 'react';
import type { MoveAnalysis, MoveRecord } from '../../types/analysis';
import QualityBadge from './QualityBadge';

interface MoveListProps {
    readonly moveHistory: readonly MoveRecord[];
    readonly analysis?: readonly (MoveAnalysis | undefined)[];
    readonly ply: number;
    // Bỏ trống = chỉ để xem (danh sách nước trong lúc đang chơi), các ô không bấm được.
    readonly onSelectPly?: (ply: number) => void;
}

interface MoveCellProps {
    readonly record: MoveRecord;
    readonly quality: MoveAnalysis['quality'] | undefined;
    readonly ply: number;
    readonly isActive: boolean;
    readonly onSelectPly?: (ply: number) => void;
}

function MoveCell({ record, quality, ply, isActive, onSelectPly }: MoveCellProps) {
    const isClickable = onSelectPly !== undefined;
    let stateClasses = 'text-slate-300';
    if (isActive) stateClasses = 'bg-emerald-600/30 text-white';
    else if (isClickable) stateClasses = 'text-slate-300 hover:bg-slate-700/60';

    return (
        <button
            onClick={() => onSelectPly?.(ply)}
            disabled={!isClickable}
            data-active={isActive || undefined}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-left text-sm touch-manipulation ${isClickable ? 'cursor-pointer' : 'cursor-default'} ${stateClasses}`}
        >
            <span className="truncate">{record.san}</span>
            {quality && <QualityBadge quality={quality} size="sm" className="ml-auto" />}
        </button>
    );
}

// Danh sách nước đi 2 cột (Trắng | Đen), mỗi ô là một nút để nhảy nhanh tới vị trí
// ngay sau nước đó. Huy hiệu (!!, !, ★, ?, ??...) thể hiện chất lượng nước đi một khi đã
// phân tích xong.
export default function MoveList({ moveHistory, analysis = [], ply, onSelectPly }: MoveListProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Giữ nước đang chọn (hoặc nước mới nhất khi đang chơi) luôn trong tầm nhìn. Tự chỉnh
    // scrollTop của khung thay vì scrollIntoView, vì scrollIntoView có thể cuộn cả trang.
    useEffect(() => {
        const container = containerRef.current;
        const active = container?.querySelector<HTMLElement>('[data-active]');
        if (!container || !active) return;

        // Khung có `relative` nên offsetTop của ô được tính từ chính khung này.
        const top = active.offsetTop;
        const bottom = top + active.offsetHeight;
        if (top < container.scrollTop) container.scrollTop = top;
        else if (bottom > container.scrollTop + container.clientHeight) container.scrollTop = bottom - container.clientHeight;
    }, [ply, moveHistory.length]);

    const rows: { moveNumber: number; white: MoveRecord; whitePly: number; black?: MoveRecord; blackPly: number }[] = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
        rows.push({
            moveNumber: moveHistory[i].moveNumber,
            white: moveHistory[i],
            whitePly: i + 1,
            black: moveHistory[i + 1],
            blackPly: i + 2,
        });
    }

    return (
        <div ref={containerRef} className="relative flex flex-col gap-0.5 overflow-y-auto max-h-full pr-1">
            {rows.map((row) => (
                <div key={row.moveNumber} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1">
                    <span className="text-xs text-slate-500 text-right pr-1">{row.moveNumber}.</span>
                    <MoveCell
                        record={row.white}
                        quality={analysis[row.whitePly - 1]?.quality}
                        ply={row.whitePly}
                        isActive={ply === row.whitePly}
                        onSelectPly={onSelectPly}
                    />
                    {row.black ? (
                        <MoveCell
                            record={row.black}
                            quality={analysis[row.blackPly - 1]?.quality}
                            ply={row.blackPly}
                            isActive={ply === row.blackPly}
                            onSelectPly={onSelectPly}
                        />
                    ) : (
                        <span />
                    )}
                </div>
            ))}
        </div>
    );
}
