export type GameMode = 'pvp' | 'pve';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type TimeControlMinutes = 1 | 3 | 5 | 10 | 15 | 30 | null;

export interface GameSettings {
    mode: GameMode;
    difficulty: Difficulty;
    timeControlMinutes: TimeControlMinutes;
}
