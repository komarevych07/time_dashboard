import { useMemo } from 'react';
import { formatDuration } from '../utils/duration';
import type { DashboardIssue } from '../types/jira';

const STATUS_COLORS: Record<string, string> = {
  'To Do': '#3b82f6',
  'In Progress': '#f59e0b',
  'Code Review': '#8b5cf6',
  'Testing': '#ec4899',
  Done: '#10b981',
};

const FALLBACK_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];

function statusColor(status: string, index: number): string {
  return STATUS_COLORS[status] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

interface StoryTimeStatsProps {
  issues: DashboardIssue[];
}

export function StoryTimeStats({ issues }: StoryTimeStatsProps) {
  const stories = useMemo(() => {
    return issues
      .filter((issue) => issue.issueType.toLowerCase() === 'story')
      .sort((a, b) => b.leadTimeSeconds - a.leadTimeSeconds);
  }, [issues]);

  if (stories.length === 0) {
    return <div className="story-stats-empty">У цьому спринті немає задач типу Story.</div>;
  }

  return (
    <div className="story-stats">
      <div className="story-stats-header">
        <span className="story-stats-header-cell">Номер</span>
        <span className="story-stats-header-cell story-stats-header-title">Тайтл</span>
        <span className="story-stats-header-cell">Статус</span>
        <span className="story-stats-header-cell">Час (створення → зараз/Done)</span>
        <span className="story-stats-header-cell">Асайні</span>
      </div>

      {stories.map((story) => (
        <div key={story.id} className="story-stats-row">
          <div className="story-stats-main">
            <span className="story-stats-key">{story.key}</span>
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="story-stats-summary"
              title={story.summary}
            >
              {story.summary}
            </a>
            <span className="story-stats-status">{story.status}</span>
            <span className="story-stats-duration">
              {formatDuration(Math.round(story.leadTimeSeconds / 60))}
            </span>
            <span className="story-stats-assignee">{story.assignee ?? 'Unassigned'}</span>
          </div>

          <div
            className="story-stats-bar"
            role="img"
            aria-label={`Розподіл часу за статусами для ${story.key}`}
          >
            {story.statusDurations.map((duration, index) => (
              <div
                key={`${duration.status}-${index}`}
                className="story-stats-segment"
                style={{
                  width: `${Math.max(duration.percentage, 1)}%`,
                  backgroundColor: statusColor(duration.status, index),
                }}
                title={`${duration.status}: ${formatDuration(Math.round(duration.durationSeconds / 60))} (${duration.percentage}%)`}
              />
            ))}
          </div>

          <div className="story-stats-legend">
            {story.statusDurations.map((duration, index) => (
              <span key={`${duration.status}-${index}`} className="story-stats-legend-item">
                <span
                  className="story-stats-legend-dot"
                  style={{ backgroundColor: statusColor(duration.status, index) }}
                />
                <span className="story-stats-legend-label">
                  {duration.status}
                </span>
                <span className="story-stats-legend-time">
                  {formatDuration(Math.round(duration.durationSeconds / 60))}
                </span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
