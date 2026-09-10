import { Button } from '../ui/Button.tsx';
import { Modal } from '../ui/Modal.tsx';

interface ChallanConfirmModalProps {
  open: boolean;
  loading?: boolean;
  challanNumber?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ChallanConfirmModal({
  open,
  loading = false,
  challanNumber,
  onClose,
  onConfirm,
}: ChallanConfirmModalProps) {
  return (
    <Modal
      open={open}
      title="Confirm challan"
      description="Stock will be deducted now. This cannot stay a normal editable draft afterward."
      onClose={loading ? () => undefined : onClose}
    >
      <p className="text-secondary">
        {challanNumber ? `${challanNumber} will become Confirmed.` : 'This challan will become Confirmed.'} Each line
        is checked against current stock on the server. If any product is short, nothing is deducted and the challan
        stays Draft.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" disabled={loading} onClick={onClose}>
          Keep draft
        </Button>
        <Button loading={loading} onClick={onConfirm}>
          Confirm and deduct stock
        </Button>
      </div>
    </Modal>
  );
}
