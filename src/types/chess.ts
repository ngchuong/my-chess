import type { Square } from 'chess.js';

export interface LastMove {
    from: Square;
    to: Square;
    san: string;
    color: 'w' | 'b';
}

export interface Premove {
    from: Square;
    to: Square;
}

export interface AIWorkerMove {
    from: string;
    to: string;
    promotion?: string;
    san: string;
    color: 'w' | 'b';
}
