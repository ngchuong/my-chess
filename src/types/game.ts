import type { PieceColor } from './chess';

export type GameMode = 'pvp' | 'pve';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type TimeControlMinutes = 1 | 3 | 5 | 10 | 15 | 30 | null;

export interface GameSettings {
    mode: GameMode;
    difficulty: Difficulty;
    timeControlMinutes: TimeControlMinutes;
    // Hiện gợi ý nước đi tốt nhất kèm lý do mỗi khi đến lượt người chơi. Chỉ có tác
    // dụng ở chế độ đấu với máy — ở PvP thì gợi ý sẽ lộ nước cho cả hai bên.
    showHints: boolean;
    // Màu quân người chơi cầm ở chế độ đấu với máy (Trắng đi trước, Đen đi sau); máy
    // cầm màu còn lại. Ở PvP không dùng tới.
    playerColor: PieceColor;
}
