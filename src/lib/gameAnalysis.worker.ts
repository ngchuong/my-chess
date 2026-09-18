import { analyzeGame } from './gameAnalysis';
import type { MoveAnalysis, MoveRecord } from '../types/analysis';

interface AnalysisRequest {
    history: MoveRecord[];
}

// Tránh phụ thuộc lib "webworker" của TypeScript (xung đột với lib "DOM" của app
// chính) bằng cách chỉ khai báo đúng phần API cần dùng trên `self`.
const ctx = self as unknown as {
    onmessage: ((event: MessageEvent<AnalysisRequest>) => void) | null;
    postMessage: (message: MoveAnalysis[]) => void;
};

ctx.onmessage = (event) => {
    const { history } = event.data;
    ctx.postMessage(analyzeGame(history));
};
