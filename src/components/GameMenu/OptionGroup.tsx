import Button from '../ui/Button';

interface Option<T> {
    label: string;
    value: T;
}

interface OptionGroupProps<T> {
    readonly label: string;
    readonly options: readonly Option<T>[];
    readonly value: T;
    readonly onChange: (value: T) => void;
    readonly columns?: 2 | 3;
}

// Một nhóm nút chọn kiểu toggle (chế độ chơi, độ khó, thời gian, ...) — gom lại
// thành một component để thêm lựa chọn mới trong menu chỉ còn là khai báo dữ liệu.
export default function OptionGroup<T>({ label, options, value, onChange, columns = 2 }: OptionGroupProps<T>) {
    return (
        <div>
            <h2 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">{label}</h2>
            <div className={`grid gap-2 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {options.map((option) => (
                    <Button
                        key={String(option.value)}
                        active={value === option.value}
                        size="md"
                        fullWidth
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
