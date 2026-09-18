import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    readonly variant?: ButtonVariant;
    readonly size?: ButtonSize;
    // Khi truyền `active`, nút hoạt động như một toggle (dùng trong các nhóm lựa
    // chọn của GameMenu) — bỏ qua `variant` và tô màu theo trạng thái chọn/không chọn.
    readonly active?: boolean;
    readonly fullWidth?: boolean;
    readonly children: ReactNode;
}

function getColorClasses(variant: ButtonVariant, active: boolean | undefined): string {
    if (active === undefined) return VARIANT_CLASSES[variant];
    return active ? ACTIVE_CLASSES : INACTIVE_CLASSES;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
    xs: 'text-xs px-2 py-0.5 rounded',
    sm: 'text-sm px-3 py-1 rounded-md',
    md: 'text-sm px-3 py-2.5 rounded-lg shadow-md',
    lg: 'text-lg px-6 py-3 rounded-lg shadow-md',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
};

const ACTIVE_CLASSES = VARIANT_CLASSES.primary;
const INACTIVE_CLASSES = 'bg-slate-700 hover:bg-slate-600 text-slate-300';

export default function Button({
    variant = 'secondary',
    size = 'md',
    active,
    fullWidth,
    className = '',
    children,
    type = 'button',
    ...rest
}: ButtonProps) {
    const colorClasses = getColorClasses(variant, active);

    return (
        <button
            type={type}
            className={`font-semibold transition-all active:scale-95 cursor-pointer touch-manipulation ${SIZE_CLASSES[size]} ${colorClasses} ${fullWidth ? 'w-full' : ''} ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}
