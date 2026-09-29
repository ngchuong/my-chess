import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import { MATE_THRESHOLD_CP, parseUciMove, type AnalysisResult } from './engine/stockfish';
import type { PieceColor } from '../types/chess';

// Stockfish chỉ trả về nước đi và một con số (`score cp -45`), không giải thích gì cả.
// Toàn bộ file này là lớp diễn giải: đọc bàn cờ qua chess.js để nói bằng lời *vì sao*
// nước đó tốt. Các lý do đều là sự thật kiểm chứng được trên bàn cờ (ăn quân gì, quân
// nào đang bị tấn công, chiếu hết hay không), nên không bao giờ mâu thuẫn với engine.

export const PIECE_NAMES_VI: Record<PieceSymbol, string> = {
    p: 'Tốt', n: 'Mã', b: 'Tượng', r: 'Xe', q: 'Hậu', k: 'Vua',
};

// Giá trị quân quy ước, chỉ dùng để diễn giải (so quân nào đắt hơn quân nào), không
// tham gia vào việc chọn nước — việc đó đã là của Stockfish.
const PIECE_VALUES: Record<PieceSymbol, number> = {
    p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Chỉ nêu tối đa 3 lý do — nhiều hơn thì người chơi không đọc, và những lý do xếp sau
// thường chỉ là hệ quả của lý do đầu.
const MAX_REASONS = 3;

// Chênh lệch điểm giữa nước tốt nhất và phương án tốt thứ hai để coi là "gần như nước
// duy nhất" (1,5 tốt — đủ lớn để các nước khác đều hỏng rõ rệt).
const ONLY_MOVE_GAP_CP = 150;

// Số nước của biến chính đem ra hiển thị: đủ để thấy ý đồ, không dài tới mức rối.
const PV_PLIES = 6;

const CENTER_SQUARES = new Set(['d4', 'e4', 'd5', 'e5']);

export interface MoveHint {
    from: Square;
    to: Square;
    san: string;
    // Điểm thế cờ sau nước gợi ý, quy về góc nhìn người chơi (centipawn).
    scoreCp: number;
    // Số nước tới chiếu hết, nếu đây là thế cờ chiếu hết cưỡng bức.
    mateIn: number | null;
    // Quân của người chơi đang bị đe dọa ăn ngay tại vị trí hiện tại — thứ người chơi
    // cần biết đầu tiên sau khi đối thủ vừa đi.
    threatText: string | null;
    reasons: string[];
    // Biến chính engine dự kiến, đã đổi sang ký hiệu SAN để đọc được.
    pvText: string | null;
}

const otherColor = (color: PieceColor): PieceColor => (color === 'w' ? 'b' : 'w');

const typeAt = (game: Chess, square: Square): PieceSymbol => game.get(square)?.type ?? 'p';

const valueAt = (game: Chess, square: Square): number => PIECE_VALUES[typeAt(game, square)];

const nameAt = (game: Chess, square: Square): string => PIECE_NAMES_VI[typeAt(game, square)];

// Quân ở ô này có đang "treo" không: bị tấn công mà không được bảo vệ, hoặc quân tấn
// công rẻ nhất còn rẻ hơn chính nó (đổi quân là đối thủ có lời). Đây là cách đánh giá
// xấp xỉ — không xét ghim, quá tải hay chuỗi đổi quân dài — và chỉ dùng để *diễn giải*,
// không dùng để chọn nước.
function isEnPrise(game: Chess, square: Square): boolean {
    const piece = game.get(square);
    // Vua không bao giờ bị "ăn"; các đòn chiếu đã có lý do riêng.
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

function cheapestAttackerOf(game: Chess, square: Square, attackedBy: PieceColor): Square | null {
    const attackers = game.attackers(square, attackedBy);
    if (attackers.length === 0) return null;

    return attackers.reduce((cheapest, attacker) =>
        (valueAt(game, attacker) < valueAt(game, cheapest) ? attacker : cheapest), attackers[0]);
}

// Quân đối phương giá trị nhất mà quân vừa đi (đang đứng ở `attackerSquare`) đang nhắm
// tới và đối phương khó giữ được.
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

    const attacker = cheapestAttackerOf(game, target, otherColor(game.turn()));
    if (!attacker) return null;

    return `Đối thủ đang nhắm ${nameAt(game, target)} ở ${target} (bằng ${nameAt(game, attacker)} ở ${attacker}).`;
}

function describeCapture(move: Move, after: Chess, opponent: PieceColor): string {
    const capturedName = PIECE_NAMES_VI[move.captured ?? 'p'];
    const movedName = PIECE_NAMES_VI[move.piece];

    if (move.isEnPassant()) return 'Bắt Tốt qua đường (en passant) — ăn không mất gì.';
    // Sau khi ăn, quân của ta đứng ở ô đó: nếu không ai với tới được thì đây là quân ăn không.
    if (after.attackers(move.to, opponent).length === 0) return `Ăn ${capturedName} ở ${move.to} mà không bị ăn lại.`;
    if (PIECE_VALUES[move.captured ?? 'p'] > PIECE_VALUES[move.piece]) {
        return `Ăn ${capturedName} bằng ${movedName} — đổi quân có lợi cho bạn.`;
    }
    return `Ăn ${capturedName} ở ${move.to}.`;
}

// Lý do cho một nước "im lặng" — không ăn quân, không chiếu, không cứu quân nào.
// Chỉ dựa vào sự thật hình học trên bàn cờ, không đoán mò ý đồ của engine.
function describeQuietMove(move: Move): string | null {
    const homeRank = move.color === 'w' ? '1' : '8';

    if ((move.piece === 'n' || move.piece === 'b') && move.from[1] === homeRank) {
        return `Phát triển ${PIECE_NAMES_VI[move.piece]} ra khỏi hàng cuối, chuẩn bị nhập thành.`;
    }
    if (CENTER_SQUARES.has(move.to)) {
        return `Chiếm ô trung tâm ${move.to} — từ đây quân kiểm soát được nhiều đường hơn.`;
    }
    return null;
}

// Dựng danh sách lý do, xếp theo thứ tự "đáng nói" giảm dần: đòn kết thúc ván trước,
// rồi ăn quân/phong cấp, rồi đòn phòng thủ, cuối cùng mới đến lý do vị trí.
function buildReasons(fen: string, move: Move, result: AnalysisResult): string[] {
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
        const attacker = cheapestAttackerOf(before, move.from, opponent);
        if (attacker) {
            add(`Cứu ${PIECE_NAMES_VI[move.piece]} ở ${move.from} đang bị ${nameAt(before, attacker)} tấn công.`);
        }
    }

    // Quân khác của ta đang treo nhưng sau nước này thì không còn treo (được bảo vệ thêm,
    // hoặc đường tấn công bị chắn). Bỏ qua ô mà chính quân vừa đi rời khỏi — trường hợp
    // đó đã có lý do "cứu quân" ở trên.
    const rescued = enPriseSquares(before, mover).find((square) =>
        square !== move.from && after.get(square)?.color === mover && !isEnPrise(after, square));
    if (rescued) add(`Bảo vệ ${nameAt(after, rescued)} ở ${rescued} đang bị đối thủ nhắm tới.`);

    const newTarget = bestNewTarget(after, move.to, opponent);
    if (newTarget) add(`Tạo đe dọa mới: nhắm vào ${nameAt(after, newTarget)} ở ${newTarget}.`);

    // Khoảng cách với phương án tốt thứ hai (lấy từ MultiPV) — cho biết nước này là
    // "một trong nhiều nước tốt" hay "gần như bắt buộc".
    const [best, runnerUp] = result.lines;
    if (best && runnerUp && best.scoreCp - runnerUp.scoreCp >= ONLY_MOVE_GAP_CP) {
        const runnerUpSan = uciToSan(fen, runnerUp.moves[0]);
        add(runnerUpSan
            ? `Gần như là nước duy nhất: phương án tốt nhì (${runnerUpSan}) kém hơn hẳn.`
            : 'Gần như là nước duy nhất: mọi phương án khác đều kém hơn hẳn.');
    }

    // Lý do "im lặng" chỉ dùng khi không có đòn nào, nếu không sẽ làm loãng phần quan trọng.
    if (reasons.length === 0) {
        const quiet = describeQuietMove(move);
        if (quiet) add(quiet);
    }

    if (reasons.length === 0) add('Nước mạnh nhất theo Stockfish ở thế cờ này.');

    return reasons.slice(0, MAX_REASONS);
}

function findMove(fen: string, uci: string): Move | null {
    const game = new Chess(fen);
    const { from, to, promotion } = parseUciMove(uci);

    return (game.moves({ verbose: true }) as Move[]).find((move) =>
        move.from === from && move.to === to && (move.promotion ?? undefined) === promotion) ?? null;
}

function uciToSan(fen: string, uci: string | undefined): string | null {
    return uci ? findMove(fen, uci)?.san ?? null : null;
}

// Đổi biến chính (dãy nước UCI) sang ký hiệu SAN kèm số nước, ví dụ "1... e5 2. Nf3 Nc6".
function formatPv(fen: string, uciMoves: string[]): string | null {
    const game = new Chess(fen);
    const parts: string[] = [];

    for (const uci of uciMoves.slice(0, PV_PLIES)) {
        const isWhiteTurn = game.turn() === 'w';
        const moveNumber = game.moveNumber();

        let san: string;
        try {
            san = game.move(parseUciMove(uci)).san;
        } catch {
            // Biến engine trả về luôn hợp lệ, nhưng nếu có gì bất thường thì dừng ở đây
            // còn hơn là hiển thị một dãy nước sai.
            break;
        }

        if (isWhiteTurn) parts.push(`${moveNumber}.`);
        else if (parts.length === 0) parts.push(`${moveNumber}...`);
        parts.push(san);
    }

    return parts.length > 1 ? parts.join(' ') : null;
}

// Ghép kết quả của Stockfish với lớp diễn giải thành gợi ý hoàn chỉnh cho người chơi.
export function buildHint(fen: string, result: AnalysisResult): MoveHint | null {
    if (!result.bestMove) return null;

    const move = findMove(fen, result.bestMove);
    if (!move) return null;

    const best = result.lines[0];

    return {
        from: move.from,
        to: move.to,
        san: move.san,
        scoreCp: best?.scoreCp ?? 0,
        mateIn: best?.mateIn ?? null,
        threatText: describeThreat(new Chess(fen)),
        reasons: buildReasons(fen, move, result),
        pvText: best ? formatPv(fen, best.moves) : null,
    };
}

// Nhãn đánh giá thế cờ theo góc nhìn người chơi, theo đơn vị "tốt" (quy ước quen thuộc
// của cờ vua: +1.0 nghĩa là hơn khoảng một con Tốt).
export function formatEvalLabel(scoreCp: number, mateIn: number | null): string {
    if (mateIn !== null) {
        return mateIn > 0 ? `chiếu hết sau ${mateIn} nước` : `bị chiếu hết sau ${Math.abs(mateIn)} nước`;
    }
    if (scoreCp >= MATE_THRESHOLD_CP) return 'thắng cưỡng bức';
    if (scoreCp <= -MATE_THRESHOLD_CP) return 'thua cưỡng bức';

    const pawns = scoreCp / 100;
    return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}
