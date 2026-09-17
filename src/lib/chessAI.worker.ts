import { Chess } from 'chess.js';
import { getAIMove } from './chessAI';
import type { Difficulty } from '../types/game';

interface AIWorkerRequest {
    fen: string;
    difficulty: Difficulty;
}

interface AIWorkerMove {
    from: string;
    to: string;
    promotion?: string;
    san: string;
    color: 'w' | 'b';
}

// Tránh phụ thuộc lib "webworker" của TypeScript (xung đột với lib "DOM" của app
// chính) bằng cách chỉ khai báo đúng phần API cần dùng trên `self`.
const ctx = self as unknown as {
    onmessage: ((event: MessageEvent<AIWorkerRequest>) => void) | null;
    postMessage: (message: AIWorkerMove | null) => void;
};

ctx.onmessage = (event) => {
    const { fen, difficulty } = event.data;
    const game = new Chess(fen);
    const move = getAIMove(game, difficulty);

    if (!move) {
        ctx.postMessage(null);
        return;
    }

    ctx.postMessage({
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        san: move.san,
        color: move.color,
    });
};
