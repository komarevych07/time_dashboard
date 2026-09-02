export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 1) {
    return '0 хв';
  }

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = Math.floor(totalMinutes % 60);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} ${declineDays(days)}`);
  }

  if (hours > 0) {
    parts.push(`${hours} ${declineHours(hours)}`);
  }

  if (minutes > 0 && days === 0) {
    parts.push(`${minutes} ${declineMinutes(minutes)}`);
  }

  return parts.join(' ') || '0 хв';
}

function declineDays(value: number): string {
  const last = value % 10;
  const lastTwo = value % 100;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'днів';
  }

  if (last === 1) {
    return 'день';
  }

  if (last >= 2 && last <= 4) {
    return 'дні';
  }

  return 'днів';
}

function declineHours(value: number): string {
  const last = value % 10;
  const lastTwo = value % 100;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'год';
  }

  if (last === 1) {
    return 'год';
  }

  if (last >= 2 && last <= 4) {
    return 'год';
  }

  return 'год';
}

function declineMinutes(value: number): string {
  const last = value % 10;
  const lastTwo = value % 100;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'хв';
  }

  if (last === 1) {
    return 'хв';
  }

  if (last >= 2 && last <= 4) {
    return 'хв';
  }

  return 'хв';
}
