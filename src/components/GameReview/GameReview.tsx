import { useEffect, useMemo } from 'react';
import { useGameReview } from '../../hooks/useGameReview';
import { piecesFromFen } from '../../lib/pieceTracking';
import { colorLabel } from '../../lib/boardUtils';
import { moveAccuracy } from '../../lib/gameAnalysis';
import { formatEvalLabel } from '../../lib/moveHint';
import { MOVE_QUALITIES, type MoveAnalysis, type MoveRecord } from '../../types/analysis';
import type { PieceColor } from '../../types/chess';
import Button from '../ui/Button';
import Board from '../ChessBoard/Board';
import EvalBar from './EvalBar';
import MoveList from './MoveList';
import QualityBadge from './QualityBadge';
import { QUALITY_DESCRIPTIONS, QUALITY_LABELS, QUALITY_TEXT_CLASSES } from './qualityMeta';

interface GameReviewProps {
    readonly moveHistory: readonly MoveRecord[];
    readonly onClose: () => void;
    readonly flipped?: boolean;
}

const COLORS: readonly PieceColor[] = ['w', 'b'];

// Các mức "chất lượng xấu" — khi đó mới gợi ý nước tốt nhất, còn nước tốt thì không cần.
const SHOW_BEST_FOR = new Set(['inaccuracy', 'mistake', 'miss', 'blunder', 'good', 'excellent']);

function CurrentMoveDetail({ move, analysis }: { readonly move: MoveRecord | null; readonly analysis: MoveAnalysis | undefined }) {
    if (!move) return <p className="text-sm text-slate-500">Vị trí xuất phát — bấm ▶ hoặc phím → để xem nước đầu tiên.</p>;

    if (!analysis) {
        return (
            <p className="text-sm text-slate-300">
                {colorLabel(move.color)} đi <span className="font-semibold">{move.san}</span>
                <span className="text-slate-500 animate-pulse"> — đang phân tích...</span>
            </p>
        );
    }

    // Đánh giá lưu theo góc nhìn Trắng — đổi về góc nhìn bên vừa đi.
    const sign = move.color === 'w' ? 1 : -1;
    const evalCp = sign * analysis.evalCp;
    const evalMate = analysis.evalMate === null ? null : sign * analysis.evalMate;

    return (
        <div className="flex items-start gap-3">
            <QualityBadge quality={analysis.quality} size="lg" />
            <div className="flex flex-col gap-0.5 text-sm min-w-0">
                <p>
                    <span className="font-semibold text-slate-100">{move.moveNumber}{move.color === 'w' ? '.' : '...'} {move.san}</span>
                    {' là '}
                    <span className={`font-semibold ${QUALITY_TEXT_CLASSES[analysis.quality]}`}>{QUALITY_LABELS[analysis.quality]}</span>
                </p>
                <p className="text-slate-400 text-xs">{QUALITY_DESCRIPTIONS[analysis.quality]}</p>
                {SHOW_BEST_FOR.has(analysis.quality) && analysis.bestSan !== analysis.san && (
                    <p className="text-xs text-slate-300">
                        Nước tốt nhất: <span className="font-semibold text-[#95c75f]">{analysis.bestSan}</span>
                    </p>
                )}
                <p className="text-xs text-slate-500 font-mono">
                    Thế cờ cho {colorLabel(move.color)}: {formatEvalLabel(evalCp, evalMate)}
                </p>
            </div>
        </div>
    );
}

// Xem lại ván đấu vừa kết thúc: tua qua từng nước trên bàn cờ tĩnh, kèm engine tự
// chấm điểm mỗi nước (từ Thiên tài tới Nước hớ) theo cơ hội thắng bị mất so với nước
// tốt nhất tìm được ở cùng vị trí. Phân tích chạy nền trong Web Worker nên không treo
// giao diện, và kết quả hiện dần theo từng nước.
export default function GameReview({ moveHistory, onClose, flipped = false }: GameReviewProps) {
    const { analysis, isAnalyzing, ply, currentFen, currentMove, goToStart, goToEnd, goPrev, goNext, goTo } =
        useGameReview(moveHistory);

    const pieces = useMemo(() => piecesFromFen(currentFen), [currentFen]);
    const currentAnalysis = ply > 0 ? analysis[ply - 1] : undefined;
    const analyzedCount = analysis.filter(Boolean).length;

    // Phím ←/→ để tua, Home/End để về đầu/cuối — nhanh hơn bấm nút nhiều khi xem lại cả ván.
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            const actions: Record<string, () => void> = { ArrowLeft: goPrev, ArrowRight: goNext, Home: goToStart, End: goToEnd };
            const action = actions[e.key];
            if (!action) return;
            e.preventDefault();
            action();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [goPrev, goNext, goToStart, goToEnd]);

    // Đếm dần theo số nước đã được engine chấm điểm xong — hiện số tăng dần thay vì
    // đợi phân tích xong hết cả ván rồi mới hiện một lần. Tách riêng từng bên, vì gộp
    // nước của người chơi với nước của máy thì con số không nói lên điều gì.
    const summary = useMemo(() => {
        const analyzed = analysis.filter((m): m is MoveAnalysis => m !== undefined);
        if (analyzed.length === 0) return null;

        const forColor = (color: PieceColor) => {
            const moves = analyzed.filter((m) => m.color === color);
            const accuracy = moves.length === 0
                ? null
                : moves.reduce((sum, m) => sum + moveAccuracy(m.winChanceLoss), 0) / moves.length;
            const counts = Object.fromEntries(MOVE_QUALITIES.map((q) => [q, moves.filter((m) => m.quality === q).length]));
            return { accuracy, counts };
        };
        return { w: forColor('w'), b: forColor('b') };
    }, [analysis]);

    // Thanh đánh giá: vị trí xuất phát coi như cân bằng; nước chưa phân tích xong thì giữ
    // giá trị gần nhất đã có để thanh không giật về 0.
    const evalSource = analysis.slice(0, ply).findLast((m): m is MoveAnalysis => m !== undefined);

    return (
        <div className="flex flex-col items-center min-h-screen bg-slate-900 text-white select-none p-4">
            <div className="flex items-center gap-3 mb-3 text-sm text-slate-400 w-full max-w-4xl justify-between">
                <span className="font-semibold text-slate-200">Xem lại ván đấu</span>
                <Button variant="secondary" size="sm" onClick={onClose}>
                    Đóng
                </Button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 w-full max-w-4xl items-center lg:items-start justify-center">
                <div className="flex flex-col items-center gap-3 w-full max-w-lg">
                    <div className="flex gap-2 w-full">
                        <EvalBar evalCp={evalSource?.evalCp ?? 0} evalMate={evalSource?.evalMate ?? null} flipped={flipped} />
                        <Board
                            pieces={pieces}
                            onSquareClick={() => { }}
                            selectedSquare={null}
                            possibleMoves={[]}
                            lastMove={currentMove}
                            premoveFrom={null}
                            premove={null}
                            checkedKingSquare={null}
                            isCheckFlashing={false}
                            hint={null}
                            flipped={flipped}
                            squareBadge={currentMove && currentAnalysis
                                ? { square: currentMove.to, content: <QualityBadge quality={currentAnalysis.quality} size="md" /> }
                                : null}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={goToStart} aria-label="Về đầu ván">⏮</Button>
                        <Button variant="secondary" size="sm" onClick={goPrev} aria-label="Nước trước">◀</Button>
                        <Button variant="secondary" size="sm" onClick={goNext} aria-label="Nước sau">▶</Button>
                        <Button variant="secondary" size="sm" onClick={goToEnd} aria-label="Về cuối ván">⏭</Button>
                    </div>

                    {/* Chiều cao cố định để bàn cờ không nhảy khi lời giải thích dài/ngắn khác nhau. */}
                    <div className="w-full h-24 bg-slate-800/60 border border-slate-700 rounded-lg p-3 overflow-y-auto">
                        <CurrentMoveDetail move={currentMove} analysis={currentAnalysis} />
                    </div>
                </div>

                <div className="flex flex-col gap-3 w-full max-w-lg lg:w-80 bg-slate-800/60 border border-slate-700 rounded-lg p-3 lg:h-150">
                    {isAnalyzing && (
                        <div className="flex flex-col gap-1">
                            <p className="text-xs text-slate-400">Đang phân tích... {analyzedCount}/{moveHistory.length} nước</p>
                            <div className="h-1 rounded bg-slate-700 overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 transition-all"
                                    style={{ width: `${moveHistory.length === 0 ? 0 : (analyzedCount / moveHistory.length) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {summary && (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                {COLORS.map((color) => (
                                    <div key={color} className="bg-slate-900/60 rounded-lg p-2 text-center">
                                        <p className="text-xs text-slate-400">Độ chính xác — {colorLabel(color)}</p>
                                        <p className="text-2xl font-bold tabular-nums">
                                            {summary[color].accuracy === null ? '—' : summary[color].accuracy.toFixed(1)}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <table className="text-xs w-full">
                                <thead>
                                    <tr className="text-slate-500">
                                        <th />
                                        <th className="font-normal text-right w-10">{colorLabel('w')}</th>
                                        <th className="font-normal text-right w-10">{colorLabel('b')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MOVE_QUALITIES.map((quality) => (
                                        <tr key={quality} className={QUALITY_TEXT_CLASSES[quality]}>
                                            <td className="py-0.5">
                                                <span className="flex items-center gap-2">
                                                    <QualityBadge quality={quality} size="sm" />
                                                    {QUALITY_LABELS[quality]}
                                                </span>
                                            </td>
                                            <td className="text-right tabular-nums">{summary.w.counts[quality]}</td>
                                            <td className="text-right tabular-nums">{summary.b.counts[quality]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    <div className="flex-1 min-h-0 max-h-72 lg:max-h-none border-t border-slate-700 pt-2">
                        {moveHistory.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center">Ván đấu chưa có nước đi nào.</p>
                        ) : (
                            <MoveList moveHistory={moveHistory} analysis={analysis} ply={ply} onSelectPly={goTo} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
