import Button from '../ui/Button';

interface TopBarProps {
    modeLabel: string;
    onExit: () => void;
}

export default function TopBar({ modeLabel, onExit }: TopBarProps) {
    return (
        <div className="flex items-center gap-3 mb-2 text-sm text-slate-400">
            <span>{modeLabel}</span>
            <Button variant="secondary" size="sm" onClick={onExit}>
                Về menu
            </Button>
        </div>
    );
}
