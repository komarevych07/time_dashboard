import { useMemo, useState } from 'react';
import { formatDuration } from '../utils/duration';
import { formatDateTime } from '../utils/formatDateTime';
import { MultiSelect } from './MultiSelect';
import type { DashboardIssue, LinkedIssue, StatusDuration } from '../types/jira';

const STATUS_COLORS: Record<string, string> = {
  'To Do': '#3b82f6',
  'In Progress': '#f59e0b',
  'Code Review': '#8b5cf6',
  Testing: '#ec4899',
  Done: '#10b981',
};

const FALLBACK_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];

function statusColor(status: string, index: number): string {
  return STATUS_COLORS[status] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

type SortField = 'status' | 'leadTime';
type SortDirection = 'asc' | 'desc';

interface StoryTimeStatsProps {
  issues: DashboardIssue[];
}

export function StoryTimeStats({ issues }: StoryTimeStatsProps) {
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'leadTime',
    direction: 'desc',
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);

  const clearFilters = () => {
    setStatusFilter([]);
    setAssigneeFilter([]);
  };

  const filterOptions = useMemo(() => {
    const stories = issues.filter((issue) => issue.issueType.toLowerCase() === 'story');
    const statuses = Array.from(new Set(stories.map((issue) => issue.status))).sort();
    const assignees = Array.from(
      new Set(stories.map((issue) => issue.assignee ?? 'Unassigned')),
    ).sort();

    return { statuses, assignees };
  }, [issues]);

  const stories = useMemo(() => {
    const filtered = issues.filter((issue) => {
      if (issue.issueType.toLowerCase() !== 'story') {
        return false;
      }

      if (statusFilter.length > 0 && !statusFilter.includes(issue.status)) {
        return false;
      }

      const normalizedAssignee = issue.assignee ?? 'Unassigned';
      if (assigneeFilter.length > 0 && !assigneeFilter.includes(normalizedAssignee)) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort.field === 'status') {
        const comparison = a.status.localeCompare(b.status);
        return sort.direction === 'asc' ? comparison : -comparison;
      }

      return sort.direction === 'asc'
        ? a.leadTimeSeconds - b.leadTimeSeconds
        : b.leadTimeSeconds - a.leadTimeSeconds;
    });
  }, [issues, sort, statusFilter, assigneeFilter]);

  const toggleSort = (field: SortField) => {
    setSort((current) => ({
      field,
      direction: current.field === field && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  if (stories.length === 0) {
    return <div className="story-stats-empty">У цьому спринті немає задач типу Story.</div>;
  }

  return (
    <div className="story-stats">
      <div className="story-stats-filters">
        <MultiSelect
          label="Статуси"
          options={filterOptions.statuses}
          selected={statusFilter}
          onChange={setStatusFilter}
        />

        <MultiSelect
          label="Асайні"
          options={filterOptions.assignees}
          selected={assigneeFilter}
          onChange={setAssigneeFilter}
        />

        <button
          type="button"
          className="story-stats-filter-clear"
          onClick={clearFilters}
          disabled={statusFilter.length === 0 && assigneeFilter.length === 0}
        >
          Clear all filters
        </button>
      </div>

      <div className="story-stats-header">
        <span className="story-stats-header-cell">Номер</span>
        <span className="story-stats-header-cell story-stats-header-title">Тайтл</span>
        <button
          type="button"
          className="story-stats-header-cell story-stats-sort-button"
          onClick={() => toggleSort('status')}
        >
          <SortIndicator field="status" sort={sort} /> Статус
        </button>
        <button
          type="button"
          className="story-stats-header-cell story-stats-sort-button"
          onClick={() => toggleSort('leadTime')}
        >
          <SortIndicator field="leadTime" sort={sort} /> Час (створення → зараз/Done)
        </button>
        <span className="story-stats-header-cell">Last Update</span>
        <span className="story-stats-header-cell">Асайні</span>
      </div>

      {stories.map((story) => {
        const isExpanded = expandedIds.has(story.id);

        return (
          <div key={story.id} className="story-stats-row">
            <div className="story-stats-main">
              <a
                href={story.url}
                target="_blank"
                rel="noopener noreferrer"
                className="story-stats-key"
                title={`Відкрити ${story.key} в Jira`}
              >
                {story.key}
              </a>
              <button
                type="button"
                className="story-stats-title-button"
                onClick={() => toggleExpand(story.id)}
                title={isExpanded ? 'Згорнути' : 'Розгорнути'}
              >
                <span className={`story-stats-expand-icon ${isExpanded ? 'story-stats-expand-icon-open' : ''}`}>
                  ▶
                </span>
                <span className="story-stats-summary">{story.summary}</span>
              </button>
              <span className="story-stats-status">{story.status}</span>
              <span className="story-stats-duration">
                {formatDuration(Math.round(story.leadTimeSeconds / 60))}
              </span>
              <span className="story-stats-last-update">{formatDateTime(story.updated)}</span>
              <span className="story-stats-assignee">{story.assignee ?? 'Unassigned'}</span>
            </div>

            <StatusDurationBar durations={story.statusDurations} />

            {isExpanded && (
              <div className="story-stats-linked">
                {story.linkedIssues.length === 0 ? (
                  <div className="story-stats-linked-empty">Немає прилінкованих задач</div>
                ) : (
                  story.linkedIssues.map((linked) => (
                    <LinkedIssueRow key={linked.id} issue={linked} />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SortIndicator({
  field,
  sort,
}: {
  field: SortField;
  sort: { field: SortField; direction: SortDirection };
}) {
  return (
    <span className="story-stats-sort-icons" aria-hidden="true">
      <span
        className={`story-stats-sort-icon ${
          sort.field === field && sort.direction === 'asc'
            ? 'story-stats-sort-icon-active'
            : 'story-stats-sort-icon-inactive'
        }`}
      >
        ▲
      </span>
      <span
        className={`story-stats-sort-icon ${
          sort.field === field && sort.direction === 'desc'
            ? 'story-stats-sort-icon-active'
            : 'story-stats-sort-icon-inactive'
        }`}
      >
        ▼
      </span>
    </span>
  );
}

function StatusDurationBar({ durations }: { durations: StatusDuration[] }) {
  if (durations.length === 0) {
    return null;
  }

  return (
    <>
      <div className="story-stats-bar" role="img" aria-label="Розподіл часу за статусами">
        {durations.map((duration, index) => (
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
        {durations.map((duration, index) => (
          <span key={`${duration.status}-${index}`} className="story-stats-legend-item">
            <span
              className="story-stats-legend-dot"
              style={{ backgroundColor: statusColor(duration.status, index) }}
            />
            <span className="story-stats-legend-label">{duration.status}</span>
            <span className="story-stats-legend-time">
              {formatDuration(Math.round(duration.durationSeconds / 60))}
            </span>
          </span>
        ))}
      </div>
    </>
  );
}

function LinkedIssueRow({ issue }: { issue: LinkedIssue }) {
  return (
    <div className="story-stats-linked-row">
      <div className="story-stats-linked-main">
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="story-stats-linked-key"
          title={`Відкрити ${issue.key} в Jira`}
        >
          {issue.key}
        </a>
        <span className="story-stats-linked-link-type">{issue.linkType}</span>
        <span className="story-stats-linked-summary" title={issue.summary}>
          {issue.summary}
        </span>
        <span className="story-stats-linked-status">{issue.status}</span>
        <span className="story-stats-linked-duration">
          {issue.statusDurations.length > 0
            ? formatDuration(Math.round(issue.leadTimeSeconds / 60))
            : '—'}
        </span>
        <span className="story-stats-linked-assignee">{issue.assignee ?? 'Unassigned'}</span>
      </div>
      {issue.statusDurations.length > 0 && <StatusDurationBar durations={issue.statusDurations} />}
    </div>
  );
}
