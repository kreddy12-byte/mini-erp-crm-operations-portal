export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

export type FollowUpUrgency = 'overdue' | 'today' | 'upcoming' | 'none';

export function followUpUrgency(value: string | null | undefined, now = new Date()): FollowUpUrgency {
  if (!value) {
    return 'none';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'none';
  }
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = start + 24 * 60 * 60 * 1000;
  const time = date.getTime();
  if (time < start) {
    return 'overdue';
  }
  if (time < end) {
    return 'today';
  }
  return 'upcoming';
}
