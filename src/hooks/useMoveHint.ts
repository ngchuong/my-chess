import { useEffect, useRef, useState } from 'react';
import type { Chess } from 'chess.js';
import { HUMAN_COLOR } from '../lib/boardUtils';
import type { MoveHintResponse } from '../lib/moveHint';

// Gợi ý nước đi tốt nhất cho người chơi, tính lại mỗi khi đến lượt họ (tức là ngay
// sau khi đối thủ vừa đi xong). Chạy trong Web Worker nên phần tìm kiếm không làm treo
// giao diện — người chơi vẫn di chuyển quân được trong lúc gợi ý đang được tính.
export function useMoveHint(game: Chess, enabled: boolean, isMatchOver: boolean) {
    const workerRef = useRef<Worker | null>(null);
    const [result, setResult] = useState<MoveHintResponse | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const worker = new Worker(new URL('../lib/moveHint.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        return () => {
            worker.terminate();
            workerRef.current = null;
        };
    }, [enabled]);

    const fen = game.fen();
    const shouldHint = enabled && !isMatchOver && game.turn() === HUMAN_COLOR;

    useEffect(() => {
        const worker = workerRef.current;
        if (!worker || !shouldHint) return;

        const handleMessage = (event: MessageEvent<MoveHintResponse>) => setResult(event.data);

        worker.addEventListener('message', handleMessage);
        worker.postMessage({ fen });

        return () => {
            worker.removeEventListener('message', handleMessage);
        };
    }, [fen, shouldHint]);

    // Chỉ dùng kết quả nếu nó thuộc đúng vị trí đang hiển thị: worker xử lý tuần tự nên
    // kết quả của một vị trí cũ có thể về sau khi bàn cờ đã sang nước khác, và một gợi
    // ý lệch vị trí thì tệ hơn là không có gợi ý nào.
    const current = result?.fen === fen ? result : null;

    return {
        hint: shouldHint ? current?.hint ?? null : null,
        isHintLoading: shouldHint && current === null,
    };
}
