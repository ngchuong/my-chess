import { useEffect, useState } from 'react';
import type { Chess } from 'chess.js';
import { HUMAN_COLOR } from '../lib/boardUtils';
import { HINT_MOVETIME_MS } from '../lib/engine/difficulty';
import { analyse } from '../lib/engine/stockfish';
import { buildHint, type MoveHint } from '../lib/moveHint';

interface HintState {
    fen: string;
    hint: MoveHint | null;
}

// Gợi ý nước đi tốt nhất cho người chơi, tính lại mỗi khi đến lượt họ (tức là ngay sau
// khi đối thủ vừa đi xong). Việc tìm kiếm nằm trong worker của Stockfish nên giao diện
// không bị treo; ở đây chỉ điều phối yêu cầu và ghép lời giải thích.
export function useMoveHint(game: Chess, enabled: boolean, isMatchOver: boolean) {
    const [result, setResult] = useState<HintState | null>(null);

    const fen = game.fen();
    const shouldHint = enabled && !isMatchOver && game.turn() === HUMAN_COLOR;

    useEffect(() => {
        if (!shouldHint) return;

        let cancelled = false;

        // MultiPV = 2 để biết phương án tốt nhì cách nước tốt nhất bao xa — nhờ đó nói
        // được "gần như là nước duy nhất". Cùng một lượt tìm kiếm nên không tốn thêm gì.
        analyse({ fen, movetimeMs: HINT_MOVETIME_MS, multipv: 2 })
            .then((analysis) => {
                if (cancelled) return;
                setResult({ fen, hint: buildHint(fen, analysis) });
            })
            .catch(() => {
                if (!cancelled) setResult({ fen, hint: null });
            });

        return () => {
            cancelled = true;
        };
    }, [fen, shouldHint]);

    // Chỉ dùng kết quả nếu nó thuộc đúng vị trí đang hiển thị: một gợi ý lệch vị trí
    // còn tệ hơn là không có gợi ý nào.
    const current = result?.fen === fen ? result : null;

    return {
        hint: shouldHint ? current?.hint ?? null : null,
        isHintLoading: shouldHint && current === null,
    };
}
