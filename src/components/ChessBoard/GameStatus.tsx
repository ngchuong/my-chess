import Button from '../ui/Button';

interface GameStatusProps {
    statusText: string;
    infoLabel: string | null;
    showCancelPremove: boolean;
    onCancelPremove: () => void;
}

export default function GameStatus({ statusText, infoLabel, showCancelPremove, onCancelPremove }: GameStatusProps) {
    return (
        <>
            <h2 className="text-2xl font-bold mb-1 tracking-wide text-slate-100">{statusText}</h2>
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
