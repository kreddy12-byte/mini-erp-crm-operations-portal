import { Button } from '../ui/Button.tsx';
import { Modal } from '../ui/Modal.tsx';

interface ChallanCancelModalProps {
  open: boolean;
  loading?: boolean;
  challanNumber?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ChallanCancelModal({
  open,
  loading = false,
  challanNumber,
  onClose,
  onConfirm,
}: ChallanCancelModalProps) {
  return (
    <Modal
      open={open}
      title="Cancel draft"
      description="The draft will become Cancelled. It cannot be edited or confirmed afterward."
      onClose={loading ? () => undefined : onClose}
    >
      <p className="text-secondary">
        {challanNumber ? `${challanNumber} has never deducted stock.` : 'This draft has never deducted stock.'}{' '}
        Cancelling it does not change inventory.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" disabled={loading} onClick={onClose}>
          Keep draft
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          Cancel challan
        </Button>
      </div>
    </Modal>
  );
}
