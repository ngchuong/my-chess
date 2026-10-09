import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { Square as SquareName } from 'chess.js';
import { colorLabel, oppositeColor } from '../../lib/boardUtils';
import { CAPTURE_CLEANUP_MS, MOVE_SLIDE_MS, PROMOTE_CLEANUP_MS } from '../../lib/animation';
import { difficultyLabel } from '../../lib/engine/difficulty';
import { engineAcceptsDraw } from '../../lib/engine/drawOffer';
import { getMaterialSummary } from '../../lib/material';
import { buildPgn, downloadPgn, type PgnResult } from '../../lib/pgn';
import { clearSavedGame, saveGame, type SavedGame } from '../../lib/savedGame';
import { useAIOpponent } from '../../hooks/useAIOpponent';
import { useCheckAlert } from '../../hooks/useCheckAlert';
import { useChessClock } from '../../hooks/useChessClock';
import { useChessGame } from '../../hooks/useChessGame';
import { useEngineStatus } from '../../hooks/useEngineStatus';
import { useMoveHint } from '../../hooks/useMoveHint';
import { useMoveSelection } from '../../hooks/useMoveSelection';
import { useMoveSound } from '../../hooks/useMoveSound';
import { usePremove } from '../../hooks/usePremove';
import { useSoundSettings } from '../../hooks/useSoundSettings';
import type { LastMove, PieceColor } from '../../types/chess';
import type { GameSettings } from '../../types/game';
import MoveList from '../GameReview/MoveList';
import Board from './Board';
import ConfirmModal from './ConfirmModal';
import GameControls from './GameControls';
import GameOverModal, { type GameOverInfo } from './GameOverModal';
import GameStatus from './GameStatus';
import HintPanel from './HintPanel';
import PlayerBar from './PlayerBar';
import PromotionModal from './PromotionModal';
import TopBar from './TopBar';

// Màn hình xem lại ván chỉ mở sau khi ván kết thúc, và kéo theo cả phần chấm điểm —
// tách thành chunk riêng để người chơi không phải tải nó ngay từ đầu.
const GameReview = lazy(() => import('../GameReview/GameReview'));

interface ChessBoardProps {
    readonly settings: GameSettings;
    readonly onExit: () => void;
    // Ván đã lưu để chơi tiếp (sau khi tải lại trang). Chỉ dùng lúc khởi tạo.
    readonly resume?: Pick<SavedGame, 'sanMoves' | 'clockSeconds'>;
}

// Ván kết thúc không phải do luật cờ hay đồng hồ, mà do người chơi chủ động.
type ManualResult = { type: 'resign'; loser: PieceColor } | { type: 'agreed-draw' };

type DrawOfferState = { status: 'pending' } | { status: 'declined'; atPly: number } | null;

// Chờ animation của nước đi cuối (trượt/ăn quân/phong cấp) phát xong rồi mới hiện
// modal kết thúc trận — tránh che mất nước chiếu hết ngay khi nó vừa được thực hiện.
function getGameOverModalDelayMs(lastMove: LastMove | null): number {
    if (!lastMove) return 0;
    if (lastMove.captured) return CAPTURE_CLEANUP_MS;
    if (lastMove.promotion) return PROMOTE_CLEANUP_MS;
    return MOVE_SLIDE_MS + 50;
}

const winResult = (winner: PieceColor): PgnResult => (winner === 'w' ? '1-0' : '0-1');

export default function ChessBoard({ settings, onExit, resume }: ChessBoardProps) {
    const { game, lastMove, pieces, moveHistory, applyMove, undoMoves, resetGame: resetChessGame } =
        useChessGame(resume?.sanMoves);
    const [isReviewing, setIsReviewing] = useState(false);
    const [manualResult, setManualResult] = useState<ManualResult | null>(null);
    const [confirmAction, setConfirmAction] = useState<'resign' | 'draw' | null>(null);
    const [drawOffer, setDrawOffer] = useState<DrawOfferState>(null);
    // Tăng mỗi khi vị trí bị "nhảy" (ván mới, lùi nước): câu trả lời cầu hòa của máy
    // về vị trí cũ đến muộn thì bỏ qua.
    const positionEpochRef = useRef(0);

    const isGameOver = game.isGameOver();
    const isPve = settings.mode === 'pve';
    const humanColor = settings.playerColor;
    const aiColor = oppositeColor(humanColor);
    // Người chơi cầm Đen thì xoay bàn cờ để quân của mình nằm ở phía dưới.
    const isBoardFlipped = isPve && humanColor === 'b';

    // Engine chỉ cần cho chế độ đấu với máy — ván PvP không tải một byte nào. Bắt đầu
    // tải ngay khi vào ván để nó sẵn sàng trước khi máy phải đi nước đầu tiên.
    const engineStatus = useEngineStatus(isPve);

    // Đồng hồ chỉ chạy từ sau nước đi đầu tiên (như chess.com/lichess), và ở PvE thì
    // dừng khi engine chưa sẵn sàng — thời gian tải engine (~1,8MB lần đầu) không được
    // tính vào giờ của máy.
    const isClockRunning = moveHistory.length > 0 && (!isPve || engineStatus === 'ready');
    const { whiteTime, blackTime, flagFall, resetClock } = useChessClock(
        game,
        settings.timeControlMinutes,
        isGameOver || manualResult !== null,
        isClockRunning,
        resume?.clockSeconds,
    );
    const { muted, toggleMuted, playMove, playCapture, playCheck } = useSoundSettings();

    const isMatchOver = isGameOver || flagFall !== null || manualResult !== null;
    const [showGameOverModal, setShowGameOverModal] = useState(false);

    useEffect(() => {
        if (!isMatchOver) {
            setShowGameOverModal(false);
            return;
        }

        // Hết giờ/đầu hàng/thỏa thuận hòa dừng ván ngay, không có animation nào đang
        // chạy nên hiện modal luôn; còn chiếu hết/hòa cờ thì chờ animation nước cuối.
        if (flagFall !== null || manualResult !== null) {
            setShowGameOverModal(true);
            return;
        }

        const timer = setTimeout(() => setShowGameOverModal(true), getGameOverModalDelayMs(lastMove));
        return () => clearTimeout(timer);
    }, [isMatchOver, flagFall, manualResult, lastMove]);

    // Lưu ván sau mỗi thay đổi để tải lại trang vẫn chơi tiếp được; ván đã xong (hoặc
    // chưa có nước nào) thì không còn gì để tiếp tục.
    useEffect(() => {
        if (isMatchOver || moveHistory.length === 0) {
            clearSavedGame();
            return;
        }
        saveGame({
            settings,
            sanMoves: moveHistory.map((m) => m.san),
            clockSeconds: { w: whiteTime, b: blackTime },
        });
    }, [settings, moveHistory, whiteTime, blackTime, isMatchOver]);

    useAIOpponent(game, applyMove, settings.mode, settings.difficulty, aiColor, isMatchOver);

    // Gợi ý chỉ dành cho chế độ đấu với máy: ở PvP, hai người dùng chung một bàn cờ
    // nên hiện nước tốt nhất sẽ lộ nước đi cho cả hai bên.
    const isHintEnabled = isPve && settings.showHints;
    const { hint, isHintLoading } = useMoveHint(game, isHintEnabled, humanColor, isMatchOver);

    const {
        isPremoveMode,
        premoveFrom,
        premove,
        pendingPromotion: premovePendingPromotion,
        handlePremoveSquareClick,
        choosePromotion: choosePremovePromotion,
        cancelPremove,
        resetPremove,
    } = usePremove(game, applyMove, settings.mode, humanColor, isMatchOver);
    const {
        selectedSquare,
        possibleMoves,
        pendingPromotion: selectionPendingPromotion,
        handleSquareClick: handleNormalClick,
        clearSelection,
        choosePromotion: chooseSelectionPromotion,
    } = useMoveSelection(game, applyMove);

    // Chỉ một trong hai (nước đi thường hoặc premove vừa thực hiện) có thể đang chờ
    // chọn quân phong cấp tại một thời điểm — gộp lại thành một modal duy nhất.
    const pendingPromotion = selectionPendingPromotion ?? premovePendingPromotion;
    const choosePromotion = selectionPendingPromotion ? chooseSelectionPromotion : choosePremovePromotion;

    useMoveSound(lastMove, playMove, playCapture);
    const { isFlashing: isCheckFlashing, checkedKingSquare } = useCheckAlert(game, pieces, playCheck);

    const material = useMemo(() => getMaterialSummary(game.fen()), [game]);

    const resetGame = () => {
        positionEpochRef.current += 1;
        resetChessGame();
        resetClock();
        resetPremove();
        clearSelection();
        setManualResult(null);
        setConfirmAction(null);
        setDrawOffer(null);
        setIsReviewing(false);
        setShowGameOverModal(false);
    };

    // Lùi nước: PvE lùi tới trước nước gần nhất của người chơi (thường là 2 nửa nước:
    // nước của máy và nước của bạn — hoặc 1 nếu máy chưa kịp đi), PvP lùi 1 nửa nước.
    // Được lùi cả sau khi bị chiếu hết, nhưng không được lùi khi thua do hết giờ hay
    // sau khi đã đầu hàng/thỏa thuận hòa.
    const undoPlies = (() => {
        if (!isPve) return moveHistory.length > 0 ? 1 : 0;
        const lastHumanIndex = moveHistory.findLastIndex((m) => m.color === humanColor);
        return lastHumanIndex === -1 ? 0 : moveHistory.length - lastHumanIndex;
    })();
    const canUndo = undoPlies > 0 && flagFall === null && manualResult === null;

    const handleUndo = () => {
        positionEpochRef.current += 1;
        undoMoves(undoPlies);
        resetPremove();
        clearSelection();
        setDrawOffer(null);
    };

    const canResign = !isMatchOver && moveHistory.length > 0;
    const canOfferDraw = canResign && drawOffer?.status !== 'pending'
        && !(drawOffer?.status === 'declined' && drawOffer.atPly === moveHistory.length)
        && !(isPve && engineStatus !== 'ready');

    // Ở PvP cả hai ngồi chung một máy nên "cầu hòa" chỉ cần cả hai xác nhận; ở PvE thì
    // hỏi engine xem máy có chấp nhận không.
    const handleOfferDraw = () => {
        if (!isPve) {
            setConfirmAction('draw');
            return;
        }

        const epoch = positionEpochRef.current;
        const atPly = moveHistory.length;
        setDrawOffer({ status: 'pending' });
        engineAcceptsDraw(game.fen(), aiColor, atPly)
            .then((accepted) => {
                if (positionEpochRef.current !== epoch) return;
                if (accepted) {
                    setDrawOffer(null);
                    setManualResult({ type: 'agreed-draw' });
                } else {
                    setDrawOffer({ status: 'declined', atPly });
                }
            })
            .catch(() => {
                if (positionEpochRef.current === epoch) setDrawOffer(null);
            });
    };

    const handleConfirm = () => {
        if (confirmAction === 'resign') {
            // PvE người chơi đầu hàng; PvP bên đang tới lượt đầu hàng.
            setManualResult({ type: 'resign', loser: isPve ? humanColor : game.turn() });
        } else if (confirmAction === 'draw') {
            setManualResult({ type: 'agreed-draw' });
        }
        setConfirmAction(null);
        resetPremove();
        clearSelection();
    };

    const canDragFrom = (square: SquareName): boolean => {
        if (isMatchOver || pendingPromotion) return false;
        const color = game.get(square)?.color;
        return isPremoveMode ? color === humanColor : color === game.turn();
    };

    const handleSquareClick = (squareNotation: SquareName) => {
        if (isMatchOver || pendingPromotion) return;

        if (isPremoveMode) {
            handlePremoveSquareClick(squareNotation);
            return;
        }

        handleNormalClick(squareNotation);
    };

    const getGameStatus = (): string => {
        if (isMatchOver) return 'Trận đấu đã kết thúc';
        // Engine hỏng thì máy không đi được nữa — phải báo ngay ở dòng trạng thái, vì
        // người chơi có thể đã tắt gợi ý và sẽ không thấy thông báo ở bảng gợi ý.
        if (isPve && engineStatus === 'error') return 'Không tải được engine cờ';
        if (game.inCheck()) return `Đang bị Chiếu! Lượt của: ${colorLabel(game.turn())}`;
        if (isPve && game.turn() === aiColor) {
            return engineStatus === 'ready' ? 'Máy đang suy nghĩ...' : 'Đang tải engine cờ...';
        }
        return `Lượt đi: ${colorLabel(game.turn())}`;
    };

    // Đấu với máy thì nói theo góc nhìn người chơi ("Bạn thắng!") thay vì theo màu quân.
    const winnerText = (winner: PieceColor): string => {
        if (!isPve) return `Bên ${colorLabel(winner)} thắng!`;
        return winner === humanColor ? 'Bạn thắng!' : 'Máy thắng!';
    };

    const getGameOverInfo = (): GameOverInfo | null => {
        if (manualResult?.type === 'resign') {
            const who = isPve ? 'Bạn' : `Bên ${colorLabel(manualResult.loser)}`;
            return { title: `${who} đã đầu hàng`, detail: winnerText(oppositeColor(manualResult.loser)) };
        }
        if (manualResult?.type === 'agreed-draw') {
            return { title: 'Hòa cờ!', detail: isPve ? 'Máy đã đồng ý hòa' : 'Hai bên thỏa thuận hòa' };
        }
        if (flagFall) {
            return { title: 'Hết giờ!', detail: winnerText(oppositeColor(flagFall)) };
        }
        if (game.isCheckmate()) {
            return { title: 'Chiếu hết!', detail: winnerText(oppositeColor(game.turn())) };
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

    const getPgnResult = (): PgnResult => {
        if (manualResult?.type === 'resign') return winResult(oppositeColor(manualResult.loser));
        if (manualResult?.type === 'agreed-draw') return '1/2-1/2';
        if (flagFall) return winResult(oppositeColor(flagFall));
        if (game.isCheckmate()) return winResult(oppositeColor(game.turn()));
        if (isGameOver) return '1/2-1/2';
        return '*';
    };

    const playerName = (color: PieceColor): string => {
        if (!isPve) return colorLabel(color);
        return color === humanColor ? 'Bạn' : 'Máy';
    };

    const handleDownloadPgn = () => {
        const engineName = `Stockfish — ${difficultyLabel(settings.difficulty)}`;
        const pgnName = (color: PieceColor) => {
            if (!isPve) return colorLabel(color);
            return color === humanColor ? 'Người chơi' : engineName;
        };
        downloadPgn(buildPgn(moveHistory, {
            white: pgnName('w'),
            black: pgnName('b'),
            result: getPgnResult(),
            timeControlMinutes: settings.timeControlMinutes,
        }));
    };

    const getInfoLabel = (): string | null => {
        if (drawOffer?.status === 'pending') return 'Đang chờ máy trả lời lời cầu hòa...';
        if (drawOffer?.status === 'declined' && drawOffer.atPly === moveHistory.length) return 'Máy từ chối hòa';
        if (premove) return `Đã đặt trước: ${premove.from} → ${premove.to}`;
        if (premoveFrom) return `Đã chọn quân ở ${premoveFrom} — chọn ô đến để đặt trước`;
        if (lastMove) return `Nước đi vừa xong: ${colorLabel(lastMove.color)} ${lastMove.san}`;
        return null;
    };

    const modeLabel = settings.mode === 'pvp'
        ? '2 người'
        : `Đấu với máy — ${difficultyLabel(settings.difficulty)} — Bạn cầm ${colorLabel(humanColor)}`;

    if (isReviewing) {
        return (
            <Suspense fallback={<div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">Đang mở phần xem lại...</div>}>
                <GameReview moveHistory={moveHistory} onClose={() => setIsReviewing(false)} flipped={isBoardFlipped} />
            </Suspense>
        );
    }

    // Bên nằm ở mép trên bàn cờ: Đen khi nhìn từ phía Trắng, Trắng khi bàn cờ bị xoay.
    const topColor: PieceColor = isBoardFlipped ? 'w' : 'b';
    const renderPlayerBar = (color: PieceColor) => (
        <PlayerBar
            name={playerName(color)}
            color={color}
            time={color === 'w' ? whiteTime : blackTime}
            isActive={game.turn() === color && !isMatchOver}
            captured={material.captured[color]}
            advantage={material.advantage[color]}
        />
    );

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white select-none p-4">
            <TopBar modeLabel={modeLabel} onExit={onExit} muted={muted} onToggleMuted={toggleMuted} />

            <GameStatus
                statusText={getGameStatus()}
                infoLabel={getInfoLabel()}
                showCancelPremove={premove !== null}
                onCancelPremove={cancelPremove}
            />

            <div className="flex flex-col lg:flex-row gap-4 items-center lg:items-start justify-center w-full">
                <div className="flex flex-col items-center w-full max-w-120">
                    {renderPlayerBar(topColor)}

                    <Board
                        pieces={pieces}
                        onSquareClick={handleSquareClick}
                        selectedSquare={selectedSquare}
                        possibleMoves={possibleMoves}
                        lastMove={lastMove}
                        premoveFrom={premoveFrom}
                        premove={premove}
                        checkedKingSquare={checkedKingSquare}
                        isCheckFlashing={isCheckFlashing}
                        hint={hint}
                        flipped={isBoardFlipped}
                        canDragFrom={canDragFrom}
                    />

                    {renderPlayerBar(oppositeColor(topColor))}

                    <GameControls
                        undoLabel={isPve ? 'Đi lại' : 'Lùi 1 nước'}
                        canUndo={canUndo}
                        onUndo={handleUndo}
                        canOfferDraw={canOfferDraw}
                        onOfferDraw={handleOfferDraw}
                        canResign={canResign}
                        onResign={() => setConfirmAction('resign')}
                        onDownloadPgn={handleDownloadPgn}
                        onNewGame={resetGame}
                    />
                </div>

                <div className="flex flex-col gap-3 w-full max-w-120 lg:w-80 lg:mt-12">
                    {isHintEnabled && <HintPanel hint={hint} isLoading={isHintLoading} engineStatus={engineStatus} />}

                    <div className="flex flex-col h-36 lg:h-72 bg-slate-800/60 border border-slate-700 rounded-lg p-2">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-1">Nước đi</h3>
                        <div className="flex-1 min-h-0">
                            {moveHistory.length === 0
                                ? <p className="text-sm text-slate-500 px-1">Chưa có nước đi nào.</p>
                                : <MoveList moveHistory={moveHistory} ply={moveHistory.length} />}
                        </div>
                    </div>
                </div>
            </div>

            <GameOverModal
                info={showGameOverModal ? getGameOverInfo() : null}
                onNewGame={resetGame}
                onExit={onExit}
                onReviewGame={() => setIsReviewing(true)}
                onDownloadPgn={handleDownloadPgn}
            />

            {confirmAction === 'resign' && (
                <ConfirmModal
                    title={isPve ? 'Đầu hàng?' : `Bên ${colorLabel(game.turn())} đầu hàng?`}
                    detail="Ván đấu sẽ kết thúc và bạn bị xử thua."
                    confirmLabel="Đầu hàng"
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}

            {confirmAction === 'draw' && (
                <ConfirmModal
                    title="Thỏa thuận hòa?"
                    detail={`Bên ${colorLabel(game.turn())} đề nghị hòa. Bên ${colorLabel(oppositeColor(game.turn()))} có đồng ý không?`}
                    confirmLabel="Đồng ý hòa"
                    cancelLabel="Từ chối"
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}

            {pendingPromotion && (
                <PromotionModal color={pendingPromotion.color} onChoose={choosePromotion} />
            )}
        </div>
    );
}
