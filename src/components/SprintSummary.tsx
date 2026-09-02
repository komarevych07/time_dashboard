import React from 'react';
import type { DashboardData } from '../types/jira';

interface SprintSummaryProps {
  data: DashboardData | null;
}

export const SprintSummary: React.FC<SprintSummaryProps> = ({ data }) => {
  if (data === null) {
    return null;
  }

  return (
    <div className="sprint-summary">
      <span className="sprint-summary-item">
        <span className="sprint-summary-label">Board:</span>
        <span className="sprint-summary-value">{data.board.name}</span>
      </span>
      <span className="sprint-summary-item">
        <span className="sprint-summary-label">Sprint:</span>
        <span className="sprint-summary-value">{data.sprint.name}</span>
      </span>
      <span className="sprint-summary-item">
        <span className="sprint-summary-label">Tasks:</span>
        <span className="sprint-summary-value">{data.issues.length}</span>
      </span>
    </div>
  );
};
