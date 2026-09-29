import { Chess, type Move } from 'chess.js';
import type { Difficulty } from '../types/game';

export const PIECE_VALUES: Record<string, number> = {
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

// Đổi ký hiệu ô ("e4") sang chỉ số 0..63 dùng trong các bảng điểm vị trí — cùng
// thứ tự với `game.board()`: ô 0 là a8, ô 63 là h1.
function squareIndexOf(square: string): number {
    const file = square.codePointAt(0)! - 'a'.codePointAt(0)!;
    const rank = Number(square[1]);
    return (8 - rank) * 8 + file;
}

// Chênh lệch điểm vị trí khi một quân đi từ ô này sang ô khác (dương = ô mới tốt hơn
// theo piece-square table). Dùng để giải thích một nước đi "im lặng" — không ăn quân,
// không chiếu — bằng đúng tiêu chí mà engine đã dùng để chấm nó.
export function pieceSquareGain(type: string, color: 'w' | 'b', from: string, to: string): number {
    return pieceSquareValue(type, color, squareIndexOf(to)) - pieceSquareValue(type, color, squareIndexOf(from));
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

interface ScoredMove {
    move: Move;
    // Điểm của vị trí sau nước đi, luôn theo góc nhìn của Trắng (dương = Trắng lợi).
    scoreWhite: number;
}

// Tìm nước đi tốt nhất ở một độ sâu cố định; trả về null nếu bị ngắt giữa chừng vì hết giờ.
//
// Cửa sổ alpha-beta được thu hẹp dần ngay tại tầng gốc: sau khi đã có một nước tốt nhất
// tạm thời, những nước sau chỉ cần trả lời "có hơn nước đó không" chứ không cần điểm
// chính xác. Nhờ vậy tìm kiếm nhanh hơn nhiều lần so với việc xét mỗi nước gốc bằng một
// cửa sổ đầy. Điểm của nước *được chọn* vẫn luôn chính xác (ở tầng gốc chỉ có thể
// fail-low, mà nước fail-low thì đã bị loại).
function searchAtDepth(game: Chess, depth: number, orderedMoves: Move[], maximizing: boolean, ctx: SearchContext): ScoredMove | null {
    let best: ScoredMove | null = null;
    let alpha = -Infinity;
    let beta = Infinity;

    for (const move of orderedMoves) {
        applyMove(game, move);
        const scoreWhite = minimax(game, depth - 1, alpha, beta, !maximizing, ctx);
        game.undo();

        if (ctx.aborted) return null;

        if (best === null || (maximizing ? scoreWhite > best.scoreWhite : scoreWhite < best.scoreWhite)) {
            best = { move, scoreWhite };
            if (maximizing) {
                alpha = scoreWhite;
            } else {
                beta = scoreWhite;
            }
        }
    }

    return best;
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
        const bestAtDepth = searchAtDepth(game, depth, orderedMoves, maximizing, ctx);
        if (bestAtDepth === null) break;

        bestMove = bestAtDepth.move;
        if (Date.now() >= deadline) break;
    }

    return bestMove;
}

export interface MoveEvaluation {
    moverColor: 'w' | 'b';
    bestScoreForMover: number;
    playedScoreForMover: number;
    bestSan: string;
    playedSan: string;
}

const ANALYSIS_TIME_BUDGET_MS = 2000;

// Chấm điểm mọi nước đi hợp lệ tại vị trí hiện tại ở một độ sâu cố định, mỗi nước bằng
// một cửa sổ alpha-beta đầy. Chậm hơn `searchAtDepth` (không cắt nhánh ở tầng gốc) nhưng
// bắt buộc phải như vậy khi cần điểm *chính xác* của từng nước — cụ thể là để tính
// centipawn loss của nước người chơi đã đi khi chấm điểm ván đấu.
function scoreMoves(game: Chess, depth: number, ctx: SearchContext): ScoredMove[] {
    const moves = orderMoves(game.moves({ verbose: true }) as Move[]);

    return moves.map((move) => {
        applyMove(game, move);
        const nextMaximizing = game.turn() === 'w';
        const scoreWhite = minimax(game, depth - 1, -Infinity, Infinity, nextMaximizing, ctx);
        game.undo();
        return { move, scoreWhite };
    });
}

function pickBestForMover(scored: ScoredMove[], moverColor: 'w' | 'b'): ScoredMove {
    return scored.reduce((best, current) => {
        const isBetter = moverColor === 'w' ? current.scoreWhite > best.scoreWhite : current.scoreWhite < best.scoreWhite;
        return isBetter ? current : best;
    }, scored[0]);
}

export interface BestMoveResult {
    move: Move;
    // Điểm của vị trí sau nước đi, quy về góc nhìn bên vừa đi (dương = bên đó có lợi).
    scoreForMover: number;
}

// Nước đi tốt nhất theo engine tại một vị trí, kèm điểm đánh giá của thế cờ sau đó.
// Khác `getAIMove`: không bao giờ đi ngẫu nhiên (gợi ý cho người chơi thì phải là nước
// tốt nhất) và trả về cả điểm để bên gọi giải thích được nước đi.
//
// Tìm sâu dần và chỉ nhận kết quả của độ sâu chạy xong trọn vẹn: khi hết thời gian,
// `minimax` trả về điểm tĩnh nên những nước được xét sau đó có điểm vô nghĩa — nhận
// kết quả dở dang sẽ dẫn tới gợi ý sai (ví dụ bỏ qua cả nước chiếu hết trong 1 nước).
export function findBestMove(fen: string, maxDepth: number, timeBudgetMs: number): BestMoveResult | null {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true }) as Move[];
    if (moves.length === 0) return null;

    const moverColor = game.turn();
    const maximizing = moverColor === 'w';
    const orderedMoves = orderMoves(moves);
    const deadline = Date.now() + timeBudgetMs;

    let best: ScoredMove | null = null;

    for (let depth = 1; depth <= maxDepth; depth++) {
        // Độ sâu 1 không đặt hạn chót: nó luôn nhanh, và phải luôn có một nước để gợi ý
        // kể cả khi ngân sách thời gian quá ngặt.
        const ctx: SearchContext = { deadline: depth === 1 ? Infinity : deadline, aborted: false };
        const bestAtDepth = searchAtDepth(game, depth, orderedMoves, maximizing, ctx);

        if (bestAtDepth === null) break;

        best = bestAtDepth;
        if (Date.now() >= deadline) break;
    }

    if (!best) return null;

    return {
        move: best.move,
        scoreForMover: moverColor === 'w' ? best.scoreWhite : -best.scoreWhite,
    };
}

// So sánh nước đã đi với nước tốt nhất theo engine ở cùng một vị trí (dùng cho
// tính năng phân tích ván đấu) — điểm luôn quy về góc nhìn của bên vừa đi
// (dương = có lợi cho bên đó) để dễ tính "centipawn loss".
export function evaluateMove(
    fen: string,
    playedMove: { from: string; to: string; promotion?: string },
    depth: number,
): MoveEvaluation | null {
    const game = new Chess(fen);
    const moverColor = game.turn();
    const ctx: SearchContext = { deadline: Date.now() + ANALYSIS_TIME_BUDGET_MS, aborted: false };

    const scored = scoreMoves(game, depth, ctx);
    if (scored.length === 0) return null;

    const best = pickBestForMover(scored, moverColor);
    const played = scored.find(({ move }) =>
        move.from === playedMove.from && move.to === playedMove.to && (move.promotion ?? undefined) === playedMove.promotion);

    // Về lý thuyết nước đã đi luôn phải nằm trong danh sách nước hợp lệ ở đúng vị trí
    // đó (nó đã từng được chess.js chấp nhận lúc chơi thật) — nhưng nếu vì lý do nào
    // đó không khớp được nước nào, trả về null thay vì một centipawnLoss sai lệch.
    if (!played) return null;

    const toMoverPerspective = (whiteScore: number) => (moverColor === 'w' ? whiteScore : -whiteScore);

    return {
        moverColor,
        bestScoreForMover: toMoverPerspective(best.scoreWhite),
        playedScoreForMover: toMoverPerspective(played.scoreWhite),
        bestSan: best.move.san,
        playedSan: played.move.san,
    };
}
