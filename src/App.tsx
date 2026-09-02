import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { IssueTable } from './components/IssueTable';
import { LoginForm } from './components/LoginForm';
import { MultiSelect } from './components/MultiSelect';
import { StoryTimeStats } from './components/StoryTimeStats';
import { Tabs } from './components/Tabs';
import { useDashboard } from './hooks/useDashboard';
import { exchangeCode } from './services/api';
import { sortIssues } from './utils/sorting';
import type { Category, OAuthTokens, SortField, SortState, TabConfig } from './types/jira';

const TABS: TabConfig[] = [
  { key: 'FE', label: 'FE' },
  { key: 'BE', label: 'BE' },
  { key: 'QA', label: 'QA' },
  { key: 'AQA', label: 'AQA' },
  { key: 'FLIGHT', label: 'Flight' },
  { key: 'BA', label: 'BA' },
  { key: 'UX', label: 'UX' },
  { key: 'EPIC', label: 'Epic' },
  { key: 'BUGS', label: 'Bugs' },
  { key: 'ALL', label: 'Всі' },
];

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

const DEFAULT_SORT: SortState = { field: 'statusSince', direction: 'desc' };
const OAUTH_STATE_STORAGE_KEY = 'jira_oauth_state';
const SPRINT_ID_STORAGE_KEY = 'jira_manual_sprint_id';

interface Filters {
  priority: string[];
  status: string[];
  assignee: string[];
}

type DashboardView = 'dashboard' | 'storyStats';

function App() {
  const [tokens, setTokens] = useState<OAuthTokens | null>(null);
  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const [activeCategory, setActiveCategory] = useState<Category>('FE');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [filters, setFilters] = useState<Filters>({ priority: [], status: [], assignee: [] });
  const [manualSprintId, setManualSprintId] = useState<string>(() => {
    return window.sessionStorage.getItem(SPRINT_ID_STORAGE_KEY) ?? '';
  });

  const handleSprintIdChange = useCallback((value: string) => {
    setManualSprintId(value);
    window.sessionStorage.setItem(SPRINT_ID_STORAGE_KEY, value);
  }, []);

  const {
    data,
    loading,
    refreshing,
    error,
    refresh,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
  } = useDashboard({ tokens, onTokensChange: setTokens, sprintId: manualSprintId || undefined });

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

  const categoryIssues = useMemo(() => {
    if (data === null) {
      return [];
    }

    if (activeCategory === 'ALL') {
      return data.issues;
    }

    return data.issues.filter((issue) => issue.category === activeCategory);
  }, [data, activeCategory]);

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

  const filteredIssues = useMemo(() => {
    return categoryIssues.filter((issue) => {
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
  }, [categoryIssues, filters]);

  const sortedIssues = useMemo(() => {
    return sortIssues(filteredIssues, sort.field, sort.direction);
  }, [filteredIssues, sort]);

  const counts = useMemo(() => {
    const result: Record<Category, number> = {
      FE: 0,
      BE: 0,
      QA: 0,
      AQA: 0,
      FLIGHT: 0,
      BA: 0,
      UX: 0,
      EPIC: 0,
      BUGS: 0,
      OTHER: 0,
      ALL: 0,
    };

    if (data === null) {
      return result;
    }

    for (const issue of data.issues) {
      result[issue.category] += 1;
    }

    result.ALL = data.issues.length;

    return result;
  }, [data]);

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

  const clearFilters = useCallback(() => {
    setFilters({ priority: [], status: [], assignee: [] });
  }, [setFilters]);

  if (tokens === null) {
    return (
      <LoginForm
        loading={loading}
        error={error}
        sprintId={manualSprintId}
        onSprintIdChange={handleSprintIdChange}
      />
    );
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
        ) : (
          <>
            <Tabs
              categories={TABS.map((tab) => tab.key)}
              counts={counts}
              labels={CATEGORY_LABELS}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />

            <div className="filter-bar">
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
                  filters.priority.length === 0 &&
                  filters.status.length === 0 &&
                  filters.assignee.length === 0
                }
              >
                Clear all filters
              </button>
            </div>

            <IssueTable issues={sortedIssues} sort={sort} onSort={handleSort} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
