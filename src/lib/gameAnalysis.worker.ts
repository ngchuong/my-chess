import { analyzeMove } from './gameAnalysis';
import type { AnalysisProgressMessage, MoveRecord } from '../types/analysis';

interface AnalysisRequest {
    history: MoveRecord[];
}

// Tránh phụ thuộc lib "webworker" của TypeScript (xung đột với lib "DOM" của app
// chính) bằng cách chỉ khai báo đúng phần API cần dùng trên `self`.
const ctx = self as unknown as {
    onmessage: ((event: MessageEvent<AnalysisRequest>) => void) | null;
    postMessage: (message: AnalysisProgressMessage) => void;
};

// Gửi kết quả từng nước ngay khi tính xong thay vì đợi phân tích hết cả ván rồi mới
// gửi một lần — người xem thấy danh sách nước đi được chấm điểm dần thay vì phải
// chờ rồi thấy hiện ra cùng lúc.
ctx.onmessage = (event) => {
    const { history } = event.data;

    history.forEach((record, index) => {
        ctx.postMessage({ type: 'progress', index, result: analyzeMove(record) });
    });

    ctx.postMessage({ type: 'done' });
};
