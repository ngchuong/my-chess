import { Suspense, lazy, useEffect, useState } from 'react';
import { AI_COLOR, colorLabel, coordsToSquare } from '../../lib/boardUtils';
import { CAPTURE_CLEANUP_MS, MOVE_SLIDE_MS, PROMOTE_CLEANUP_MS } from '../../lib/animation';
import { difficultyLabel } from '../../lib/engine/difficulty';
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
import type { LastMove } from '../../types/chess';
import type { GameSettings } from '../../types/game';
import Button from '../ui/Button';
import Board from './Board';
import ClockPanel from './ClockPanel';
import GameOverModal, { type GameOverInfo } from './GameOverModal';
import GameStatus from './GameStatus';
import HintPanel from './HintPanel';
import PromotionModal from './PromotionModal';
import TopBar from './TopBar';

// Màn hình xem lại ván chỉ mở sau khi ván kết thúc, và kéo theo cả phần chấm điểm —
// tách thành chunk riêng để người chơi không phải tải nó ngay từ đầu.
const GameReview = lazy(() => import('../GameReview/GameReview'));

interface ChessBoardProps {
    readonly settings: GameSettings;
    readonly onExit: () => void;
}

// Chờ animation của nước đi cuối (trượt/ăn quân/phong cấp) phát xong rồi mới hiện
// modal kết thúc trận — tránh che mất nước chiếu hết ngay khi nó vừa được thực hiện.
function getGameOverModalDelayMs(lastMove: LastMove | null): number {
    if (!lastMove) return 0;
    if (lastMove.captured) return CAPTURE_CLEANUP_MS;
    if (lastMove.promotion) return PROMOTE_CLEANUP_MS;
    return MOVE_SLIDE_MS + 50;
}

export default function ChessBoard({ settings, onExit }: ChessBoardProps) {
    const { game, lastMove, pieces, moveHistory, applyMove, resetGame: resetChessGame } = useChessGame();
    const [isReviewing, setIsReviewing] = useState(false);
    const isGameOver = game.isGameOver();
    const { whiteTime, blackTime, flagFall, resetClock } = useChessClock(game, settings.timeControlMinutes, isGameOver);
    const { muted, toggleMuted, playMove, playCapture, playCheck } = useSoundSettings();

    const isMatchOver = isGameOver || flagFall !== null;
    const [showGameOverModal, setShowGameOverModal] = useState(false);

    useEffect(() => {
        if (!isMatchOver) {
            setShowGameOverModal(false);
            return;
        }

        // Hết giờ dừng ván ngay lập tức, không có nước đi/animation nào đang chạy
        // nên hiện modal luôn; còn chiếu hết/hòa cờ thì chờ animation nước cuối.
        if (flagFall !== null) {
            setShowGameOverModal(true);
            return;
        }

        const timer = setTimeout(() => setShowGameOverModal(true), getGameOverModalDelayMs(lastMove));
        return () => clearTimeout(timer);
    }, [isMatchOver, flagFall, lastMove]);

    useAIOpponent(game, applyMove, settings.mode, settings.difficulty, isMatchOver);

    // Engine chỉ cần cho chế độ đấu với máy — ván PvP không tải một byte nào. Bắt đầu
    // tải ngay khi vào ván để nó sẵn sàng trước khi máy phải đi nước đầu tiên.
    const engineStatus = useEngineStatus(settings.mode === 'pve');

    // Gợi ý chỉ dành cho chế độ đấu với máy: ở PvP, hai người dùng chung một bàn cờ
    // nên hiện nước tốt nhất sẽ lộ nước đi cho cả hai bên.
    const isHintEnabled = settings.mode === 'pve' && settings.showHints;
    const { hint, isHintLoading } = useMoveHint(game, isHintEnabled, isMatchOver);

    const {
        isPremoveMode,
        premoveFrom,
        premove,
        pendingPromotion: premovePendingPromotion,
        handlePremoveSquareClick,
        choosePromotion: choosePremovePromotion,
        cancelPremove,
        resetPremove,
    } = usePremove(game, applyMove, settings.mode, isMatchOver);
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

    const resetGame = () => {
        resetChessGame();
        resetClock();
        resetPremove();
        clearSelection();
        setIsReviewing(false);
        setShowGameOverModal(false);
    };

    const handleSquareClick = (row: number, col: number) => {
        if (isMatchOver || pendingPromotion) return;

        const squareNotation = coordsToSquare(row, col);

        if (isPremoveMode) {
            handlePremoveSquareClick(squareNotation);
            return;
        }

        handleNormalClick(squareNotation);
    };

    const getGameStatus = (): string => {
        const isPve = settings.mode === 'pve';

        if (isMatchOver) return 'Trận đấu đã kết thúc';
        // Engine hỏng thì máy không đi được nữa — phải báo ngay ở dòng trạng thái, vì
        // người chơi có thể đã tắt gợi ý và sẽ không thấy thông báo ở bảng gợi ý.
        if (isPve && engineStatus === 'error') return 'Không tải được engine cờ';
        if (game.inCheck()) return `Đang bị Chiếu! Lượt của: ${colorLabel(game.turn())}`;
        if (isPve && game.turn() === AI_COLOR) {
            return engineStatus === 'ready' ? 'Máy đang suy nghĩ...' : 'Đang tải engine cờ...';
        }
        return `Lượt đi: ${colorLabel(game.turn())}`;
    };

    const getGameOverInfo = (): GameOverInfo | null => {
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

    const getInfoLabel = (): string | null => {
        if (premove) return `Đã đặt trước: ${premove.from} → ${premove.to}`;
        if (premoveFrom) return `Đã chọn quân ở ${premoveFrom} — chọn ô đến để đặt trước`;
        if (lastMove) return `Nước đi vừa xong: ${colorLabel(lastMove.color)} ${lastMove.san}`;
        return null;
    };

    const modeLabel = settings.mode === 'pvp'
        ? '2 người'
        : `Đấu với máy — ${difficultyLabel(settings.difficulty)}`;

    if (isReviewing) {
        return (
            <Suspense fallback={<div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">Đang mở phần xem lại...</div>}>
                <GameReview moveHistory={moveHistory} onClose={() => setIsReviewing(false)} />
            </Suspense>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white select-none p-4">
            <TopBar modeLabel={modeLabel} onExit={onExit} muted={muted} onToggleMuted={toggleMuted} />

            <GameStatus
                statusText={getGameStatus()}
                infoLabel={getInfoLabel()}
                showCancelPremove={premove !== null}
                onCancelPremove={cancelPremove}
            />

            <ClockPanel whiteTime={whiteTime} blackTime={blackTime} turn={game.turn()} isMatchOver={isMatchOver} />

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
            />

            {isHintEnabled && <HintPanel hint={hint} isLoading={isHintLoading} engineStatus={engineStatus} />}

            <Button variant="primary" size="md" className="mt-6" onClick={resetGame}>
                Ván mới
            </Button>

            <GameOverModal
                info={showGameOverModal ? getGameOverInfo() : null}
                onNewGame={resetGame}
                onExit={onExit}
                onReviewGame={() => setIsReviewing(true)}
            />

            {pendingPromotion && (
                <PromotionModal color={pendingPromotion.color} onChoose={choosePromotion} />
            )}
        </div>
    );
}
