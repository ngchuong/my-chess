import { evaluateMove } from './chessAI';
import type { MoveAnalysis, MoveRecord } from '../types/analysis';

// Độ sâu tìm kiếm dùng để chấm điểm mỗi nước — cố định (không tìm sâu dần theo
// thời gian như lúc chơi thật) để mọi nước trong ván được chấm cùng một "trình độ",
// đảm bảo so sánh công bằng giữa các nước với nhau.
export const ANALYSIS_DEPTH = 3;

const EXCELLENT_MAX_LOSS = 10;
const GREAT_MAX_LOSS = 40;
const NORMAL_MAX_LOSS = 120;

function classify(centipawnLoss: number): MoveAnalysis['quality'] {
    if (centipawnLoss <= EXCELLENT_MAX_LOSS) return 'excellent';
    if (centipawnLoss <= GREAT_MAX_LOSS) return 'great';
    if (centipawnLoss <= NORMAL_MAX_LOSS) return 'normal';
    return 'bad';
}

// Phân tích toàn bộ ván đấu: với mỗi nước đã đi, so sánh với nước tốt nhất engine
// tìm được ở cùng vị trí và xếp loại theo mức thiệt hại (centipawn loss).
export function analyzeGame(history: MoveRecord[]): MoveAnalysis[] {
    return history.map((record) => {
        const evaluation = evaluateMove(record.fenBefore, record, ANALYSIS_DEPTH);

        if (!evaluation) {
            return { ...record, quality: 'normal', centipawnLoss: 0, bestSan: record.san };
        }

        const centipawnLoss = Math.max(0, evaluation.bestScoreForMover - evaluation.playedScoreForMover);

        return {
            ...record,
            quality: classify(centipawnLoss),
            centipawnLoss,
            bestSan: evaluation.bestSan,
        };
    });
}
