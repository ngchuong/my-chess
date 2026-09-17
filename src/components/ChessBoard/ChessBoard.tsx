import { useEffect, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import type { GameSettings } from '../../types/game';

import wP from '../../assets/pieces/pawn-w.svg';
import wR from '../../assets/pieces/rook-w.svg';
import wN from '../../assets/pieces/nightrd-w.svg';
import wB from '../../assets/pieces/bishop-w.svg';
import wQ from '../../assets/pieces/amazon-w.svg';
import wK from '../../assets/pieces/grassh-w.svg';

import bP from '../../assets/pieces/pawn-b.svg'
import bR from '../../assets/pieces/rook-b.svg'
import bN from '../../assets/pieces/nightrd-b.svg';
import bB from '../../assets/pieces/bishop-b.svg';
import bQ from '../../assets/pieces/amazon-b.svg'
import bK from '../../assets/pieces/grassh-b.svg';

const PIECE_IMAGES = {
    w: { p: wP, r: wR, n: wN, b: wB, q: wQ, k: wK },
    b: { p: bP, r: bR, n: bN, b: bB, q: bQ, k: bK }
};

const AI_COLOR = 'b';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const coordsToSquare = (row: number, col: number): Square => {
    return `${FILES[col]}${RANKS[row]}` as Square;
};

interface LastMove {
    from: Square;
    to: Square;
    san: string;
    color: 'w' | 'b';
}

interface AIWorkerMove {
    from: string;
    to: string;
    promotion?: string;
    san: string;
    color: 'w' | 'b';
}

const colorLabel = (color: 'w' | 'b') => (color === 'w' ? 'Trắng' : 'Đen');

const formatTime = (seconds: number | null) => {
    if (seconds === null) return '∞';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

interface ChessBoardProps {
    readonly settings: GameSettings;
    readonly onExit: () => void;
}

const DIFFICULTY_LABELS: Record<GameSettings['difficulty'], string> = {
    easy: 'Dễ',
    medium: 'Trung bình',
    hard: 'Khó',
};

export default function ChessBoard({ settings, onExit }: ChessBoardProps) {
    const [game, setGame] = useState(new Chess());
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
    const [lastMove, setLastMove] = useState<LastMove | null>(null);

    const initialSeconds = settings.timeControlMinutes === null ? null : settings.timeControlMinutes * 60;
    const [whiteTime, setWhiteTime] = useState<number | null>(initialSeconds);
    const [blackTime, setBlackTime] = useState<number | null>(initialSeconds);
    const [flagFall, setFlagFall] = useState<'w' | 'b' | null>(null);

    const gameRef = useRef(game);
    const aiThinkingRef = useRef(false);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        gameRef.current = game;
    }, [game]);

    // Tạo Web Worker để tính nước đi AI ở luồng riêng — tránh đơ giao diện khi
    // độ khó cao cần suy nghĩ tới cả giây.
    useEffect(() => {
        if (settings.mode !== 'pve') return;

        const worker = new Worker(new URL('../../lib/chessAI.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        return () => {
            worker.terminate();
            workerRef.current = null;
        };
    }, [settings.mode]);

    const isGameOver = game.isGameOver() || flagFall !== null;
    const board = game.board();

    // Đồng hồ đếm ngược cho bên đang tới lượt.
    useEffect(() => {
        if (settings.timeControlMinutes === null || isGameOver) return;

        const id = setInterval(() => {
            const turn = gameRef.current.turn();
            if (turn === 'w') {
                setWhiteTime((prev) => {
                    if (prev === null) return prev;
                    if (prev <= 1) {
                        setFlagFall('w');
                        return 0;
                    }
                    return prev - 1;
                });
            } else {
                setBlackTime((prev) => {
                    if (prev === null) return prev;
                    if (prev <= 1) {
                        setFlagFall('b');
                        return 0;
                    }
                    return prev - 1;
                });
            }
        }, 1000);

        return () => clearInterval(id);
    }, [settings.timeControlMinutes, isGameOver]);

    // AI đi khi đến lượt của máy — tính toán trong Web Worker để không chặn UI.
    useEffect(() => {
        const worker = workerRef.current;
        if (!worker || settings.mode !== 'pve' || isGameOver || game.turn() !== AI_COLOR || aiThinkingRef.current) {
            return;
        }

        aiThinkingRef.current = true;
        const fen = game.fen();

        const handleMessage = (event: MessageEvent<AIWorkerMove | null>) => {
            aiThinkingRef.current = false;
            const move = event.data;
            if (!move) return;
            const aiGame = new Chess(fen);
            const appliedMove = aiGame.move({ from: move.from, to: move.to, promotion: move.promotion });
            setLastMove({ from: appliedMove.from, to: appliedMove.to, san: appliedMove.san, color: appliedMove.color });
            setGame(aiGame);
        };

        worker.addEventListener('message', handleMessage);
        worker.postMessage({ fen, difficulty: settings.difficulty });

        return () => {
            worker.removeEventListener('message', handleMessage);
            aiThinkingRef.current = false;
        };
    }, [game, settings.mode, settings.difficulty, isGameOver]);

    const resetGame = () => {
        setGame(new Chess());
        setSelectedSquare(null);
        setPossibleMoves([]);
        setLastMove(null);
        setWhiteTime(initialSeconds);
        setBlackTime(initialSeconds);
        setFlagFall(null);
    };

    const handleSquareClick = (row: number, col: number) => {
        if (isGameOver) return;
        if (settings.mode === 'pve' && game.turn() === AI_COLOR) return;

        const squareNotation = coordsToSquare(row, col);
        const pieceOnSquare = game.get(squareNotation);

        // 1. Chọn quân cờ
        if (pieceOnSquare?.color === game.turn()) {
            setSelectedSquare(squareNotation);
            const moves = game.moves({ square: squareNotation, verbose: true });
            setPossibleMoves(moves.map(m => m.to));
            return;
        }

        // 2. Di chuyển quân cờ
        if (selectedSquare) {
            try {
                const move = game.move({
                    from: selectedSquare,
                    to: squareNotation,
                    promotion: 'q'
                });

                if (move) {
                    setLastMove({ from: move.from, to: move.to, san: move.san, color: move.color });
                    setGame(new Chess(game.fen()));
                }
            } catch (error) {
                // Nước đi không hợp lệ
            }

            setSelectedSquare(null);
            setPossibleMoves([]);
        }
    };

    const getGameStatus = () => {
        if (isGameOver) return 'Trận đấu đã kết thúc';
        if (game.inCheck()) return `Đang bị Chiếu! Lượt của: ${colorLabel(game.turn())}`;
        if (settings.mode === 'pve' && game.turn() === AI_COLOR) return 'Máy đang suy nghĩ...';
        return `Lượt đi: ${colorLabel(game.turn())}`;
    };

    const getGameOverInfo = (): { title: string; detail: string } | null => {
        if (flagFall) {
            const winner = flagFall === 'w' ? 'b' : 'w';
            return { title: 'Hết giờ!', detail: `Bên ${colorLabel(winner)} thắng!` };
        }
        if (game.isCheckmate()) {
            const winner = game.turn() === 'w' ? 'b' : 'w';
            return { title: 'Chiếu hết!', detail: `Bên ${colorLabel(winner)} thắng!` };
        }
        if (game.isStalemate()) {
            return { title: 'Hòa cờ!', detail: 'Hết nước đi hợp lệ (Stalemate)' };
        }
        if (game.isThreefoldRepetition()) {
            return { title: 'Hòa cờ!', detail: 'Lặp lại vị trí 3 lần' };
        }
        if (game.isInsufficientMaterial()) {
            return { title: 'Hòa cờ!', detail: 'Không đủ quân để chiếu hết' };
        }
        if (game.isDraw()) {
            return { title: 'Hòa cờ!', detail: 'Hòa theo luật 50 nước đi' };
        }
        return null;
    };

    const gameOverInfo = getGameOverInfo();

    const modeLabel = settings.mode === 'pvp'
        ? '2 người'
        : `Đấu với máy (${DIFFICULTY_LABELS[settings.difficulty]})`;

    const lastMoveLabel = lastMove
        ? `Nước đi vừa xong: ${colorLabel(lastMove.color)} ${lastMove.san}`
        : null;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white select-none p-4">
            <div className="flex items-center gap-3 mb-2 text-sm text-slate-400">
                <span>{modeLabel}</span>
                <button
                    onClick={onExit}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-200 cursor-pointer transition-colors"
                >
                    Về menu
                </button>
            </div>

            {/* Thông báo trạng thái */}
            <h2 className="text-2xl font-bold mb-1 tracking-wide text-slate-100">
                {getGameStatus()}
            </h2>

            {/* Nước đi vừa xong */}
            <p className="text-sm text-slate-400 mb-3 h-5">{lastMoveLabel}</p>

            {/* Đồng hồ */}
            <div className="flex justify-between w-full max-w-xs sm:max-w-sm mb-3">
                <div className={`px-4 py-1.5 rounded-lg font-mono text-lg ${game.turn() === 'b' && !isGameOver ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                    Đen: {formatTime(blackTime)}
                </div>
                <div className={`px-4 py-1.5 rounded-lg font-mono text-lg ${game.turn() === 'w' && !isGameOver ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                    Trắng: {formatTime(whiteTime)}
                </div>
            </div>

            {/* Khung Bàn cờ với tọa độ */}
            <div className="border-4 border-slate-700 rounded-lg overflow-hidden shadow-2xl bg-slate-800">
                {board.map((row, rowIndex) => (
                    <div key={RANKS[rowIndex]} className="flex">
                        <div className="w-5 sm:w-6 flex items-center justify-center text-xs font-semibold text-slate-400">
                            {RANKS[rowIndex]}
                        </div>
                        {row.map((square, colIndex) => {
                            const squareNotation = coordsToSquare(rowIndex, colIndex);
                            const isDark = (rowIndex + colIndex) % 2 === 1;
                            const isSelected = selectedSquare === squareNotation;
                            const isPossibleMove = possibleMoves.includes(squareNotation);
                            const isLastMove = lastMove !== null && (lastMove.from === squareNotation || lastMove.to === squareNotation);

                            return (
                                <button
                                    key={FILES[colIndex]}
                                    onClick={() => handleSquareClick(rowIndex, colIndex)}
                                    className={`
                    relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center cursor-pointer transition-colors duration-150
                    ${isDark ? 'bg-board-dark' : 'bg-board-light'}
                    ${isSelected ? 'bg-board-selected!' : ''}
                    hover:brightness-95
                  `}
                                >
                                    {isLastMove && !isSelected && (
                                        <div className="absolute inset-0 bg-yellow-300/25 pointer-events-none" />
                                    )}

                                    {isPossibleMove && (
                                        <div className="absolute w-4 h-4 bg-black/30 rounded-full z-10 pointer-events-none" />
                                    )}

                                    {/* Quân cờ SVG */}
                                    {square && (
                                        <img
                                            src={PIECE_IMAGES[square.color][square.type]}
                                            alt={`${square.color} ${square.type}`}
                                            className={`w-[85%] h-[85%] object-contain pointer-events-none transition-transform duration-100 ${isSelected ? 'scale-110' : ''
                                                }`}
                                            draggable={false}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
                <div className="flex">
                    <div className="w-5 sm:w-6 h-5 sm:h-6" />
                    {FILES.map((file) => (
                        <div
                            key={file}
                            className="w-14 sm:w-16 h-5 sm:h-6 flex items-center justify-center text-xs font-semibold text-slate-400"
                        >
                            {file}
                        </div>
                    ))}
                </div>
            </div>

            {/* Nút Ván mới */}
            <button
                onClick={resetGame}
                className="mt-6 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md transition-all active:scale-95 cursor-pointer"
            >
                Ván mới
            </button>

            {/* Thông báo kết thúc trận */}
            {gameOverInfo && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
                        <h3 className="text-3xl font-bold text-slate-100">{gameOverInfo.title}</h3>
                        <p className="text-lg text-slate-300">{gameOverInfo.detail}</p>
                        <div className="flex gap-3 justify-center pt-2">
                            <button
                                onClick={resetGame}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold cursor-pointer transition-colors"
                            >
                                Ván mới
                            </button>
                            <button
                                onClick={onExit}
                                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold cursor-pointer transition-colors"
                            >
                                Về menu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
