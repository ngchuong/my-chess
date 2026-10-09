import type { MoveQuality } from '../../types/analysis';

export const QUALITY_LABELS: Record<MoveQuality, string> = {
    brilliant: 'Thiên tài',
    great: 'Tuyệt vời',
    best: 'Tốt nhất',
    excellent: 'Xuất sắc',
    good: 'Tốt',
    inaccuracy: 'Thiếu chính xác',
    mistake: 'Sai lầm',
    miss: 'Bỏ lỡ',
    blunder: 'Nước hớ',
};

// Ký hiệu theo quy ước chú giải cờ vua (!!, !, ?!, ?, ??) — ai từng xem chess.com/lichess
// đều đọc được ngay — cộng thêm biểu tượng cho các mức không có ký hiệu truyền thống.
export const QUALITY_SYMBOLS: Record<MoveQuality, string> = {
    brilliant: '!!',
    great: '!',
    best: '★',
    excellent: '👍',
    good: '✓',
    inaccuracy: '?!',
    mistake: '?',
    miss: '✕',
    blunder: '??',
};

// Bảng màu theo chess.com để người chơi quen là nhận ra: xanh ngọc cho Thiên tài, xanh
// dương cho Tuyệt vời, các sắc xanh lá cho nước tốt, vàng → cam → đỏ cho nước dở.
export const QUALITY_BADGE_CLASSES: Record<MoveQuality, string> = {
    brilliant: 'bg-[#1baca6]',
    great: 'bg-[#5c8bb0]',
    best: 'bg-[#81b64c]',
    excellent: 'bg-[#96bc4b]',
    good: 'bg-[#97af8b]',
    inaccuracy: 'bg-[#f0c15c]',
    mistake: 'bg-[#e6912c]',
    miss: 'bg-[#ee6b55]',
    blunder: 'bg-[#ca3431]',
};

export const QUALITY_TEXT_CLASSES: Record<MoveQuality, string> = {
    brilliant: 'text-[#26c2bb]',
    great: 'text-[#7fa8cc]',
    best: 'text-[#95c75f]',
    excellent: 'text-[#a6c95f]',
    good: 'text-[#a9c09d]',
    inaccuracy: 'text-[#f0c15c]',
    mistake: 'text-[#f0a040]',
    miss: 'text-[#f27d69]',
    blunder: 'text-[#e8504c]',
};

// Lời giải thích ngắn cho từng mức, hiện khi đang xem nước đó.
export const QUALITY_DESCRIPTIONS: Record<MoveQuality, string> = {
    brilliant: 'Thí quân đúng lúc — nước mạnh nhất dù trông như bỏ quân.',
    great: 'Gần như nước duy nhất giữ được thế cờ.',
    best: 'Đúng nước engine chọn.',
    excellent: 'Gần như ngang nước tốt nhất.',
    good: 'Nước ổn, mất rất ít lợi thế.',
    inaccuracy: 'Có nước tốt hơn rõ rệt.',
    mistake: 'Đánh rơi đáng kể lợi thế.',
    miss: 'Đối thủ vừa đi sai, nhưng bạn bỏ lỡ cơ hội trừng phạt.',
    blunder: 'Sai lầm nghiêm trọng, thế cờ đổi chiều.',
};
