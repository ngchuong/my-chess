import { useMemo } from 'react';
import { useGameReview } from '../../hooks/useGameReview';
import { piecesFromFen } from '../../lib/pieceTracking';
import { colorLabel } from '../../lib/boardUtils';
import type { MoveRecord } from '../../types/analysis';
import Button from '../ui/Button';
import Board from '../ChessBoard/Board';
import MoveList from './MoveList';
import { QUALITY_LABELS, QUALITY_TEXT_CLASSES } from './qualityMeta';

interface GameReviewProps {
    readonly moveHistory: readonly MoveRecord[];
    readonly onClose: () => void;
}

// Xem lại ván đấu vừa kết thúc: tua qua từng nước trên bàn cờ tĩnh, kèm engine tự
// chấm điểm mỗi nước (Tệ/Bình thường/Tốt/Xuất sắc) so với nước tốt nhất tìm được
// ở cùng vị trí. Phân tích chạy nền trong Web Worker nên không treo giao diện.
export default function GameReview({ moveHistory, onClose }: GameReviewProps) {
    const { analysis, isAnalyzing, ply, currentFen, currentMove, goToStart, goToEnd, goPrev, goNext, goTo } =
        useGameReview(moveHistory);

    const pieces = useMemo(() => piecesFromFen(currentFen), [currentFen]);
    const currentAnalysis = ply > 0 ? analysis[ply - 1] : undefined;

    // Đếm dần theo số nước đã được worker chấm điểm xong — hiện số tăng dần thay vì
    // đợi phân tích xong hết cả ván rồi mới hiện một lần.
    const summary = useMemo(() => {
        const analyzed = analysis.filter((m): m is NonNullable<typeof m> => m !== undefined);
        if (analyzed.length === 0) return null;
        return {
            excellent: analyzed.filter((m) => m.quality === 'excellent').length,
            great: analyzed.filter((m) => m.quality === 'great').length,
            normal: analyzed.filter((m) => m.quality === 'normal').length,
            bad: analyzed.filter((m) => m.quality === 'bad').length,
        };
    }, [analysis]);

    return (
        <div className="flex flex-col items-center min-h-screen bg-slate-900 text-white select-none p-4">
            <div className="flex items-center gap-3 mb-2 text-sm text-slate-400 w-full max-w-3xl justify-between">
                <span className="font-semibold text-slate-200">Xem lại ván đấu</span>
                <Button variant="secondary" size="sm" onClick={onClose}>
                    Đóng
                </Button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 w-full max-w-3xl items-start">
                <div className="flex flex-col items-center gap-2 w-full lg:w-auto">
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
                    />

                    <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={goToStart}>⏮</Button>
                        <Button variant="secondary" size="sm" onClick={goPrev}>◀</Button>
                        <Button variant="secondary" size="sm" onClick={goNext}>▶</Button>
                        <Button variant="secondary" size="sm" onClick={goToEnd}>⏭</Button>
                    </div>

                    <div className="h-6 text-sm text-center">
                        {currentMove && (
                            <span>
                                {colorLabel(currentMove.color)} đi {currentMove.san}
                                {currentAnalysis && (
                                    <>
                                        {' — '}
                                        <span className={QUALITY_TEXT_CLASSES[currentAnalysis.quality]}>
                                            {QUALITY_LABELS[currentAnalysis.quality]}
                                        </span>
                                        {currentAnalysis.quality !== 'excellent' && currentAnalysis.bestSan !== currentAnalysis.san && (
                                            <span className="text-slate-500"> (tốt nhất: {currentAnalysis.bestSan})</span>
                                        )}
                                    </>
                                )}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-3 w-full lg:w-64 bg-slate-800/60 border border-slate-700 rounded-lg p-3 max-h-100">
                    {isAnalyzing && (
                        <p className="text-sm text-slate-400 text-center">Đang phân tích ván đấu...</p>
                    )}
                    {summary && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs justify-center border-b border-slate-700 pb-2">
                            <span className={QUALITY_TEXT_CLASSES.excellent}>Xuất sắc: {summary.excellent}</span>
                            <span className={QUALITY_TEXT_CLASSES.great}>Tốt: {summary.great}</span>
                            <span className={QUALITY_TEXT_CLASSES.normal}>Bình thường: {summary.normal}</span>
                            <span className={QUALITY_TEXT_CLASSES.bad}>Tệ: {summary.bad}</span>
                        </div>
                    )}
                    {moveHistory.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center">Ván đấu chưa có nước đi nào.</p>
                    ) : (
                        <MoveList moveHistory={moveHistory} analysis={analysis} ply={ply} onSelectPly={goTo} />
                    )}
                </div>
            </div>
        </div>
    );
}
