import React from 'react';
import type { DashboardIssue, SortField, SortState } from '../types/jira';
import { StatusBadge } from './StatusBadge';
import { useLiveDuration } from '../hooks/useLiveDuration';
import { formatDuration } from '../utils/duration';

interface IssueTableProps {
  issues: DashboardIssue[];
  sort: SortState;
  onSort: (field: SortField) => void;
}

const HEADERS: { field: SortField; label: string }[] = [
  { field: 'key', label: 'Issue' },
  { field: 'summary', label: 'Title' },
  { field: 'priority', label: 'Priority' },
  { field: 'status', label: 'Status' },
  { field: 'statusSince', label: 'Time in status' },
  { field: 'assignee', label: 'Assignee' },
];

function getSortIndicator(field: SortField, sort: SortState): string {
  if (sort.field !== field) {
    return '';
  }

  return sort.direction === 'asc' ? ' ↑' : ' ↓';
}

const IssueRow: React.FC<{ issue: DashboardIssue }> = ({ issue }) => {
  const durationMinutes = useLiveDuration(issue.statusSince);

  return (
    <tr className="issue-row">
      <td className="issue-cell issue-cell-key">
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="issue-link"
        >
          {issue.key}
        </a>
      </td>
      <td className="issue-cell">{issue.summary}</td>
      <td className="issue-cell">
        <StatusBadge status={issue.priority} variant="priority" />
      </td>
      <td className="issue-cell">
        <StatusBadge status={issue.status} variant="status" />
      </td>
      <td className="issue-cell">{formatDuration(durationMinutes)}</td>
      <td className="issue-cell">{issue.assignee ?? 'Unassigned'}</td>
    </tr>
  );
};

export const IssueTable: React.FC<IssueTableProps> = ({ issues, sort, onSort }) => {
  if (issues.length === 0) {
    return <div className="empty-state">У цьому розділі задач немає.</div>;
  }

  return (
    <div className="table-wrapper">
      <table className="issue-table">
        <thead className="issue-table-head">
          <tr>
            {HEADERS.map((header) => (
              <th
                key={header.field}
                className="issue-table-header"
                onClick={() => onSort(header.field)}
                style={{ cursor: 'pointer' }}
              >
                {header.label}
                {getSortIndicator(header.field, sort)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
