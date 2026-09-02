import type { DashboardIssue, SortDirection, SortField } from '../types/jira';

const PRIORITY_ORDER: Record<string, number> = {
  Highest: 5,
  High: 4,
  Medium: 3,
  Low: 2,
  Lowest: 1,
};

const DEFAULT_PRIORITY_WEIGHT = 0;

export function sortIssues(
  issues: DashboardIssue[],
  field: SortField,
  direction: SortDirection,
): DashboardIssue[] {
  const sorted = [...issues].sort((a, b) => compareIssues(a, b, field));
  return direction === 'desc' ? sorted.reverse() : sorted;
}

function compareIssues(a: DashboardIssue, b: DashboardIssue, field: SortField): number {
  switch (field) {
    case 'key':
      return compareStrings(a.key, b.key);
    case 'summary':
      return compareStrings(a.summary, b.summary);
    case 'priority':
      return comparePriority(a.priority, b.priority);
    case 'status':
      return compareStrings(a.status, b.status);
    case 'statusSince':
      return compareDates(a.statusSince, b.statusSince);
    case 'assignee':
      return compareStrings(a.assignee ?? 'Unassigned', b.assignee ?? 'Unassigned');
    default:
      return 0;
  }
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, 'uk');
}

function comparePriority(a: string, b: string): number {
  const weightA = PRIORITY_ORDER[a] ?? DEFAULT_PRIORITY_WEIGHT;
  const weightB = PRIORITY_ORDER[b] ?? DEFAULT_PRIORITY_WEIGHT;

  if (weightA !== weightB) {
    return weightA - weightB;
  }

  return compareStrings(a, b);
}

function compareDates(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}
