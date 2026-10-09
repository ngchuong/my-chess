import Button from '../ui/Button';

interface GameControlsProps {
    readonly undoLabel: string;
    readonly canUndo: boolean;
    readonly onUndo: () => void;
    readonly canOfferDraw: boolean;
    readonly onOfferDraw: () => void;
    readonly canResign: boolean;
    readonly onResign: () => void;
    readonly onDownloadPgn: () => void;
    readonly onNewGame: () => void;
}

// Các nút thao tác trong ván. Luôn hiện đủ (chỉ vô hiệu hóa khi không dùng được) để
// hàng nút không đổi kích thước và đẩy bàn cờ lên xuống giữa các lượt.
export default function GameControls({
    undoLabel,
    canUndo,
    onUndo,
    canOfferDraw,
    onOfferDraw,
    canResign,
    onResign,
    onDownloadPgn,
    onNewGame,
}: GameControlsProps) {
    return (
        <div className="flex flex-wrap justify-center gap-2 mt-3 w-full max-w-120">
            <Button size="sm" onClick={onUndo} disabled={!canUndo}>
                ↶ {undoLabel}
            </Button>
            <Button size="sm" onClick={onOfferDraw} disabled={!canOfferDraw}>
                ½ Cầu hòa
            </Button>
            <Button size="sm" onClick={onResign} disabled={!canResign}>
                ⚑ Đầu hàng
            </Button>
            <Button size="sm" onClick={onDownloadPgn}>
                ⤓ Tải PGN
            </Button>
            <Button variant="primary" size="sm" onClick={onNewGame}>
                Ván mới
            </Button>
        </div>
    );
}
