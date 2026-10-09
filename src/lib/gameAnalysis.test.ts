import { Chess } from 'chess.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyseRequest, AnalysisResult } from './engine/stockfish';
import type { MoveAnalysis, MoveRecord } from '../types/analysis';

// Thay engine thật (Web Worker + WASM) bằng bảng tra: FEN → các phương án định sẵn
// [nước UCI, điểm theo góc nhìn bên tới lượt]. Mỗi test tự khai báo điểm của từng vị
// trí, nên kiểm tra được chính xác cách chấm điểm.
type FakeLine = [move: string, scoreCp: number, mateIn?: number];
const engineResults = new Map<string, FakeLine[]>();

const analyseMock = vi.fn(async ({ fen }: AnalyseRequest): Promise<AnalysisResult> => {
    const lines = engineResults.get(fen);
    if (!lines) throw new Error(`Chưa khai báo kết quả engine cho ${fen}`);
    return {
        bestMove: lines[0]?.[0] ?? null,
        lines: lines.map(([move, scoreCp, mateIn]) => ({ depth: 14, scoreCp, mateIn: mateIn ?? null, moves: [move] })),
    };
});

vi.mock('./engine/stockfish', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./engine/stockfish')>()),
    analyse: (request: AnalyseRequest) => analyseMock(request),
}));

const { analyzeGame, moveAccuracy, winChance } = await import('./gameAnalysis');

function recordsOf(sanMoves: string[]): MoveRecord[] {
    const game = new Chess();
    return sanMoves.map((san, i) => {
        const move = game.move(san);
        return {
            from: move.from,
            to: move.to,
            san: move.san,
            color: move.color,
            piece: move.piece,
            captured: move.captured,
            promotion: move.promotion,
            isCastle: false,
            moveNumber: Math.floor(i / 2) + 1,
            fenBefore: move.before,
            fenAfter: move.after,
        };
    });
}

// Khai báo kết quả engine cho vị trí trước nước thứ `index` (và vị trí cuối ván với
// `index = history.length`).
function setEngine(history: MoveRecord[], index: number, lines: FakeLine[]) {
    const fen = index < history.length ? history[index].fenBefore : history[index - 1].fenAfter;
    engineResults.set(fen, lines);
}

// Mặc định mọi vị trí đều "cân bằng, nước đã đi là nước tốt nhất" — test chỉ cần ghi
// đè đúng những vị trí nó quan tâm.
function setAllBest(history: MoveRecord[]) {
    history.forEach((record, i) => setEngine(history, i, [[`${record.from}${record.to}${record.promotion ?? ''}`, 20]]));
    setEngine(history, history.length, [['a2a3', 0]]);
}

async function analyzeAll(history: MoveRecord[], shouldContinue = () => true): Promise<MoveAnalysis[]> {
    const results: MoveAnalysis[] = [];
    await analyzeGame(history, (index, result) => { results[index] = result; }, shouldContinue);
    return results;
}

beforeEach(() => {
    engineResults.clear();
    analyseMock.mockClear();
});

describe('analyzeGame — cách gọi engine', () => {
    it('mỗi vị trí phân tích một lần, 2 phương án; vị trí cuối chỉ cần 1', async () => {
        const history = recordsOf(['e4', 'e5']);
        setAllBest(history);

        await analyzeAll(history);

        expect(analyseMock).toHaveBeenCalledTimes(3);
        expect(analyseMock.mock.calls.map(([req]) => req.multipv)).toEqual([2, 2, 1]);
        expect(analyseMock.mock.calls[0][0]).toMatchObject({ freshGame: true });
    });

    it('dừng ngay khi người xem rời màn hình xem lại', async () => {
        const history = recordsOf(['e4', 'e5', 'Nf3']);
        setAllBest(history);

        let calls = 0;
        const results = await analyzeAll(history, () => ++calls <= 4);

        expect(results.filter(Boolean)).toHaveLength(1);
        expect(analyseMock).toHaveBeenCalledTimes(2);
    });

    it('ván không có nước nào thì không gọi engine', async () => {
        expect(await analyzeAll([])).toEqual([]);
        expect(analyseMock).not.toHaveBeenCalled();
    });
});

describe('analyzeGame — xếp loại theo mức mất điểm', () => {
    it('nước engine chọn là Tốt nhất, kèm đánh giá theo góc nhìn Trắng', async () => {
        const history = recordsOf(['e4', 'e5']);
        setAllBest(history);
        setEngine(history, 1, [['e7e5', -30], ['c7c5', -35]]);

        const [white, black] = await analyzeAll(history);

        expect(white).toMatchObject({ quality: 'best', centipawnLoss: 0, evalCp: 20 });
        expect(black).toMatchObject({ quality: 'best', evalCp: 30 });
    });

    it('nước hớ được nhận ra, kèm nước tốt nhất', async () => {
        const history = recordsOf(['e4', 'f6']);
        setAllBest(history);
        setEngine(history, 1, [['e7e5', -30], ['c7c5', -40]]);
        setEngine(history, 2, [['d1h5', 400]]);

        const [, blunder] = await analyzeAll(history);

        expect(blunder).toMatchObject({ san: 'f6', quality: 'blunder', centipawnLoss: 370, bestSan: 'e5' });
    });

    it('xếp loại theo cơ hội thắng bị mất, không theo centipawn thô', async () => {
        // Cùng mất 100cp: khi thế cờ cân bằng là thiếu chính xác, khi đang hơn hẳn thì
        // gần như không đổi kết quả ván.
        const history = recordsOf(['a3']);
        setEngine(history, 0, [['e2e4', 0], ['d2d4', 0]]);
        setEngine(history, 1, [['e7e5', 100]]);
        const [equal] = await analyzeAll(history);

        setEngine(history, 0, [['e2e4', 1200], ['d2d4', 1200]]);
        setEngine(history, 1, [['e7e5', -1100]]);
        const [winning] = await analyzeAll(history);

        expect(equal).toMatchObject({ centipawnLoss: 100, quality: 'inaccuracy' });
        expect(winning).toMatchObject({ centipawnLoss: 100, quality: 'excellent' });
    });

    it('nước nằm trong các phương án của engine lấy điểm từ cùng lượt tìm kiếm (không nhiễu)', async () => {
        const history = recordsOf(['d4']);
        setEngine(history, 0, [['e2e4', 30], ['d2d4', -120]]);
        // Lượt tìm kiếm riêng của vị trí sau lại "lạc quan" hơn hẳn — không được dùng.
        setEngine(history, 1, [['d7d5', -25]]);

        const [move] = await analyzeAll(history);

        expect(move.centipawnLoss).toBe(150);
        expect(move.quality).toBe('mistake');
    });

    it('nước ngoài các phương án không thể được chấm tốt hơn phương án cuối engine xét', async () => {
        const history = recordsOf(['h4']);
        setEngine(history, 0, [['e2e4', 30], ['d2d4', -100]]);
        setEngine(history, 1, [['e7e5', -50]]);

        const [move] = await analyzeAll(history);

        expect(move.centipawnLoss).toBe(130);
    });

    it('nước chiếu hết là Tốt nhất, đánh giá là thắng tuyệt đối', async () => {
        const history = recordsOf(['f3', 'e5', 'g4', 'Qh4#']);
        setAllBest(history);
        setEngine(history, 3, [['d8h4', 9999, 1], ['d8g5', 300]]);
        engineResults.set(history[3].fenAfter, []);

        const results = await analyzeAll(history);

        expect(results[3]).toMatchObject({ san: 'Qh4#', quality: 'best', centipawnLoss: 0, evalCp: -9999 });
    });
});

describe('analyzeGame — Thiên tài, Tuyệt vời, Bỏ lỡ', () => {
    // Bẫy Legal: 5.Nxe5!! bỏ mặc Hậu bị Tượng ăn, vì ăn Hậu sẽ bị chiếu hết.
    const LEGAL = ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5'];

    it('thí quân mà vẫn là nước tốt nhất là Thiên tài', async () => {
        const history = recordsOf(LEGAL);
        setAllBest(history);
        setEngine(history, 8, [['f3e5', 230], ['h2h3', 120]]);

        const results = await analyzeAll(history);

        expect(results[8]).toMatchObject({ san: 'Nxe5', quality: 'brilliant' });
    });

    it('thí quân khi đã thắng áp đảo thì không còn là Thiên tài', async () => {
        const history = recordsOf(LEGAL);
        setAllBest(history);
        setEngine(history, 8, [['f3e5', 1500], ['h2h3', 1400]]);

        const results = await analyzeAll(history);

        expect(results[8].quality).toBe('best');
    });

    it('nước tốt nhất mà phương án tốt nhì kém hơn hẳn là Tuyệt vời', async () => {
        const history = recordsOf(['e4', 'e5', 'Nf3']);
        setAllBest(history);
        setEngine(history, 2, [['g1f3', 50], ['d2d4', -250]]);

        const results = await analyzeAll(history);

        expect(results[2].quality).toBe('great');
    });

    it('ăn lại quân vừa bị ăn không tính là Tuyệt vời dù là nước duy nhất', async () => {
        const history = recordsOf(['e4', 'd5', 'exd5', 'Qxd5']);
        setAllBest(history);
        setEngine(history, 3, [['d8d5', 0], ['g8f6', -300]]);

        const results = await analyzeAll(history);

        expect(results[3].quality).toBe('best');
    });

    it('đối thủ vừa đi hớ mà không trừng phạt được là Bỏ lỡ', async () => {
        // 2...Qg5?? để Hậu cho Mã ăn, nhưng Trắng lại đi 3.d3.
        const history = recordsOf(['e4', 'e5', 'Nf3', 'Qg5', 'd3']);
        setAllBest(history);
        setEngine(history, 3, [['b8c6', -30], ['g8f6', -35]]);
        setEngine(history, 4, [['f3g5', 900], ['h2h4', 150]]);
        setEngine(history, 5, [['g5d8', -100]]);

        const results = await analyzeAll(history);

        expect(results[3].quality).toBe('blunder');
        expect(results[4]).toMatchObject({ san: 'd3', quality: 'miss', bestSan: 'Nxg5' });
    });

    it('nước hớ khi đối thủ không vừa sai thì vẫn là Nước hớ, không phải Bỏ lỡ', async () => {
        const history = recordsOf(['e4', 'e5', 'Qh5']);
        setAllBest(history);
        setEngine(history, 2, [['g1f3', 900], ['d2d4', 850]]);
        setEngine(history, 3, [['g7g6', 0]]);

        const results = await analyzeAll(history);

        expect(results[2].quality).toBe('blunder');
    });
});

describe('winChance / moveAccuracy', () => {
    it('cơ hội thắng 50% khi cân bằng, đối xứng hai bên', () => {
        expect(winChance(0)).toBe(50);
        expect(winChance(300) + winChance(-300)).toBeCloseTo(100);
    });

    it('độ chính xác 100 khi không mất gì, giảm dần theo mức mất', () => {
        expect(moveAccuracy(0)).toBeCloseTo(100, 0);
        expect(moveAccuracy(10)).toBeLessThan(moveAccuracy(5));
        expect(moveAccuracy(100)).toBe(0);
    });
});
