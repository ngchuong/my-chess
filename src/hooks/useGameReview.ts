import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { analyzeGame } from '../lib/gameAnalysis';
import { stopSearch } from '../lib/engine/stockfish';
import type { MoveAnalysis, MoveRecord } from '../types/analysis';

const START_FEN = new Chess().fen();

// Chấm điểm toàn bộ ván đấu vừa kết thúc bằng Stockfish (chạy trong worker của engine
// nên không treo giao diện), đồng thời quản lý việc "tua" qua các nước để xem lại từng
// vị trí. `ply = 0` là vị trí xuất phát, `ply = n` là vị trí sau nước thứ n. Mở màn hình
// xem lại ở nước đi đầu tiên (ply = 1) thay vì vị trí cuối ván, vì đó là nơi người xem
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
        let active = true;

        analyzeGame(
            moveHistory,
            (index, result) => {
                if (!active) return;
                setAnalysis((prev) => {
                    const next = [...prev];
                    next[index] = result;
                    return next;
                });
            },
            () => active,
        ).finally(() => {
            if (active) setIsAnalyzing(false);
        });

        return () => {
            active = false;
            // Rời màn hình xem lại giữa chừng: cắt luôn lượt tìm kiếm đang chạy để
            // không đốt CPU và để các yêu cầu khác được phục vụ ngay.
            stopSearch();
        };
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
