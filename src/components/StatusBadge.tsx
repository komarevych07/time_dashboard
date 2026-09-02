import React from 'react';

interface StatusBadgeProps {
  status: string;
  variant: 'priority' | 'status';
}

const PRIORITY_COLORS: Record<string, string> = {
  Highest: '#dc2626',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
  Lowest: '#3b82f6',
};

const DEFAULT_PRIORITY_COLOR = '#6b7280';

function getStatusColor(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized.includes('done')) {
    return '#22c55e';
  }

  if (normalized.includes('progress')) {
    return '#3b82f6';
  }

  if (normalized.includes('review')) {
    return '#a855f7';
  }

  if (normalized.includes('qa')) {
    return '#06b6d4';
  }

  if (normalized.includes('blocked')) {
    return '#dc2626';
  }

  if (normalized.includes('to do') || normalized.includes('todo')) {
    return '#6b7280';
  }

  return '#6366f1';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant }) => {
  const color =
    variant === 'priority'
      ? PRIORITY_COLORS[status] ?? DEFAULT_PRIORITY_COLOR
      : getStatusColor(status);

  return (
    <span
      className="status-badge"
      style={{
        backgroundColor: `${color}1a`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      {status}
    </span>
  );
};
