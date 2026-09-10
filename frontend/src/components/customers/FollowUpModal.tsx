import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiClientError } from '../../types/api.ts';
import type { CreateFollowUpPayload } from '../../types/customer.ts';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Modal } from '../ui/Modal.tsx';
import { Textarea } from '../ui/Textarea.tsx';

interface FollowUpModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateFollowUpPayload) => Promise<void>;
  customerLabel?: string;
}

export function FollowUpModal({ open, onClose, onSubmit, customerLabel }: FollowUpModalProps) {
  const [note, setNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (!note.trim()) {
      setError('Enter a follow-up note.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateFollowUpPayload = { note: note.trim() };
      if (followUpDate) payload.followUpDate = followUpDate;
      await onSubmit(payload);
    } catch (reason: unknown) {
      setError(
        reason instanceof ApiClientError
          ? reason.message
          : 'Unable to save this follow-up. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Add follow-up"
      description={
        customerLabel
          ? `Append a note for ${customerLabel}. The author is taken from your signed-in account.`
          : 'This note is appended to the customer history. The author is taken from your signed-in account.'
      }
      onClose={submitting ? () => undefined : onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Textarea
          label="Note"
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          error={error && !note.trim() ? error : undefined}
          disabled={submitting}
          rows={4}
          required
        />
        <Input
          label="Next follow-up date"
          name="followUpDate"
          type="date"
          value={followUpDate}
          onChange={(event) => setFollowUpDate(event.target.value)}
          disabled={submitting}
          hint="Optional. Updates the customer’s next follow-up when set."
        />
        {error && note.trim() ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={submitting}>
            Save follow-up
          </Button>
        </div>
      </form>
    </Modal>
  );
}
