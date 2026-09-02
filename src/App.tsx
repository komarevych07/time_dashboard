import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { IssueTable } from './components/IssueTable';
import { LoginForm } from './components/LoginForm';
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
  priority: string;
  status: string;
  assignee: string;
}

type DashboardView = 'dashboard' | 'storyStats';

function App() {
  const [tokens, setTokens] = useState<OAuthTokens | null>(null);
  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const [activeCategory, setActiveCategory] = useState<Category>('FE');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [filters, setFilters] = useState<Filters>({ priority: '', status: '', assignee: '' });
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
      if (filters.priority !== '' && issue.priority !== filters.priority) {
        return false;
      }

      if (filters.status !== '' && issue.status !== filters.status) {
        return false;
      }

      if (filters.assignee !== '') {
        const issueAssignee = issue.assignee ?? 'Unassigned';
        if (issueAssignee !== filters.assignee) {
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

  const handleFilterChange = useCallback(
    (key: keyof Filters, value: string) => {
      setFilters((current) => ({ ...current, [key]: value }));
    },
    [setFilters],
  );

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
              <select
                className="filter-select"
                value={filters.priority}
                onChange={(event) => handleFilterChange('priority', event.target.value)}
                aria-label="Priority filter"
              >
                <option value="">All priorities</option>
                {filterOptions.priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={filters.status}
                onChange={(event) => handleFilterChange('status', event.target.value)}
                aria-label="Status filter"
              >
                <option value="">All statuses</option>
                {filterOptions.statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={filters.assignee}
                onChange={(event) => handleFilterChange('assignee', event.target.value)}
                aria-label="Assignee filter"
              >
                <option value="">All assignees</option>
                {filterOptions.assignees.map((assignee) => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
            </div>

            <IssueTable issues={sortedIssues} sort={sort} onSort={handleSort} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
