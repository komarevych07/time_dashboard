import React from 'react';
import type { DashboardData } from '../types/jira';

interface HeaderProps {
  data: DashboardData | null;
  refreshing: boolean;
  onRefresh: () => void;
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: () => void;
}

function formatLastUpdate(loadedAt: string | undefined): string {
  if (loadedAt === undefined) {
    return '—';
  }

  const date = new Date(loadedAt);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export const Header: React.FC<HeaderProps> = ({
  data,
  refreshing,
  onRefresh,
  autoRefreshEnabled,
  onToggleAutoRefresh,
}) => {
  return (
    <header className="dashboard-header">
      <div className="header-main">
        <h1 className="header-title">JIRA SPRINT DASHBOARD</h1>

        <div className="header-meta">
          <span className="header-meta-item">
            <span className="header-meta-label">Board:</span>
            <span className="header-meta-value">{data?.board.name ?? '—'}</span>
          </span>
          <span className="header-meta-item">
            <span className="header-meta-label">Sprint:</span>
            <span className="header-meta-value">{data?.sprint.name ?? '—'}</span>
          </span>
          <span className="header-meta-item">
            <span className="header-meta-label">Tasks:</span>
            <span className="header-meta-value">{data?.issues.length ?? 0}</span>
          </span>
        </div>
      </div>

      <div className="header-controls">
        <div className="last-update">
          <span className="last-update-label">Last update:</span>
          <span className="last-update-value">{formatLastUpdate(data?.loadedAt)}</span>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={onRefresh}
          disabled={refreshing || data === null}
        >
          {refreshing ? 'Оновлення...' : '↻ Оновити'}
        </button>

        <label className="auto-refresh-toggle">
          <input
            type="checkbox"
            checked={autoRefreshEnabled}
            onChange={onToggleAutoRefresh}
          />
          <span>Автооновлення кожні 5 хв</span>
        </label>
      </div>
    </header>
  );
};
