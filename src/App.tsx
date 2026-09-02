import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { IssueTable } from './components/IssueTable';
import { LoginForm } from './components/LoginForm';
import { Tabs } from './components/Tabs';
import { useDashboard } from './hooks/useDashboard';
import { exchangeCode } from './services/api';
import { sortIssues } from './utils/sorting';
import type { Category, OAuthTokens, SortField, SortState, TabConfig } from './types/jira';

const TABS: TabConfig[] = [
  { key: 'FE', label: 'FE' },
  { key: 'BE', label: 'BE' },
  { key: 'QA', label: 'QA' },
  { key: 'BUGS', label: 'Bugs' },
  { key: 'OTHER', label: 'Інші' },
];

const CATEGORY_LABELS: Record<Category, string> = {
  FE: 'FE',
  BE: 'BE',
  QA: 'QA',
  BUGS: 'Bugs',
  OTHER: 'Інші',
};

const DEFAULT_SORT: SortState = { field: 'statusSince', direction: 'desc' };
const OAUTH_STATE_STORAGE_KEY = 'jira_oauth_state';

function App() {
  const [tokens, setTokens] = useState<OAuthTokens | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('FE');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

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

  const categoryIssues = useMemo(() => {
    if (data === null) {
      return [];
    }

    return data.issues.filter((issue) => issue.category === activeCategory);
  }, [data, activeCategory]);

  const sortedIssues = useMemo(() => {
    return sortIssues(categoryIssues, sort.field, sort.direction);
  }, [categoryIssues, sort]);

  const counts = useMemo(() => {
    const result: Record<Category, number> = {
      FE: 0,
      BE: 0,
      QA: 0,
      BUGS: 0,
      OTHER: 0,
    };

    if (data === null) {
      return result;
    }

    for (const issue of data.issues) {
      result[issue.category] += 1;
    }

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

  if (tokens === null) {
    return (
      <LoginForm
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="app">
      <Header
        data={data}
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
        ) : data === null ? null : (
          <>
            <Tabs
              categories={TABS.map((tab) => tab.key)}
              counts={counts}
              labels={CATEGORY_LABELS}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />

            <IssueTable issues={sortedIssues} sort={sort} onSort={handleSort} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
