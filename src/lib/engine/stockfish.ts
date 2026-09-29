// Cầu nối tới Stockfish (bản WASM lite, đơn luồng) chạy trong Web Worker, nói chuyện
// bằng giao thức UCI.
//
// Engine nằm trong `public/engine/` chứ không đi qua bundler: file .wasm gần 1,8MB,
// đưa vào bundle sẽ làm phình gói JS và mất khả năng cache riêng. Worker chỉ được tạo
// ở lần dùng đầu tiên, nên ván PvP không bật gợi ý sẽ không tải một byte engine nào.
//
// Chỉ có duy nhất một instance dùng chung cho cả máy đối thủ, gợi ý và chấm điểm ván
// đấu: engine mỗi lúc chỉ chạy được một lệnh tìm kiếm, và mỗi instance chiếm thêm vài
// chục MB bộ nhớ, nên các yêu cầu được xếp hàng thay vì mở thêm engine.

// BASE_URL để app vẫn chạy đúng khi deploy dưới thư mục con (ví dụ GitHub Pages).
const ENGINE_SCRIPT = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`;

// Engine báo thế chiếu hết bằng "score mate N" thay vì centipawn. Quy về một con số
// lớn để mọi nơi so sánh/sắp xếp được thống nhất, vẫn giữ "chiếu hết nhanh hơn thì tốt hơn".
export const MATE_SCORE_CP = 10000;

// Trên ngưỡng này thì con số không còn là lợi thế vật chất mà là thắng/thua cưỡng bức.
export const MATE_THRESHOLD_CP = 9000;

const BOOT_TIMEOUT_MS = 30000;

// Chặn trên cho một lượt tìm kiếm: nếu vì lý do nào đó engine không trả `bestmove`,
// hàng đợi sẽ kẹt vĩnh viễn, nên luôn phải có đường thoát.
const SEARCH_TIMEOUT_MS = 60000;

export interface PvLine {
    depth: number;
    // Điểm theo góc nhìn của bên đang tới lượt (dương = bên đó có lợi), đơn vị centipawn.
    scoreCp: number;
    // Số nước tới chiếu hết (dương = bên tới lượt thắng); null nếu không phải thế chiếu hết.
    mateIn: number | null;
    // Cả biến engine dự kiến, dạng UCI ("e2e4", "e7e8q"); phần tử đầu là nước được đề xuất.
    moves: string[];
}

export interface AnalysisResult {
    // Nước tốt nhất dạng UCI; null khi vị trí đã hết nước đi (chiếu hết/hòa).
    bestMove: string | null;
    // Các phương án, sắp theo thứ tự tốt dần giảm (multipv 1, 2, ...).
    lines: PvLine[];
}

export interface AnalyseRequest {
    fen: string;
    // Chọn một trong hai: `depth` cho kết quả ổn định (chấm điểm ván đấu cần mọi nước
    // được xét cùng một mức), `movetime` cho độ trễ ổn định (máy đi, gợi ý).
    depth?: number;
    movetimeMs?: number;
    multipv?: number;
    // Có giá trị = giới hạn sức cờ về mức Elo đó (dùng cho máy đối thủ).
    // Bỏ trống = engine chơi hết sức (dùng cho gợi ý và chấm điểm).
    elo?: number;
    // Xoá bảng băm trước khi tìm — dùng khi bắt đầu phân tích một ván mới để kết quả
    // không phụ thuộc vào những gì engine đã tính trước đó.
    freshGame?: boolean;
}

type LineListener = (line: string) => void;

interface EngineSession {
    send: (command: string) => void;
    subscribe: (listener: LineListener) => () => void;
    setOption: (name: string, value: string | number | boolean) => void;
}

let sessionPromise: Promise<EngineSession> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function createSession(): Promise<EngineSession> {
    return new Promise((resolve, reject) => {
        let worker: Worker;
        try {
            worker = new Worker(ENGINE_SCRIPT);
        } catch {
            reject(new Error('Trình duyệt không tạo được Web Worker cho engine.'));
            return;
        }

        const listeners = new Set<LineListener>();
        const appliedOptions = new Map<string, string>();

        worker.onmessage = (event: MessageEvent<string>) => {
            if (typeof event.data !== 'string') return;
            for (const listener of listeners) listener(event.data);
        };

        const send = (command: string) => worker.postMessage(command);

        const session: EngineSession = {
            send,
            subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            setOption(name, value) {
                // Option là trạng thái toàn cục của engine và không đổi giữa phần lớn các
                // lần tìm kiếm — chỉ gửi lại khi giá trị thực sự khác.
                const text = String(value);
                if (appliedOptions.get(name) === text) return;
                appliedOptions.set(name, text);
                send(`setoption name ${name} value ${text}`);
            },
        };

        const fail = (message: string) => {
            worker.terminate();
            // Cho phép thử lại ở lần dùng sau thay vì hỏng vĩnh viễn.
            sessionPromise = null;
            reject(new Error(message));
        };

        const timer = setTimeout(() => fail('Engine không phản hồi khi khởi động.'), BOOT_TIMEOUT_MS);
        worker.onerror = () => {
            clearTimeout(timer);
            fail('Không tải được engine Stockfish.');
        };

        const unsubscribe = session.subscribe((line) => {
            if (!line.startsWith('uciok')) return;
            clearTimeout(timer);
            unsubscribe();
            resolve(session);
        });

        send('uci');
    });
}

// Tải engine (nếu chưa) và trả về phiên làm việc dùng chung. Gọi sớm để "làm nóng":
// lần tải đầu mất khoảng 1,8MB nên tốt nhất là bắt đầu ngay khi vào ván PvE, trước
// khi thực sự cần đến nước đi đầu tiên.
export function getEngine(): Promise<EngineSession> {
    sessionPromise ??= createSession();
    return sessionPromise;
}

function mateToCp(mateIn: number): number {
    return mateIn > 0 ? MATE_SCORE_CP - mateIn : -MATE_SCORE_CP - mateIn;
}

const SCORE_PATTERN = /score (cp|mate) (-?\d+)/;
const DEPTH_PATTERN = / depth (\d+)/;
const MULTIPV_PATTERN = / multipv (\d+)/;

function parseInfoLine(line: string): { multipv: number; pv: PvLine } | null {
    if (!line.startsWith('info ') || !line.includes(' pv ')) return null;
    // Dòng "lowerbound"/"upperbound" chỉ là chặn trên/dưới giữa chừng, chưa phải điểm
    // thật của biến đó — dùng sẽ ra đánh giá sai lệch.
    if (line.includes('lowerbound') || line.includes('upperbound')) return null;

    const score = SCORE_PATTERN.exec(line);
    if (!score) return null;

    const value = Number(score[2]);
    const isMate = score[1] === 'mate';

    return {
        multipv: Number(MULTIPV_PATTERN.exec(line)?.[1] ?? 1),
        pv: {
            depth: Number(DEPTH_PATTERN.exec(line)?.[1] ?? 0),
            scoreCp: isMate ? mateToCp(value) : value,
            mateIn: isMate ? value : null,
            moves: line.slice(line.indexOf(' pv ') + 4).trim().split(' '),
        },
    };
}

function runSearch(session: EngineSession, request: AnalyseRequest): Promise<AnalysisResult> {
    session.setOption('MultiPV', request.multipv ?? 1);

    if (request.elo === undefined) {
        session.setOption('UCI_LimitStrength', false);
    } else {
        session.setOption('UCI_LimitStrength', true);
        session.setOption('UCI_Elo', request.elo);
    }

    return new Promise((resolve) => {
        const lines = new Map<number, PvLine>();

        const finish = (bestMove: string | null) => {
            clearTimeout(timer);
            unsubscribe();
            resolve({
                bestMove,
                lines: [...lines.entries()].sort(([a], [b]) => a - b).map(([, pv]) => pv),
            });
        };

        const unsubscribe = session.subscribe((line) => {
            const info = parseInfoLine(line);
            if (info) {
                lines.set(info.multipv, info.pv);
                return;
            }
            if (!line.startsWith('bestmove')) return;

            const move = line.split(' ')[1];
            finish(move && move !== '(none)' ? move : null);
        });

        // Không bao giờ để hàng đợi kẹt vì một lệnh tìm kiếm không kết thúc.
        const timer = setTimeout(() => finish(null), SEARCH_TIMEOUT_MS);

        if (request.freshGame) session.send('ucinewgame');
        session.send(`position fen ${request.fen}`);
        session.send(request.depth ? `go depth ${request.depth}` : `go movetime ${request.movetimeMs ?? 300}`);
    });
}

// Phân tích một vị trí. Các yêu cầu được xếp hàng vì engine chỉ chạy được một lệnh
// tìm kiếm tại một thời điểm.
export function analyse(request: AnalyseRequest): Promise<AnalysisResult> {
    const task = async () => runSearch(await getEngine(), request);
    // `then(task, task)` để một yêu cầu lỗi không chặn đứng mọi yêu cầu sau nó.
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
}

// Dừng sớm lệnh tìm kiếm đang chạy (engine sẽ trả `bestmove` ngay). Dùng khi kết quả
// không còn cần nữa — ví dụ người chơi đã đi tiếp, hoặc rời màn hình xem lại — để
// không đốt CPU vô ích và để yêu cầu kế tiếp được phục vụ ngay.
export function stopSearch(): void {
    sessionPromise?.then((session) => session.send('stop'), () => undefined);
}

// Tách nước đi UCI ("e2e4", "e7e8q") thành các phần chess.js cần.
export function parseUciMove(uci: string): { from: string; to: string; promotion?: string } {
    return {
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
    };
}
