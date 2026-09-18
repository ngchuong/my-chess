import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import type { AnalysisProgressMessage, MoveAnalysis, MoveRecord } from '../types/analysis';

const START_FEN = new Chess().fen();

// Chạy phân tích toàn bộ ván đấu (vừa kết thúc) trong Web Worker để không treo
// giao diện, đồng thời quản lý việc "tua" qua các nước để xem lại từng vị trí.
// `ply = 0` là vị trí xuất phát, `ply = n` là vị trí sau nước thứ n. Mở màn hình xem
// lại ở nước đi đầu tiên (ply = 1) thay vì vị trí cuối ván, vì đó là nơi người xem
// thường muốn bắt đầu duyệt lại.
export function useGameReview(moveHistory: readonly MoveRecord[]) {
    const [analysis, setAnalysis] = useState<(MoveAnalysis | undefined)[]>(() => new Array(moveHistory.length));
    const [isAnalyzing, setIsAnalyzing] = useState(moveHistory.length > 0);
    const [ply, setPly] = useState(moveHistory.length > 0 ? 1 : 0);

    useEffect(() => {
        setAnalysis(new Array(moveHistory.length));

        if (moveHistory.length === 0) {
            setIsAnalyzing(false);
            return;
        }

        setIsAnalyzing(true);
        const worker = new Worker(new URL('../lib/gameAnalysis.worker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = (event: MessageEvent<AnalysisProgressMessage>) => {
            const message = event.data;
            if (message.type === 'done') {
                setIsAnalyzing(false);
                return;
            }
            setAnalysis((prev) => {
                const next = [...prev];
                next[message.index] = message.result;
                return next;
            });
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
