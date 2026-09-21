import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { DashboardData, OAuthTokens } from '../types/jira';
import { fetchDashboard, refreshAccessToken } from '../services/api';

interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

interface UseDashboardProps {
  tokens: OAuthTokens | null;
  onTokensChange: (tokens: OAuthTokens) => void;
}

export function useDashboard({
  tokens,
  onTokensChange,
}: UseDashboardProps): DashboardState & {
  refresh: () => void;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: Dispatch<SetStateAction<boolean>>;
} {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const tokensRef = useRef(tokens);
  const onTokensChangeRef = useRef(onTokensChange);
  tokensRef.current = tokens;
  onTokensChangeRef.current = onTokensChange;

  const ensureValidAccessToken = useCallback(async (): Promise<OAuthTokens> => {
    const currentTokens = tokensRef.current;

    if (currentTokens === null) {
      throw new Error('Сесія не активна.');
    }

    if (Date.now() < currentTokens.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
      return currentTokens;
    }

    const refreshed = await refreshAccessToken(currentTokens.refreshToken);
    onTokensChangeRef.current(refreshed);
    tokensRef.current = refreshed;
    return refreshed;
  }, []);

  const load = useCallback(async (isRefresh: boolean) => {
    if (tokensRef.current === null) {
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const validTokens = await ensureValidAccessToken();
      const result = await fetchDashboard(validTokens.accessToken);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити задачі.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ensureValidAccessToken]);

  useEffect(() => {
    if (tokens === null) {
      return;
    }

    setData(null);
    setError(null);
    void load(false);
  }, [tokens, load]);

  useEffect(() => {
    if (!autoRefreshEnabled || tokens === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void load(true);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshEnabled, tokens, load]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return {
    data,
    loading,
    refreshing,
    error,
    refresh,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
  };
}
