import { useMemo, useState } from 'react';
import { formatDuration } from '../utils/duration';
import { formatDateTime } from '../utils/formatDateTime';
import { AppliedFilters } from './AppliedFilters';
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
  issueType?: string;
  showReporterFilter?: boolean;
}

export function StoryTimeStats({ issues, issueType = 'story', showReporterFilter = false }: StoryTimeStatsProps) {
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'leadTime',
    direction: 'desc',
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [fixVersionFilter, setFixVersionFilter] = useState<string[]>([]);
  const [reporterFilter, setReporterFilter] = useState<string[]>([]);
  // null = ще не обрано вручну, використовуємо тип за замовчуванням (проп issueType)
  const [typeFilter, setTypeFilter] = useState<string[] | null>(null);
  const [keySearch, setKeySearch] = useState('');

  const clearFilters = () => {
    setStatusFilter([]);
    setAssigneeFilter([]);
    setFixVersionFilter([]);
    setReporterFilter([]);
    setTypeFilter(null);
    setKeySearch('');
  };

  const filterOptions = useMemo(() => {
    const typeCounts = new Map<string, number>();

    for (const issue of issues) {
      typeCounts.set(issue.issueType, (typeCounts.get(issue.issueType) ?? 0) + 1);
    }

    const types = Array.from(typeCounts.keys()).sort();
    const defaultTypes = types.filter(
      (type) => type.toLowerCase() === issueType.toLowerCase(),
    );
    const effectiveTypes = typeFilter ?? defaultTypes;
    const typeSet = new Set(effectiveTypes.map((type) => type.toLowerCase()));
    const matchingIssues = issues.filter((issue) =>
      typeSet.has(issue.issueType.toLowerCase()),
    );
    const statuses = Array.from(new Set(matchingIssues.map((issue) => issue.status))).sort();
    const assignees = Array.from(
      new Set(matchingIssues.map((issue) => issue.assignee ?? 'Unassigned')),
    ).sort();
    const fixVersions = Array.from(
      new Set(matchingIssues.flatMap((issue) => issue.fixVersions)),
    ).sort();
    const reporters = Array.from(
      new Set(matchingIssues.map((issue) => issue.reporter ?? 'Unknown')),
    ).sort();

    return { types, defaultTypes, effectiveTypes, statuses, assignees, fixVersions, reporters };
  }, [issues, issueType, typeFilter]);

  const stories = useMemo(() => {
    const typeSet = new Set(
      filterOptions.effectiveTypes.map((type) => type.toLowerCase()),
    );
    const normalizedSearch = keySearch.trim().toLowerCase();

    const filtered = issues.filter((issue) => {
      if (!typeSet.has(issue.issueType.toLowerCase())) {
        return false;
      }

      if (statusFilter.length > 0 && !statusFilter.includes(issue.status)) {
        return false;
      }

      const normalizedAssignee = issue.assignee ?? 'Unassigned';
      if (assigneeFilter.length > 0 && !assigneeFilter.includes(normalizedAssignee)) {
        return false;
      }

      if (
        fixVersionFilter.length > 0 &&
        !issue.fixVersions.some((version) => fixVersionFilter.includes(version))
      ) {
        return false;
      }

      if (reporterFilter.length > 0 && !reporterFilter.includes(issue.reporter ?? 'Unknown')) {
        return false;
      }

      if (normalizedSearch !== '' && !issue.key.toLowerCase().includes(normalizedSearch)) {
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
  }, [issues, filterOptions.effectiveTypes, sort, statusFilter, assigneeFilter, fixVersionFilter, reporterFilter, keySearch]);

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

  const hasActiveFilters =
    statusFilter.length > 0 ||
    assigneeFilter.length > 0 ||
    fixVersionFilter.length > 0 ||
    reporterFilter.length > 0 ||
    typeFilter !== null ||
    keySearch.trim() !== '';

  if (stories.length === 0 && !hasActiveFilters) {
    return <div className="story-stats-empty">У проєкті немає задач типу {issueType}.</div>;
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

        <MultiSelect
          label="Release version"
          options={filterOptions.fixVersions}
          selected={fixVersionFilter}
          onChange={setFixVersionFilter}
        />

        {showReporterFilter && (
          <MultiSelect
            label="Reporter"
            options={filterOptions.reporters}
            selected={reporterFilter}
            onChange={setReporterFilter}
          />
        )}

        <MultiSelect
          label="Task type"
          options={filterOptions.types}
          selected={filterOptions.effectiveTypes}
          onChange={setTypeFilter}
        />

        <button
          type="button"
          className="story-stats-filter-clear"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
        >
          Clear all filters
        </button>

        <input
          type="search"
          className="story-stats-search"
          placeholder="Пошук за номером (COP-123)"
          value={keySearch}
          onChange={(event) => setKeySearch(event.target.value)}
        />
      </div>

      <AppliedFilters
        groups={[
          {
            label: 'Статуси',
            values: statusFilter,
            onRemove: (value) => setStatusFilter((current) => current.filter((item) => item !== value)),
          },
          {
            label: 'Асайні',
            values: assigneeFilter,
            onRemove: (value) => setAssigneeFilter((current) => current.filter((item) => item !== value)),
          },
          {
            label: 'Release version',
            values: fixVersionFilter,
            onRemove: (value) => setFixVersionFilter((current) => current.filter((item) => item !== value)),
          },
          {
            label: 'Reporter',
            values: reporterFilter,
            onRemove: (value) => setReporterFilter((current) => current.filter((item) => item !== value)),
          },
          {
            label: 'Task type',
            values: typeFilter ?? [],
            onRemove: (value) =>
              setTypeFilter((current) =>
                (current ?? filterOptions.defaultTypes).filter((item) => item !== value),
              ),
          },
        ]}
      />

      {stories.length === 0 && (
        <div className="story-stats-empty">Задачі за вибраними фільтрами не знайдено.</div>
      )}

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

            <StatusDurationLegend durations={story.statusDurations} />

            {isExpanded && (
              <div className="story-stats-linked">
                <StatusDurationStrip durations={story.statusDurations} />
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
  return (
    <>
      <StatusDurationStrip durations={durations} />
      <StatusDurationLegend durations={durations} />
    </>
  );
}

function StatusDurationStrip({ durations }: { durations: StatusDuration[] }) {
  if (durations.length === 0) {
    return null;
  }

  return (
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
  );
}

function StatusDurationLegend({ durations }: { durations: StatusDuration[] }) {
  if (durations.length === 0) {
    return null;
  }

  return (
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
