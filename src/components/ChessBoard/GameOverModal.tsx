import Button from '../ui/Button';
import Modal from '../ui/Modal';

export interface GameOverInfo {
    title: string;
    detail: string;
}

interface GameOverModalProps {
    readonly info: GameOverInfo | null;
    readonly onNewGame: () => void;
    readonly onExit: () => void;
    readonly onReviewGame: () => void;
}

export default function GameOverModal({ info, onNewGame, onExit, onReviewGame }: GameOverModalProps) {
    if (!info) return null;

    return (
        <Modal>
            <h3 className="text-3xl font-bold text-slate-100">{info.title}</h3>
            <p className="text-lg text-slate-300">{info.detail}</p>
            <div className="flex gap-3 justify-center pt-2 flex-wrap">
                <Button variant="primary" onClick={onNewGame}>
                    Ván mới
                </Button>
                <Button variant="secondary" onClick={onReviewGame}>
                    Xem lại ván đấu
                </Button>
                <Button variant="secondary" onClick={onExit}>
                    Về menu
                </Button>
            </div>
        </Modal>
    );
}
