import { useCallback, useEffect, useMemo, useState } from 'react';
import { BugAgingReport } from './components/BugAgingReport';
import { Header } from './components/Header';
import { IssueTable } from './components/IssueTable';
import { LoginForm } from './components/LoginForm';
import { MultiSelect } from './components/MultiSelect';
import { AppliedFilters } from './components/AppliedFilters';
import { StoryTimeStats } from './components/StoryTimeStats';
import { useDashboard } from './hooks/useDashboard';
import { exchangeCode } from './services/api';
import { sortIssues } from './utils/sorting';
import type { Category, OAuthTokens, SortField, SortState } from './types/jira';

const CATEGORY_LABELS: Record<Category, string> = {
  FE: 'FE',
  BE: 'BE',
  QA: 'QA',
  AQA: 'AQA',
  FLIGHT: 'Flight',
  BA: 'BA',
  UX: 'UX',
  EPIC: 'Epic',
  BUGS: 'Bugs',
  OTHER: 'Інші',
  ALL: 'Всі',
};

const TICKET_TYPE_OPTIONS = Object.entries(CATEGORY_LABELS)
  .filter(([category]) => category !== 'ALL')
  .map(([, label]) => label);

const DEFAULT_SORT: SortState = { field: 'statusSince', direction: 'desc' };
const OAUTH_STATE_STORAGE_KEY = 'jira_oauth_state';

interface Filters {
  ticketType: string[];
  priority: string[];
  status: string[];
  assignee: string[];
}

type DashboardView = 'dashboard' | 'storyStats' | 'bugAging';

function App() {
  const [tokens, setTokens] = useState<OAuthTokens | null>(null);
  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [filters, setFilters] = useState<Filters>({
    ticketType: TICKET_TYPE_OPTIONS,
    priority: [],
    status: [],
    assignee: [],
  });

  const {
    data,
    loading,
    refreshing,
    error,
    refresh,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
  } = useDashboard({ tokens, onTokensChange: setTokens });

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (code === null) {
      return;
    }

    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, '', url.toString());

    const expectedState = window.sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY);
    window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);

    if (state === null || expectedState === null || state !== expectedState) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await exchangeCode(code);

        if (!cancelled) {
          setTokens(result);
        }
      } catch {
        // Authorization errors are surfaced by the dashboard hook via loading/error state.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredIssues = useMemo(() => {
    if (data === null) {
      return [];
    }

    return data.issues.filter((issue) => {
      if (!filters.ticketType.includes(CATEGORY_LABELS[issue.category])) {
        return false;
      }

      if (filters.priority.length > 0 && !filters.priority.includes(issue.priority)) {
        return false;
      }

      if (filters.status.length > 0 && !filters.status.includes(issue.status)) {
        return false;
      }

      if (filters.assignee.length > 0) {
        const issueAssignee = issue.assignee ?? 'Unassigned';
        if (!filters.assignee.includes(issueAssignee)) {
          return false;
        }
      }

      return true;
    });
  }, [data, filters]);

  const sortedIssues = useMemo(() => {
    return sortIssues(filteredIssues, sort.field, sort.direction);
  }, [filteredIssues, sort]);

  const filterOptions = useMemo(() => {
    if (data === null) {
      return { priorities: [], statuses: [], assignees: [] };
    }

    const priorities = Array.from(new Set(data.issues.map((issue) => issue.priority))).sort();
    const statuses = Array.from(new Set(data.issues.map((issue) => issue.status))).sort();
    const assignees = Array.from(
      new Set(data.issues.map((issue) => issue.assignee ?? 'Unassigned')),
    ).sort();

    return { priorities, statuses, assignees };
  }, [data]);

  const clearFilters = useCallback(() => {
    setFilters({
      ticketType: TICKET_TYPE_OPTIONS,
      priority: [],
      status: [],
      assignee: [],
    });
  }, [setFilters]);

  const handleSort = useCallback(
    (field: SortField) => {
      setSort((current) => {
        if (current.field === field) {
          return {
            field,
            direction: current.direction === 'asc' ? 'desc' : 'asc',
          };
        }

        return { field, direction: 'asc' };
      });
    },
    [setSort],
  );

  if (tokens === null) {
    return <LoginForm loading={loading} error={error} />;
  }

  return (
    <div className="app">
      <Header
        data={data}
        activeView={activeView}
        onViewChange={setActiveView}
        refreshing={refreshing}
        onRefresh={refresh}
        autoRefreshEnabled={autoRefreshEnabled}
        onToggleAutoRefresh={() => setAutoRefreshEnabled((value) => !value)}
      />

      <main className="main">
        {error !== null && data === null && (
          <div className="error-banner">{error}</div>
        )}

        {error !== null && data !== null && (
          <div className="error-inline">{error}</div>
        )}

        {loading && data === null ? (
          <div className="loading-overlay">Підключення до Jira...</div>
        ) : data === null ? null : activeView === 'storyStats' ? (
          <StoryTimeStats issues={data.issues} />
        ) : activeView === 'bugAging' ? (
          <BugAgingReport issues={data.bugReportIssues} projectIssues={data.issues} />
        ) : (
          <>
            <div className="filter-bar">
              <MultiSelect
                label="Ticket types"
                options={TICKET_TYPE_OPTIONS}
                selected={filters.ticketType}
                allSelectedLabel="Всі"
                onChange={(selected) => setFilters((current) => ({ ...current, ticketType: selected }))}
              />

              <MultiSelect
                label="Priorities"
                options={filterOptions.priorities}
                selected={filters.priority}
                onChange={(selected) => setFilters((current) => ({ ...current, priority: selected }))}
              />

              <MultiSelect
                label="Statuses"
                options={filterOptions.statuses}
                selected={filters.status}
                onChange={(selected) => setFilters((current) => ({ ...current, status: selected }))}
              />

              <MultiSelect
                label="Assignees"
                options={filterOptions.assignees}
                selected={filters.assignee}
                onChange={(selected) => setFilters((current) => ({ ...current, assignee: selected }))}
              />

              <button
                type="button"
                className="filter-clear-button"
                onClick={clearFilters}
                disabled={
                  filters.ticketType.length === TICKET_TYPE_OPTIONS.length &&
                  filters.priority.length === 0 &&
                  filters.status.length === 0 &&
                  filters.assignee.length === 0
                }
              >
                Clear all filters
              </button>
            </div>

            <AppliedFilters
              groups={[
                {
                  label: 'Типи тікетів',
                  values: filters.ticketType.length === TICKET_TYPE_OPTIONS.length ? [] : filters.ticketType,
                  onRemove: (value) =>
                    setFilters((current) => ({
                      ...current,
                      ticketType: current.ticketType.filter((item) => item !== value),
                    })),
                },
                {
                  label: 'Пріоритети',
                  values: filters.priority,
                  onRemove: (value) =>
                    setFilters((current) => ({
                      ...current,
                      priority: current.priority.filter((item) => item !== value),
                    })),
                },
                {
                  label: 'Статуси',
                  values: filters.status,
                  onRemove: (value) =>
                    setFilters((current) => ({
                      ...current,
                      status: current.status.filter((item) => item !== value),
                    })),
                },
                {
                  label: 'Асайні',
                  values: filters.assignee,
                  onRemove: (value) =>
                    setFilters((current) => ({
                      ...current,
                      assignee: current.assignee.filter((item) => item !== value),
                    })),
                },
              ]}
            />

            <IssueTable issues={sortedIssues} sort={sort} onSort={handleSort} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
