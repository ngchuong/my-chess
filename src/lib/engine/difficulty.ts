import type { Difficulty } from '../../types/game';

// Độ khó được đặt bằng `UCI_Elo` của Stockfish thay vì giới hạn độ sâu tìm kiếm.
// Giới hạn độ sâu cho ra sức cờ rất thất thường (cùng một độ sâu, thế cờ yên tĩnh thì
// máy đi chuẩn, thế phức tạp thì hớ hênh), còn UCI_Elo là cơ chế giảm sức có chủ đích
// của chính engine nên mức độ ổn định hơn nhiều — và nói được với người chơi con số Elo.
//
// 1320 là mức thấp nhất bản engine này hỗ trợ (`option name UCI_Elo ... min 1320`).
const AI_STRENGTH: Record<Difficulty, { elo: number; movetimeMs: number; label: string }> = {
    easy: { elo: 1320, movetimeMs: 100, label: 'Dễ' },
    medium: { elo: 1800, movetimeMs: 200, label: 'Trung bình' },
    hard: { elo: 2400, movetimeMs: 400, label: 'Khó' },
};

export function aiStrength(difficulty: Difficulty) {
    return AI_STRENGTH[difficulty];
}

// Nhãn kèm Elo để người chơi biết mình đang đấu với mức nào, ví dụ "Khó (~2400 Elo)".
export function difficultyLabel(difficulty: Difficulty): string {
    const { label, elo } = AI_STRENGTH[difficulty];
    return `${label} (~${elo} Elo)`;
}

// Gợi ý luôn dùng engine ở mức mạnh nhất (không giới hạn Elo): người chơi hỏi "nước
// nào tốt nhất" thì phải nhận được nước tốt nhất, không phải nước của một máy bị hạ sức.
// 500ms ở bản lite đủ đạt độ sâu ~18 — quá đủ so với mọi người chơi.
export const HINT_MOVETIME_MS = 500;

// Chấm điểm ván đấu dùng độ sâu cố định thay vì thời gian, để mọi nước trong ván được
// xét ở cùng một mức và so sánh với nhau mới công bằng (máy nhanh/chậm không đổi kết quả).
// Độ sâu 12 bỏ sót khá nhiều đòn chiến thuật (nước hớ bị chấm là tốt); 14 bắt được phần
// lớn trong khi chỉ tốn ~0,15s mỗi vị trí ở bản lite.
export const REVIEW_DEPTH = 14;
