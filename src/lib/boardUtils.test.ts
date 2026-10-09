import { describe, expect, it } from 'vitest';
import { coordsToSquare, formatTime, oppositeColor, squareToCoords } from './boardUtils';

describe('coordsToSquare / squareToCoords', () => {
    it('góc nhìn Trắng: a8 ở góc trên trái, h1 ở góc dưới phải', () => {
        expect(coordsToSquare(0, 0)).toBe('a8');
        expect(coordsToSquare(7, 7)).toBe('h1');
        expect(squareToCoords('e2')).toEqual({ row: 6, col: 4 });
    });

    it('bàn cờ xoay (góc nhìn Đen): h1 ở góc trên trái, a8 ở góc dưới phải', () => {
        expect(coordsToSquare(0, 0, true)).toBe('h1');
        expect(coordsToSquare(7, 7, true)).toBe('a8');
        expect(squareToCoords('e2', true)).toEqual({ row: 1, col: 3 });
    });

    it('hai hàm là nghịch đảo của nhau ở cả hai chiều bàn cờ', () => {
        for (const flipped of [false, true]) {
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    expect(squareToCoords(coordsToSquare(row, col, flipped), flipped)).toEqual({ row, col });
                }
            }
        }
    });
});

describe('oppositeColor', () => {
    it('đổi màu quân', () => {
        expect(oppositeColor('w')).toBe('b');
        expect(oppositeColor('b')).toBe('w');
    });
});

describe('formatTime', () => {
    it('định dạng phút:giây, không giới hạn thì là ∞', () => {
        expect(formatTime(null)).toBe('∞');
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(65)).toBe('1:05');
        expect(formatTime(600)).toBe('10:00');
    });
});
