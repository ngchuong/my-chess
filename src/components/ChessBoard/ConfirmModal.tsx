import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface ConfirmModalProps {
    readonly title: string;
    readonly detail: string;
    readonly confirmLabel: string;
    readonly cancelLabel?: string;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
}

// Hỏi lại trước các thao tác kết thúc ván (đầu hàng, đồng ý hòa) — bấm nhầm thì không
// có đường lui.
export default function ConfirmModal({ title, detail, confirmLabel, cancelLabel = 'Hủy', onConfirm, onCancel }: ConfirmModalProps) {
    return (
        <Modal>
            <h3 className="text-2xl font-bold text-slate-100">{title}</h3>
            <p className="text-slate-300">{detail}</p>
            <div className="flex gap-3 justify-center pt-2">
                <Button variant="primary" onClick={onConfirm}>
                    {confirmLabel}
                </Button>
                <Button variant="secondary" onClick={onCancel}>
                    {cancelLabel}
                </Button>
            </div>
        </Modal>
    );
}
