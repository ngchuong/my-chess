import { computeMoveHint, type MoveHintResponse } from './moveHint';

interface MoveHintRequest {
    fen: string;
}

// Worker riêng cho gợi ý (không dùng chung với chessAI.worker) để hai việc tìm kiếm
// không phải xếp hàng chờ nhau: máy tính nước đi của nó trong khi gợi ý cho người chơi
// vẫn được tính song song.
// Tránh phụ thuộc lib "webworker" của TypeScript (xung đột với lib "DOM" của app chính)
// bằng cách chỉ khai báo đúng phần API cần dùng trên `self`.
const ctx = self as unknown as {
    onmessage: ((event: MessageEvent<MoveHintRequest>) => void) | null;
    postMessage: (message: MoveHintResponse) => void;
};

ctx.onmessage = (event) => {
    const { fen } = event.data;
    ctx.postMessage({ fen, hint: computeMoveHint(fen) });
};
