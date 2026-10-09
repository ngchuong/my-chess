import Button from '../ui/Button';

interface GameStatusProps {
    readonly statusText: string;
    readonly infoLabel: string | null;
    readonly showCancelPremove: boolean;
    readonly onCancelPremove: () => void;
}

export default function GameStatus({ statusText, infoLabel, showCancelPremove, onCancelPremove }: GameStatusProps) {
    return (
        <>
            {/* Chiều cao cố định để bàn cờ bên dưới không nhảy khi trạng thái đổi độ dài:
                màn hẹp chừa sẵn 2 dòng (câu dài nhất như "Đang bị Chiếu! Lượt của: Trắng"
                có thể xuống dòng), từ sm trở lên câu nào cũng vừa 1 dòng. */}
            <h2 className="h-16 sm:h-8 mb-1 flex items-center justify-center text-center text-xl sm:text-2xl font-bold tracking-wide text-slate-100">
                {statusText}
            </h2>
            <p className="text-sm text-slate-400 mb-3 h-5 flex items-center gap-2">
                {infoLabel}
                {showCancelPremove && (
                    <Button variant="secondary" size="xs" onClick={onCancelPremove}>
                        Hủy
                    </Button>
                )}
            </p>
        </>
    );
}
