import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { buildHint, formatEvalLabel } from './moveHint';
import type { AnalysisResult, PvLine } from './engine/stockfish';

const START_FEN = new Chess().fen();

// Kết quả giả của Stockfish: nước tốt nhất + các phương án (mặc định chỉ một phương án).
function analysis(bestMove: string | null, lines: Partial<PvLine>[] = [{}]): AnalysisResult {
    return {
        bestMove,
        lines: bestMove === null ? [] : lines.map((line, i) => ({
            depth: 18,
            scoreCp: 0,
            mateIn: null,
            moves: i === 0 ? [bestMove] : [],
            ...line,
        })),
    };
}

function fenAfter(sanMoves: string[]): string {
    const game = new Chess();
    for (const san of sanMoves) game.move(san);
    return game.fen();
}

describe('buildHint', () => {
    it('trả về null khi engine không có nước đi hoặc nước đi không hợp lệ', () => {
        expect(buildHint(START_FEN, analysis(null))).toBeNull();
        expect(buildHint(START_FEN, analysis('e2e5'))).toBeNull();
    });

    it('đổi nước UCI sang SAN và giữ điểm số của engine', () => {
        const hint = buildHint(START_FEN, analysis('g1f3', [{ scoreCp: 25 }]));
        expect(hint).toMatchObject({ from: 'g1', to: 'f3', san: 'Nf3', scoreCp: 25, mateIn: null });
    });

    it('nước chiếu hết chỉ có đúng một lý do', () => {
        const fen = fenAfter(['f3', 'e5', 'g4']);
        const hint = buildHint(fen, analysis('d8h4', [{ mateIn: 1, scoreCp: 9999 }]));
        expect(hint?.san).toBe('Qh4#');
        expect(hint?.reasons).toEqual(['Chiếu hết — nước này thắng ván ngay lập tức.']);
    });

    it('ăn quân treo: nói rõ ăn không mất gì, và chiếu vua nếu có', () => {
        const fen = '4k3/8/8/4n3/8/8/8/4R1K1 w - - 0 1';
        const hint = buildHint(fen, analysis('e1e5'));
        expect(hint?.reasons).toContain('Ăn Mã ở e5 mà không bị ăn lại.');
        expect(hint?.reasons).toContain('Chiếu vua — đối thủ buộc phải đối phó, bạn giữ thế chủ động.');
    });

    it('cảnh báo quân của người chơi đang bị đe dọa', () => {
        // Mã a5 không được bảo vệ, bị Xe a1 nhắm (không cùng hàng/cột với Vua nên không bị ghim).
        const fen = '4k3/8/8/n7/8/8/8/R5K1 b - - 0 1';
        const hint = buildHint(fen, analysis('a5c4'));
        expect(hint?.threatText).toBe('Đối thủ đang nhắm Mã ở a5 (bằng Xe ở a1).');
        expect(hint?.reasons).toContain('Cứu Mã ở a5 đang bị Xe tấn công.');
    });

    it('phong cấp được nêu tên quân phong', () => {
        const hint = buildHint('8/P7/8/8/8/8/8/k6K w - - 0 1', analysis('a7a8q'));
        expect(hint?.san).toBe('a8=Q+');
        expect(hint?.reasons[0]).toBe('Phong cấp Tốt thành Hậu — có thêm một quân mạnh.');
    });

    it('nước im lặng: phát triển quân, hoặc chiếm trung tâm', () => {
        expect(buildHint(START_FEN, analysis('g1f3'))?.reasons)
            .toEqual(['Phát triển Mã ra khỏi hàng cuối, chuẩn bị nhập thành.']);
        expect(buildHint(START_FEN, analysis('e2e4'))?.reasons)
            .toEqual(['Chiếm ô trung tâm e4 — từ đây quân kiểm soát được nhiều đường hơn.']);
    });

    it('không có lý do cụ thể thì quay về câu mặc định', () => {
        expect(buildHint(START_FEN, analysis('a2a3'))?.reasons).toEqual(['Nước mạnh nhất theo Stockfish ở thế cờ này.']);
    });

    it('phương án tốt nhì kém hơn hẳn thì là "gần như nước duy nhất"', () => {
        const hint = buildHint(START_FEN, analysis('e2e4', [{ scoreCp: 40 }, { scoreCp: -200, moves: ['d2d4'] }]));
        expect(hint?.reasons).toEqual(['Gần như là nước duy nhất: phương án tốt nhì (d4) kém hơn hẳn.']);
    });

    it('chênh lệch nhỏ với phương án tốt nhì thì không nói "nước duy nhất"', () => {
        const hint = buildHint(START_FEN, analysis('e2e4', [{ scoreCp: 40 }, { scoreCp: 20, moves: ['d2d4'] }]));
        expect(hint?.reasons.join(' ')).not.toContain('nước duy nhất');
    });

    it('biến chính được đổi sang SAN có số nước, kể cả khi Đen đi trước', () => {
        const white = buildHint(START_FEN, analysis('e2e4', [{ moves: ['e2e4', 'e7e5', 'g1f3'] }]));
        expect(white?.pvText).toBe('1. e4 e5 2. Nf3');

        const black = buildHint(fenAfter(['e4']), analysis('e7e5', [{ moves: ['e7e5', 'g1f3'] }]));
        expect(black?.pvText).toBe('1... e5 2. Nf3');
    });

    it('biến chính có nước không hợp lệ thì dừng ở nước hợp lệ cuối', () => {
        const hint = buildHint(START_FEN, analysis('e2e4', [{ moves: ['e2e4', 'e7e5', 'e1e8'] }]));
        expect(hint?.pvText).toBe('1. e4 e5');
    });
});

describe('formatEvalLabel', () => {
    it('đổi centipawn sang đơn vị Tốt có dấu', () => {
        expect(formatEvalLabel(150, null)).toBe('+1.5');
        expect(formatEvalLabel(0, null)).toBe('+0.0');
        expect(formatEvalLabel(-80, null)).toBe('-0.8');
    });

    it('thế chiếu hết và thắng/thua cưỡng bức', () => {
        expect(formatEvalLabel(9997, 3)).toBe('chiếu hết sau 3 nước');
        expect(formatEvalLabel(-9998, -2)).toBe('bị chiếu hết sau 2 nước');
        expect(formatEvalLabel(9500, null)).toBe('thắng cưỡng bức');
        expect(formatEvalLabel(-9500, null)).toBe('thua cưỡng bức');
    });
});
