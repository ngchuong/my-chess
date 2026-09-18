import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import type { MoveAnalysis, MoveRecord } from '../types/analysis';

const START_FEN = new Chess().fen();

// Chạy phân tích toàn bộ ván đấu (vừa kết thúc) trong Web Worker để không treo
// giao diện, đồng thời quản lý việc "tua" qua các nước để xem lại từng vị trí.
// `ply = 0` là vị trí xuất phát, `ply = n` là vị trí sau nước thứ n.
export function useGameReview(moveHistory: readonly MoveRecord[]) {
    const [analysis, setAnalysis] = useState<MoveAnalysis[] | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(true);
    const [ply, setPly] = useState(moveHistory.length);

    useEffect(() => {
        setIsAnalyzing(true);
        setAnalysis(null);

        if (moveHistory.length === 0) {
            setIsAnalyzing(false);
            return;
        }

        const worker = new Worker(new URL('../lib/gameAnalysis.worker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = (event: MessageEvent<MoveAnalysis[]>) => {
            setAnalysis(event.data);
            setIsAnalyzing(false);
        };
        worker.postMessage({ history: moveHistory });

        return () => worker.terminate();
    }, [moveHistory]);

    const goTo = (target: number) => setPly(Math.min(Math.max(target, 0), moveHistory.length));

    const currentFen = ply === 0 ? START_FEN : (moveHistory[ply - 1]?.fenAfter ?? START_FEN);
    const currentMove = ply === 0 ? null : moveHistory[ply - 1];

    return {
        analysis,
        isAnalyzing,
        ply,
        currentFen,
        currentMove,
        goToStart: () => goTo(0),
        goToEnd: () => goTo(moveHistory.length),
        goPrev: () => goTo(ply - 1),
        goNext: () => goTo(ply + 1),
        goTo,
    };
}
