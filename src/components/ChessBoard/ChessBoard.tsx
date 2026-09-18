import { useEffect, useState } from 'react';
import { AI_COLOR, colorLabel, coordsToSquare } from '../../lib/boardUtils';
import { CAPTURE_CLEANUP_MS, MOVE_SLIDE_MS, PROMOTE_CLEANUP_MS } from '../../lib/animation';
import { useAIOpponent } from '../../hooks/useAIOpponent';
import { useCheckAlert } from '../../hooks/useCheckAlert';
import { useChessClock } from '../../hooks/useChessClock';
import { useChessGame } from '../../hooks/useChessGame';
import { useMoveSelection } from '../../hooks/useMoveSelection';
import { useMoveSound } from '../../hooks/useMoveSound';
import { usePremove } from '../../hooks/usePremove';
import { useSoundSettings } from '../../hooks/useSoundSettings';
import type { LastMove } from '../../types/chess';
import type { GameSettings } from '../../types/game';
import Button from '../ui/Button';
import GameReview from '../GameReview/GameReview';
import Board from './Board';
import ClockPanel from './ClockPanel';
import GameOverModal, { type GameOverInfo } from './GameOverModal';
import GameStatus from './GameStatus';
import PromotionModal from './PromotionModal';
import TopBar from './TopBar';

interface ChessBoardProps {
    readonly settings: GameSettings;
    readonly onExit: () => void;
}

const DIFFICULTY_LABELS: Record<GameSettings['difficulty'], string> = {
    easy: 'Dễ',
    medium: 'Trung bình',
    hard: 'Khó',
};

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
    const { whiteTime, blackTime, flagFall, resetClock } = useChessClock(game, settings.timeControlMinutes);
    const { muted, toggleMuted, playMove, playCapture, playCheck } = useSoundSettings();

    const isMatchOver = game.isGameOver() || flagFall !== null;
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
    const { isPremoveMode, premoveFrom, premove, handlePremoveSquareClick, cancelPremove, resetPremove } =
        usePremove(game, applyMove, settings.mode, isMatchOver);
    const { selectedSquare, possibleMoves, pendingPromotion, handleSquareClick: handleNormalClick, clearSelection, choosePromotion } =
        useMoveSelection(game, applyMove);

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
        if (isMatchOver) return 'Trận đấu đã kết thúc';
        if (game.inCheck()) return `Đang bị Chiếu! Lượt của: ${colorLabel(game.turn())}`;
        if (settings.mode === 'pve' && game.turn() === AI_COLOR) return 'Máy đang suy nghĩ...';
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
        : `Đấu với máy (${DIFFICULTY_LABELS[settings.difficulty]})`;

    if (isReviewing) {
        return <GameReview moveHistory={moveHistory} onClose={() => setIsReviewing(false)} />;
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
            />

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
