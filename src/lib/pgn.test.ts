import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { buildPgn } from './pgn';
import type { MoveRecord } from '../types/analysis';

function recordsOf(sanMoves: string[]): MoveRecord[] {
    const game = new Chess();
    return sanMoves.map((san, i) => {
        const move = game.move(san);
        return {
            from: move.from, to: move.to, san: move.san, color: move.color, piece: move.piece,
            isCastle: false, moveNumber: Math.floor(i / 2) + 1, fenBefore: move.before, fenAfter: move.after,
        };
    });
}

describe('buildPgn', () => {
    it('ghi đủ header và kết quả, đọc lại được bằng chess.js', () => {
        const pgn = buildPgn(recordsOf(['e4', 'e5', 'Nf3']), {
            white: 'Người chơi', black: 'Stockfish', result: '0-1', timeControlMinutes: 5,
        });

        expect(pgn).toContain('[White "Người chơi"]');
        expect(pgn).toContain('[Black "Stockfish"]');
        expect(pgn).toContain('[Result "0-1"]');
        expect(pgn).toContain('[TimeControl "300"]');
        expect(pgn.trimEnd()).toMatch(/1\. e4 e5 2\. Nf3 0-1$/);

        const reloaded = new Chess();
        reloaded.loadPgn(pgn);
        expect(reloaded.history()).toEqual(['e4', 'e5', 'Nf3']);
    });

    it('ván không giới hạn thời gian và ván chưa kết thúc', () => {
        const pgn = buildPgn(recordsOf(['d4']), { white: 'Trắng', black: 'Đen', result: '*', timeControlMinutes: null });
        expect(pgn).toContain('[TimeControl "-"]');
        expect(pgn.trimEnd()).toMatch(/1\. d4 \*$/);
    });
});
