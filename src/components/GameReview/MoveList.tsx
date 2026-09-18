import type { MoveAnalysis, MoveRecord } from '../../types/analysis';
import { QUALITY_DOT_CLASSES } from './qualityMeta';

interface MoveListProps {
    readonly moveHistory: readonly MoveRecord[];
    readonly analysis: readonly (MoveAnalysis | undefined)[];
    readonly ply: number;
    readonly onSelectPly: (ply: number) => void;
}

interface MoveCellProps {
    readonly record: MoveRecord;
    readonly quality: MoveAnalysis['quality'] | undefined;
    readonly ply: number;
    readonly isActive: boolean;
    readonly onSelectPly: (ply: number) => void;
}

function MoveCell({ record, quality, ply, isActive, onSelectPly }: MoveCellProps) {
    return (
        <button
            onClick={() => onSelectPly(ply)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-left text-sm touch-manipulation cursor-pointer ${isActive ? 'bg-emerald-600/30 text-white' : 'text-slate-300 hover:bg-slate-700/60'
                }`}
        >
            {quality && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${QUALITY_DOT_CLASSES[quality]}`} />}
            {record.san}
        </button>
    );
}

// Danh sách nước đi 2 cột (Trắng | Đen), mỗi ô là một nút để nhảy nhanh tới vị trí
// ngay sau nước đó. Chấm màu thể hiện chất lượng nước đi một khi đã phân tích xong.
export default function MoveList({ moveHistory, analysis, ply, onSelectPly }: MoveListProps) {
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
        <div className="flex flex-col gap-0.5 overflow-y-auto max-h-full pr-1">
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
