import { Chess } from 'chess.js';
import type { MoveRecord } from '../types/analysis';

// Kết quả theo chuẩn PGN: "1-0" Trắng thắng, "0-1" Đen thắng, "1/2-1/2" hòa, "*" chưa xong.
export type PgnResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export interface PgnInfo {
    white: string;
    black: string;
    result: PgnResult;
    timeControlMinutes: number | null;
}

const formatPgnDate = (date: Date) =>
    `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

// Xuất ván đấu ra PGN để mở lại trên lichess/chess.com hoặc bất kỳ phần mềm cờ nào.
export function buildPgn(moveHistory: readonly MoveRecord[], info: PgnInfo): string {
    const game = new Chess();
    for (const record of moveHistory) game.move(record.san);

    game.setHeader('Event', "Chuong's Chess");
    game.setHeader('Date', formatPgnDate(new Date()));
    game.setHeader('White', info.white);
    game.setHeader('Black', info.black);
    game.setHeader('Result', info.result);
    game.setHeader('TimeControl', info.timeControlMinutes === null ? '-' : String(info.timeControlMinutes * 60));

    // chess.js không tự ghi kết quả vào cuối danh sách nước khi ván kết thúc do đầu
    // hàng/hết giờ/thỏa thuận hòa — thêm vào nếu thiếu để file PGN hợp lệ.
    const pgn = game.pgn();
    return pgn.trimEnd().endsWith(info.result) ? pgn : `${pgn.trimEnd()} ${info.result}`;
}

export function downloadPgn(pgn: string) {
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chuongs-chess-${new Date().toISOString().slice(0, 10)}.pgn`;
    link.click();
    // Thu hồi ngay sau click có thể huỷ lượt tải ở một số trình duyệt — chờ một nhịp.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
