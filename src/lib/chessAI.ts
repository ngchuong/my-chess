import { Chess, type Move } from 'chess.js';
import type { Difficulty } from '../types/game';

const PIECE_VALUES: Record<string, number> = {
    p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Bảng điểm vị trí (piece-square tables) — khuyến khích AI kiểm soát trung tâm,
// phát triển quân sớm và giữ vua an toàn, thay vì chỉ tính vật chất.
// Nguồn: bảng đánh giá đơn giản hoá kiểu Tomasz Michniewski, hàng đầu tiên = hàng 8 (góc nhìn của Trắng).
const PAWN_TABLE = [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
];

const KNIGHT_TABLE = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
];

const BISHOP_TABLE = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
];

const ROOK_TABLE = [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
];

const QUEEN_TABLE = [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
];

const KING_MIDDLE_TABLE = [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
];

const PIECE_SQUARE_TABLES: Record<string, number[]> = {
    p: PAWN_TABLE, n: KNIGHT_TABLE, b: BISHOP_TABLE, r: ROOK_TABLE, q: QUEEN_TABLE, k: KING_MIDDLE_TABLE,
};

// Độ sâu tối đa mỗi mức — tìm kiếm sâu dần (iterative deepening) trong giới hạn
// thời gian dưới đây nên độ sâu này chỉ đạt được ở những vị trí đơn giản, "yên tĩnh".
const MAX_DEPTH_BY_DIFFICULTY: Record<Difficulty, number> = {
    easy: 2,
    medium: 3,
    hard: 5,
};

// Giới hạn thời gian "suy nghĩ" (ms) — đảm bảo AI không bao giờ treo UI quá lâu
// dù gặp vị trí phức tạp nhiều nước bắt quân.
const TIME_BUDGET_MS_BY_DIFFICULTY: Record<Difficulty, number> = {
    easy: 300,
    medium: 700,
    hard: 1500,
};

const RANDOM_MOVE_CHANCE: Record<Difficulty, number> = {
    easy: 0.2,
    medium: 0,
    hard: 0,
};

const QUIESCENCE_MAX_DEPTH = 3;
// Chỉ xét N nước bắt quân giá trị cao nhất ở mỗi tầng quiescence, tránh nổ nhánh
// khi vị trí có quá nhiều quân đang "treo" nhau.
const QUIESCENCE_MAX_CAPTURES_PER_NODE = 4;

interface SearchContext {
    deadline: number;
    aborted: boolean;
}

function isOutOfTime(ctx: SearchContext): boolean {
    if (ctx.aborted) return true;
    if (Date.now() >= ctx.deadline) {
        ctx.aborted = true;
        return true;
    }
    return false;
}

// Áp dụng nước đi bằng object {from,to,promotion} thay vì chuỗi SAN — chess.js
// không cần chạy lại thuật toán khử nhập nhằng ký hiệu SAN, nhanh hơn đáng kể
// khi phải make/unmake hàng chục nghìn lần trong quá trình tìm kiếm.
function applyMove(game: Chess, move: Move): Move {
    return game.move({ from: move.from, to: move.to, promotion: move.promotion });
}

function pieceSquareValue(type: string, color: 'w' | 'b', squareIndex: number): number {
    const table = PIECE_SQUARE_TABLES[type];
    // Bảng viết theo góc nhìn của Trắng (hàng 8 trước); quân Đen dùng bảng lật ngược.
    const index = color === 'w' ? squareIndex : 63 - squareIndex;
    return table[index];
}

function evaluateBoard(game: Chess): number {
    let score = 0;
    const board = game.board();
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = board[row][col];
            if (!square) continue;
            const squareIndex = row * 8 + col;
            const value = PIECE_VALUES[square.type] + pieceSquareValue(square.type, square.color, squareIndex);
            score += square.color === 'w' ? value : -value;
        }
    }
    return score;
}

// Ưu tiên xét nước bắt quân trước (MVV-LVA) và nước thăng cấp, giúp alpha-beta
// cắt nhánh hiệu quả hơn nhiều so với thứ tự ngẫu nhiên của chess.js.
function orderMoves(moves: Move[]): Move[] {
    const scoreOf = (move: Move) => {
        let score = 0;
        if (move.captured) {
            score += (PIECE_VALUES[move.captured] ?? 0) * 10 - (PIECE_VALUES[move.piece] ?? 0);
        }
        if (move.promotion) score += PIECE_VALUES[move.promotion] ?? 0;
        return score;
    };
    return [...moves].sort((a, b) => scoreOf(b) - scoreOf(a));
}

// Tìm tiếp các nước bắt quân đến khi vị trí "yên tĩnh" để tránh hiệu ứng đường chân trời
// (ví dụ: không thấy quân vừa ăn được sẽ bị ăn lại ngay sau đó). Chỉ xét một số ít
// nước bắt quân giá trị cao nhất ở mỗi tầng để tránh nổ nhánh ở vị trí nhiều quân treo.
function quiescence(game: Chess, alpha: number, beta: number, maximizing: boolean, depth: number, ctx: SearchContext): number {
    if (isOutOfTime(ctx)) return evaluateBoard(game);

    const standPat = evaluateBoard(game);

    if (maximizing) {
        if (standPat >= beta) return beta;
        alpha = Math.max(alpha, standPat);
    } else {
        if (standPat <= alpha) return alpha;
        beta = Math.min(beta, standPat);
    }

    if (depth >= QUIESCENCE_MAX_DEPTH) return standPat;

    const captures = orderMoves((game.moves({ verbose: true }) as Move[]).filter((m) => m.captured))
        .slice(0, QUIESCENCE_MAX_CAPTURES_PER_NODE);

    for (const move of captures) {
        applyMove(game, move);
        const score = quiescence(game, alpha, beta, !maximizing, depth + 1, ctx);
        game.undo();

        if (maximizing) {
            alpha = Math.max(alpha, score);
            if (alpha >= beta) break;
        } else {
            beta = Math.min(beta, score);
            if (beta <= alpha) break;
        }

        if (ctx.aborted) break;
    }

    return maximizing ? alpha : beta;
}

function minimax(game: Chess, depth: number, alpha: number, beta: number, maximizing: boolean, ctx: SearchContext): number {
    if (isOutOfTime(ctx)) return evaluateBoard(game);
    if (game.isCheckmate()) return maximizing ? -100000 - depth : 100000 + depth;
    if (game.isDraw() || game.isStalemate()) return 0;
    if (depth === 0) return quiescence(game, alpha, beta, maximizing, 0, ctx);

    const moves = orderMoves(game.moves({ verbose: true }) as Move[]);
    let best = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
        applyMove(game, move);
        const score = minimax(game, depth - 1, alpha, beta, !maximizing, ctx);
        game.undo();

        if (maximizing) {
            best = Math.max(best, score);
            alpha = Math.max(alpha, score);
        } else {
            best = Math.min(best, score);
            beta = Math.min(beta, score);
        }
        if (beta <= alpha) break;
        if (ctx.aborted) break;
    }

    return best;
}

// Tìm nước đi tốt nhất ở một độ sâu cố định; trả về null nếu bị ngắt giữa chừng vì hết giờ.
function searchAtDepth(game: Chess, depth: number, orderedMoves: Move[], maximizing: boolean, ctx: SearchContext): Move | null {
    let bestMove: Move | null = null;
    let bestScore = maximizing ? -Infinity : Infinity;

    for (const move of orderedMoves) {
        applyMove(game, move);
        const score = minimax(game, depth - 1, -Infinity, Infinity, !maximizing, ctx);
        game.undo();

        if (ctx.aborted) return null;

        if (bestMove === null || (maximizing ? score > bestScore : score < bestScore)) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

// Trả về nước đi AI chọn cho bên đang tới lượt trong `game`. Dùng tìm kiếm sâu dần
// (iterative deepening) trong một giới hạn thời gian để độ trễ luôn ổn định, bất kể
// vị trí đơn giản hay phức tạp (nhiều nước bắt quân sẽ khiến tìm kiếm sâu hơn chậm hẳn).
export function getAIMove(game: Chess, difficulty: Difficulty): Move | null {
    const moves = game.moves({ verbose: true }) as Move[];
    if (moves.length === 0) return null;

    if (Math.random() < RANDOM_MOVE_CHANCE[difficulty]) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    const maxDepth = MAX_DEPTH_BY_DIFFICULTY[difficulty];
    const deadline = Date.now() + TIME_BUDGET_MS_BY_DIFFICULTY[difficulty];
    const maximizing = game.turn() === 'w';
    const orderedMoves = orderMoves(moves);

    let bestMove: Move = orderedMoves[0];

    for (let depth = 1; depth <= maxDepth; depth++) {
        const ctx: SearchContext = { deadline, aborted: false };
        const moveAtDepth = searchAtDepth(game, depth, orderedMoves, maximizing, ctx);
        if (moveAtDepth === null) break;

        bestMove = moveAtDepth;
        if (Date.now() >= deadline) break;
    }

    return bestMove;
}
