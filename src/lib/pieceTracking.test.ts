import { Chess, type Move } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { applyMoveToPieces, createInitialPieces, piecesFromFen } from './pieceTracking';
import type { AnimatedPiece } from '../types/chess';

// Đi một dãy nước (SAN) từ vị trí xuất phát, áp từng nước vào danh sách quân giống
// hệt cách useChessGame làm, và dọn quân bị ăn như sau khi animation kết thúc.
function play(sanMoves: string[]): { pieces: AnimatedPiece[]; lastMove: Move; game: Chess } {
    const game = new Chess();
    let pieces = createInitialPieces();
    let lastMove: Move | undefined;

    for (const san of sanMoves) {
        pieces = pieces.filter((p) => p.effect !== 'captured').map((p) => ({ ...p, effect: undefined }));
        lastMove = game.move(san);
        pieces = applyMoveToPieces(pieces, lastMove);
    }

    if (!lastMove) throw new Error('cần ít nhất một nước');
    return { pieces, lastMove, game };
}

const at = (pieces: AnimatedPiece[], square: string) => pieces.filter((p) => p.square === square && p.effect !== 'captured');

// Danh sách quân (bỏ quân đang phát animation bị ăn) phải khớp chính xác bàn cờ của chess.js.
function expectMatchesBoard(pieces: AnimatedPiece[], game: Chess) {
    const fromPieces = pieces
        .filter((p) => p.effect !== 'captured')
        .map((p) => `${p.square}:${p.color}${p.type}`)
        .sort();
    const fromBoard = piecesFromFen(game.fen()).map((p) => `${p.square}:${p.color}${p.type}`).sort();
    expect(fromPieces).toEqual(fromBoard);
}

describe('createInitialPieces', () => {
    it('có đủ 32 quân với id không trùng nhau', () => {
        const pieces = createInitialPieces();
        expect(pieces).toHaveLength(32);
        expect(new Set(pieces.map((p) => p.id)).size).toBe(32);
        expectMatchesBoard(pieces, new Chess());
    });
});

describe('applyMoveToPieces', () => {
    it('di chuyển quân mà vẫn giữ nguyên id', () => {
        const before = createInitialPieces();
        const knightId = at(before, 'g1')[0].id;

        const { pieces } = play(['Nf3']);
        expect(at(pieces, 'f3')).toEqual([expect.objectContaining({ id: knightId, type: 'n', color: 'w' })]);
        expect(at(pieces, 'g1')).toHaveLength(0);
    });

    it('đánh dấu quân bị ăn để phát animation thay vì xoá ngay', () => {
        const { pieces, game } = play(['e4', 'd5', 'exd5']);
        const onD5 = pieces.filter((p) => p.square === 'd5');

        expect(onD5).toHaveLength(2);
        expect(onD5.find((p) => p.color === 'b')?.effect).toBe('captured');
        expect(onD5.find((p) => p.color === 'w')?.effect).toBeUndefined();
        expectMatchesBoard(pieces, game);
    });

    it('bắt tốt qua đường: quân bị ăn nằm ở ô bên cạnh, không phải ô đích', () => {
        const { pieces, lastMove, game } = play(['e4', 'a6', 'e5', 'd5', 'exd6']);
        expect(lastMove.isEnPassant()).toBe(true);

        expect(pieces.find((p) => p.square === 'd5')?.effect).toBe('captured');
        expect(at(pieces, 'd6')).toEqual([expect.objectContaining({ color: 'w', type: 'p' })]);
        expectMatchesBoard(pieces, game);
    });

    it('nhập thành gần: Xe đi theo Vua', () => {
        const { pieces, game } = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']);
        expect(at(pieces, 'g1')[0]).toMatchObject({ type: 'k', color: 'w' });
        expect(at(pieces, 'f1')[0]).toMatchObject({ type: 'r', color: 'w' });
        expect(at(pieces, 'h1')).toHaveLength(0);
        expectMatchesBoard(pieces, game);
    });

    it('nhập thành xa của Đen: Xe a8 sang d8', () => {
        const { pieces, game } = play(['d4', 'd5', 'Nc3', 'Nc6', 'Bf4', 'Bf5', 'Qd2', 'Qd7', 'e3', 'O-O-O']);
        expect(at(pieces, 'c8')[0]).toMatchObject({ type: 'k', color: 'b' });
        expect(at(pieces, 'd8')[0]).toMatchObject({ type: 'r', color: 'b' });
        expect(at(pieces, 'a8')).toHaveLength(0);
        expectMatchesBoard(pieces, game);
    });

    it('phong cấp: đổi loại quân, giữ id và đánh dấu hiệu ứng', () => {
        // Tốt a trắng ăn dần lên hàng 8 rồi phong Mã (không phải Hậu) kèm ăn Xe.
        const sans = ['a4', 'h5', 'a5', 'h4', 'a6', 'h3', 'axb7', 'hxg2', 'bxa8=N'];
        const pawnId = at(createInitialPieces(), 'a2')[0].id;
        const { pieces, game } = play(sans);

        expect(at(pieces, 'a8')).toEqual([
            expect.objectContaining({ id: pawnId, type: 'n', color: 'w', effect: 'promoted' }),
        ]);
        expectMatchesBoard(pieces, game);
    });
});

describe('piecesFromFen', () => {
    it('dựng đúng các quân của một vị trí bất kỳ', () => {
        const pieces = piecesFromFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
        expect(pieces.map((p) => `${p.square}:${p.color}${p.type}`).sort()).toEqual(['e1:wk', 'e2:wp', 'e8:bk']);
    });
});
