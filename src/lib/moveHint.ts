import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import { PIECE_VALUES, findBestMove, pieceSquareGain } from './chessAI';
import type { PieceColor } from '../types/chess';

// Độ sâu tìm kiếm cho gợi ý — cao hơn mức chấm điểm ván đấu (ANALYSIS_DEPTH = 3) vì
// gợi ý phải đáng tin, và mỗi lần chỉ phải tính đúng một vị trí nên vẫn đủ nhanh.
export const HINT_DEPTH = 4;

// Ngân sách thời gian rộng rãi: chạy trong worker riêng nên không ảnh hưởng giao diện,
// và ở đây thà chờ thêm chút còn hơn bị ngắt giữa chừng rồi gợi ý một nước kém.
const HINT_TIME_BUDGET_MS = 3000;

export const PIECE_NAMES_VI: Record<PieceSymbol, string> = {
    p: 'Tốt', n: 'Mã', b: 'Tượng', r: 'Xe', q: 'Hậu', k: 'Vua',
};

// Điểm chiếu hết trong engine là ±100000. Vượt ngưỡng này thì con số không còn là
// "lợi thế vật chất tính bằng centipawn" nữa mà là thắng/thua cưỡng bức.
const MATE_SCORE_THRESHOLD = 50000;

// Chỉ nêu tối đa 3 lý do — nhiều hơn thì người chơi không đọc, và những lý do xếp sau
// thường chỉ là hệ quả của lý do đầu.
const MAX_REASONS = 3;

// Chênh lệch điểm vị trí tối thiểu để coi một nước "im lặng" là cải thiện vị trí quân
// đáng nói (tương đương khoảng 1/6 giá trị một con Tốt).
const MIN_POSITIONAL_GAIN = 15;

export interface MoveHint {
    from: Square;
    to: Square;
    san: string;
    // Điểm đánh giá thế cờ sau nước gợi ý, quy về góc nhìn người chơi (centipawn).
    scoreForMover: number;
    // Quân của người chơi đang bị đe dọa ăn ngay tại vị trí hiện tại (nếu có) — thứ
    // người chơi cần biết đầu tiên sau khi đối thủ vừa đi.
    threatText: string | null;
    reasons: string[];
}

// Worker trả về kèm FEN của vị trí đã tính, để hook loại bỏ kết quả đến muộn của một
// vị trí đã cũ (worker xử lý tuần tự nên điều này hoàn toàn có thể xảy ra).
export interface MoveHintResponse {
    fen: string;
    hint: MoveHint | null;
}

const otherColor = (color: PieceColor): PieceColor => (color === 'w' ? 'b' : 'w');

const valueAt = (game: Chess, square: Square): number => PIECE_VALUES[game.get(square)?.type ?? 'p'];

const nameAt = (game: Chess, square: Square): string => PIECE_NAMES_VI[game.get(square)?.type ?? 'p'];

// Quân ở ô này có đang "treo" không: bị tấn công mà không được bảo vệ, hoặc quân tấn
// công rẻ nhất còn rẻ hơn chính nó (đổi quân là đối thủ có lời). Đây là cách đánh giá
// xấp xỉ — không xét ghim, quá tải hay chuỗi đổi quân dài — và chỉ dùng để *diễn giải*
// nước đi cho người đọc, không tham gia vào việc chọn nước.
function isEnPrise(game: Chess, square: Square): boolean {
    const piece = game.get(square);
    // Vua không bao giờ bị "ăn", các đòn chiếu đã được xử lý bằng lý do riêng.
    if (!piece || piece.type === 'k') return false;

    const attackers = game.attackers(square, otherColor(piece.color));
    if (attackers.length === 0) return false;

    const defenders = game.attackers(square, piece.color);
    if (defenders.length === 0) return true;

    const cheapestAttacker = Math.min(...attackers.map((attacker) => valueAt(game, attacker)));
    return cheapestAttacker < PIECE_VALUES[piece.type];
}

// Các ô chứa quân đang treo của một bên, quân giá trị cao xếp trước.
function enPriseSquares(game: Chess, color: PieceColor): Square[] {
    const squares: Square[] = [];

    for (const row of game.board()) {
        for (const cell of row) {
            if (!cell || cell.color !== color) continue;
            if (isEnPrise(game, cell.square)) squares.push(cell.square);
        }
    }

    return squares.sort((a, b) => valueAt(game, b) - valueAt(game, a));
}

// Quân đối phương giá trị nhất mà quân vừa đi (đang đứng ở `attackerSquare`) đang
// nhắm tới và đối phương khó giữ được.
function bestNewTarget(game: Chess, attackerSquare: Square, targetColor: PieceColor): Square | null {
    let best: Square | null = null;

    for (const row of game.board()) {
        for (const cell of row) {
            if (!cell || cell.color !== targetColor) continue;
            if (!game.attackers(cell.square, otherColor(targetColor)).includes(attackerSquare)) continue;
            if (!isEnPrise(game, cell.square)) continue;
            if (!best || PIECE_VALUES[cell.type] > valueAt(game, best)) best = cell.square;
        }
    }

    return best;
}

function describeThreat(game: Chess): string | null {
    const target = enPriseSquares(game, game.turn())[0];
    if (!target) return null;

    const attackers = game.attackers(target, otherColor(game.turn()));
    const cheapestAttacker = attackers.reduce((cheapest, attacker) =>
        (valueAt(game, attacker) < valueAt(game, cheapest) ? attacker : cheapest), attackers[0]);

    return `Đối thủ đang nhắm ${nameAt(game, target)} ở ${target} (bằng ${nameAt(game, cheapestAttacker)} ở ${cheapestAttacker}).`;
}

function describeCapture(move: Move, after: Chess, opponent: PieceColor): string {
    const capturedName = PIECE_NAMES_VI[move.captured ?? 'p'];
    const movedName = PIECE_NAMES_VI[move.piece];

    if (move.isEnPassant()) return `Bắt Tốt qua đường (en passant) — ăn không mất gì.`;
    // Sau khi ăn, quân của ta đứng ở ô đó: nếu không ai với tới được thì đây là quân ăn không.
    if (after.attackers(move.to, opponent).length === 0) return `Ăn ${capturedName} ở ${move.to} mà không bị ăn lại.`;
    if (PIECE_VALUES[move.captured ?? 'p'] > PIECE_VALUES[move.piece]) {
        return `Ăn ${capturedName} bằng ${movedName} — đổi quân có lợi cho bạn.`;
    }
    return `Ăn ${capturedName} ở ${move.to}.`;
}

function describeEscape(move: Move, before: Chess, opponent: PieceColor): string {
    const attackers = before.attackers(move.from, opponent);
    const cheapestAttacker = attackers.reduce((cheapest, attacker) =>
        (valueAt(before, attacker) < valueAt(before, cheapest) ? attacker : cheapest), attackers[0]);

    return `Cứu ${PIECE_NAMES_VI[move.piece]} ở ${move.from} đang bị ${nameAt(before, cheapestAttacker)} tấn công.`;
}

// Dựng danh sách lý do cho nước đi mà engine chọn, xếp theo thứ tự "đáng nói" giảm dần:
// đòn chiến thuật kết thúc ván trước, rồi ăn quân/phong cấp, rồi đòn phòng thủ, cuối
// cùng mới đến lý do vị trí. Tất cả đều suy ra từ chính bàn cờ + tiêu chí của engine,
// nên lý do luôn khớp với nước đi (không phải mô tả chung chung).
function buildReasons(fen: string, move: Move): string[] {
    const before = new Chess(fen);
    const mover = before.turn();
    const opponent = otherColor(mover);

    const after = new Chess(fen);
    after.move({ from: move.from, to: move.to, promotion: move.promotion });

    const reasons: string[] = [];
    const add = (text: string) => {
        if (!reasons.includes(text)) reasons.push(text);
    };

    if (after.isCheckmate()) return ['Chiếu hết — nước này thắng ván ngay lập tức.'];
    if (after.isStalemate()) add('Đối thủ hết nước đi hợp lệ — ván hòa (stalemate).');

    if (move.promotion) {
        add(`Phong cấp Tốt thành ${PIECE_NAMES_VI[move.promotion]} — có thêm một quân mạnh.`);
    }

    if (move.captured) add(describeCapture(move, after, opponent));

    if (after.inCheck()) add('Chiếu vua — đối thủ buộc phải đối phó, bạn giữ thế chủ động.');

    if (move.isKingsideCastle() || move.isQueensideCastle()) {
        add('Nhập thành: vua vào chỗ an toàn và Xe được đưa vào cuộc.');
    }

    // Quân vừa đi có đang bị đe dọa ở ô cũ, và nước này có thật sự đưa nó đến chỗ an toàn?
    if (isEnPrise(before, move.from) && !isEnPrise(after, move.to)) {
        add(describeEscape(move, before, opponent));
    }

    // Quân khác của ta đang treo nhưng sau nước này thì không còn treo (được bảo vệ
    // thêm, hoặc đường tấn công bị chắn). Bỏ qua ô mà chính quân vừa đi rời khỏi —
    // trường hợp đó đã có lý do "cứu quân" ở trên.
    const rescued = enPriseSquares(before, mover).find((square) =>
        square !== move.from && after.get(square)?.color === mover && !isEnPrise(after, square));
    if (rescued) add(`Bảo vệ ${nameAt(after, rescued)} ở ${rescued} đang bị đối thủ nhắm tới.`);

    const newTarget = bestNewTarget(after, move.to, opponent);
    if (newTarget) add(`Tạo đe dọa mới: nhắm vào ${nameAt(after, newTarget)} ở ${newTarget}.`);

    // Lý do "im lặng" — chỉ dùng khi nước đi không mang đòn chiến thuật nào, nếu không
    // nó sẽ làm loãng những lý do quan trọng hơn.
    if (reasons.length === 0 && pieceSquareGain(move.piece, mover, move.from, move.to) >= MIN_POSITIONAL_GAIN) {
        add(`Đưa ${PIECE_NAMES_VI[move.piece]} tới ô hoạt động tốt hơn, kiểm soát trung tâm.`);
    }

    if (reasons.length === 0) add('Nước cải thiện thế cờ nhiều nhất mà engine tìm được ở vị trí này.');

    return reasons.slice(0, MAX_REASONS);
}

// Nước đi tốt nhất cho bên đang tới lượt trong `fen`, kèm lời giải thích. Hàm này
// chạy trong Web Worker (xem moveHint.worker.ts) vì phần tìm kiếm khá nặng.
export function computeMoveHint(fen: string): MoveHint | null {
    const best = findBestMove(fen, HINT_DEPTH, HINT_TIME_BUDGET_MS);
    if (!best) return null;

    return {
        from: best.move.from,
        to: best.move.to,
        san: best.move.san,
        scoreForMover: best.scoreForMover,
        threatText: describeThreat(new Chess(fen)),
        reasons: buildReasons(fen, best.move),
    };
}

// Nhãn đánh giá thế cờ sau nước gợi ý, theo góc nhìn người chơi và theo đơn vị "tốt"
// (quy ước quen thuộc của cờ vua: +1.0 nghĩa là hơn khoảng một con Tốt).
export function formatEvalLabel(scoreForMover: number): string {
    if (scoreForMover >= MATE_SCORE_THRESHOLD) return 'thắng cưỡng bức';
    if (scoreForMover <= -MATE_SCORE_THRESHOLD) return 'thua cưỡng bức';

    const pawns = scoreForMover / 100;
    return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}
