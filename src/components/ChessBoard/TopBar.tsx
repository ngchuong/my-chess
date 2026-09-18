import Button from '../ui/Button';

interface TopBarProps {
    readonly modeLabel: string;
    readonly onExit: () => void;
    readonly muted: boolean;
    readonly onToggleMuted: () => void;
}

export default function TopBar({ modeLabel, onExit, muted, onToggleMuted }: TopBarProps) {
    return (
        <div className="flex items-center gap-3 mb-2 text-sm text-slate-400">
            <span>{modeLabel}</span>
            <Button
                variant="secondary"
                size="sm"
                onClick={onToggleMuted}
                aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
                {muted ? '🔇' : '🔊'}
            </Button>
            <Button variant="secondary" size="sm" onClick={onExit}>
                Về menu
            </Button>
        </div>
    );
}
