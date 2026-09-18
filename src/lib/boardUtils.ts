import type { Square } from 'chess.js';

import wP from '../assets/pieces/pawn-w.svg';
import wR from '../assets/pieces/rook-w.svg';
import wN from '../assets/pieces/nightrd-w.svg';
import wB from '../assets/pieces/bishop-w.svg';
import wQ from '../assets/pieces/amazon-w.svg';
import wK from '../assets/pieces/grassh-w.svg';

import bP from '../assets/pieces/pawn-b.svg';
import bR from '../assets/pieces/rook-b.svg';
import bN from '../assets/pieces/nightrd-b.svg';
import bB from '../assets/pieces/bishop-b.svg';
import bQ from '../assets/pieces/amazon-b.svg';
import bK from '../assets/pieces/grassh-b.svg';

export const PIECE_IMAGES = {
    w: { p: wP, r: wR, n: wN, b: wB, q: wQ, k: wK },
    b: { p: bP, r: bR, n: bN, b: bB, q: bQ, k: bK },
};

// Người chơi luôn cầm Trắng; máy (chế độ PvE) luôn cầm Đen.
export const AI_COLOR = 'b';
export const HUMAN_COLOR = 'w';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const coordsToSquare = (row: number, col: number): Square => {
    return `${FILES[col]}${RANKS[row]}` as Square;
};

export const squareToCoords = (square: Square): { row: number; col: number } => {
    return { row: RANKS.indexOf(square[1]), col: FILES.indexOf(square[0]) };
};

export const colorLabel = (color: 'w' | 'b') => (color === 'w' ? 'Trắng' : 'Đen');

export const formatTime = (seconds: number | null) => {
    if (seconds === null) return '∞';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};
