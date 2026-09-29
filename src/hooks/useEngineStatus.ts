import { useEffect, useState } from 'react';
import { getEngine } from '../lib/engine/stockfish';

export type EngineStatus = 'loading' | 'ready' | 'error';

// Bắt đầu tải engine ngay khi vào ván PvE thay vì đợi đến lúc cần nước đi đầu tiên:
// lần đầu phải tải khoảng 1,8MB, làm sớm thì người chơi không phải chờ giữa ván.
// Trả về trạng thái để giao diện phân biệt "đang tải engine" với "đang tính nước đi".
export function useEngineStatus(enabled: boolean): EngineStatus {
    const [status, setStatus] = useState<EngineStatus>('loading');

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        setStatus('loading');

        getEngine().then(
            () => { if (!cancelled) setStatus('ready'); },
            () => { if (!cancelled) setStatus('error'); },
        );

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return status;
}
