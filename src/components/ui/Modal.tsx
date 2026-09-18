import type { ReactNode } from 'react';

interface ModalProps {
    children: ReactNode;
    maxWidthClassName?: string;
}

// Lớp phủ modal dùng chung — hiện tại cho thông báo kết thúc trận, sau này có thể
// tái dùng cho các bảng "xem lại ván đấu" / "phân tích ván đấu".
export default function Modal({ children, maxWidthClassName = 'max-w-sm' }: ModalProps) {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className={`bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-8 w-full text-center space-y-4 ${maxWidthClassName}`}>
                {children}
            </div>
        </div>
    );
}
