import type { PieceColor } from '../types/chess';
import type { GameSettings } from '../types/game';

const STORAGE_KEY = 'chess-saved-game';

// Ván đang chơi dở, lưu lại sau mỗi thay đổi để tải lại trang (hoặc lỡ tay đóng tab)
// vẫn chơi tiếp được. Chỉ lưu nước đi (SAN) — mọi trạng thái khác dựng lại bằng cách
// đi lại từ đầu, nên không có chuyện dữ liệu lưu lệch với luật cờ.
export interface SavedGame {
    settings: GameSettings;
    sanMoves: string[];
    // Thời gian còn lại (giây) của mỗi bên; null khi ván không giới hạn thời gian.
    clockSeconds: Record<PieceColor, number | null>;
}

function isSavedGame(value: unknown): value is SavedGame {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Partial<SavedGame>;
    return (
        typeof v.settings === 'object' && v.settings !== null &&
        (v.settings.playerColor === 'w' || v.settings.playerColor === 'b') &&
        Array.isArray(v.sanMoves) && v.sanMoves.every((m) => typeof m === 'string') &&
        typeof v.clockSeconds === 'object' && v.clockSeconds !== null
    );
}

export function loadSavedGame(): SavedGame | null {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isSavedGame(parsed) && parsed.sanMoves.length > 0 ? parsed : null;
    } catch {
        return null;
    }
}

export function saveGame(saved: SavedGame) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
        // localStorage không khả dụng (chế độ riêng tư, hết dung lượng...) — bỏ qua.
    }
}

export function clearSavedGame() {
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Như trên.
    }
}
