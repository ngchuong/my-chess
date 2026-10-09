import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { getMaterialSummary } from './material';

function fenAfter(sanMoves: string[]): string {
    const game = new Chess();
    for (const san of sanMoves) game.move(san);
    return game.fen();
}

describe('getMaterialSummary', () => {
    it('vị trí xuất phát: chưa ai ăn gì, không ai hơn', () => {
        expect(getMaterialSummary(new Chess().fen())).toEqual({
            captured: { w: [], b: [] },
            advantage: { w: 0, b: 0 },
        });
    });

    it('ghi nhận quân bị ăn và điểm hơn lực lượng', () => {
        const summary = getMaterialSummary(fenAfter(['e4', 'd5', 'exd5']));
        expect(summary.captured).toEqual({ w: ['p'], b: [] });
        expect(summary.advantage).toEqual({ w: 1, b: 0 });
    });

    it('xếp quân bị ăn từ giá trị cao xuống thấp', () => {
        // Trắng chỉ còn Vua; Đen còn Vua + 8 Tốt.
        const summary = getMaterialSummary('4k3/pppppppp/8/8/8/8/8/4K3 w - - 0 1');
        expect(summary.captured.b).toEqual(['q', 'r', 'r', 'b', 'b', 'n', 'n', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p']);
        expect(summary.advantage).toEqual({ w: 0, b: 8 });
    });

    it('điểm hơn lực lượng tính theo quân đang có, kể cả quân phong cấp', () => {
        // Trắng: 2 Hậu (một Hậu phong từ Tốt a), mất Xe a1 → 42 điểm.
        // Đen: đủ quân trừ Hậu → 30 điểm.
        const summary = getMaterialSummary('rnb1kbnr/pppppppp/8/8/8/8/1PPPPPPP/QNBQKBNR w Kkq - 0 1');
        expect(summary.advantage).toEqual({ w: 12, b: 0 });
        expect(summary.captured.w).toEqual(['q']);
        // Tốt đã phong cấp tính là "mất" — hạn chế đã ghi trong material.ts.
        expect(summary.captured.b).toEqual(['r', 'p']);
    });
});
