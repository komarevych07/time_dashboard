import type { DashboardData, DashboardError, OAuthTokens } from '../types/jira';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const JIRA_CLIENT_ID = import.meta.env.VITE_JIRA_CLIENT_ID ?? '';
const JIRA_REDIRECT_URI = import.meta.env.VITE_JIRA_REDIRECT_URI ?? '';
const JIRA_SCOPE = 'read:project:jira read:board-scope:jira-software read:sprint:jira-software read:issue:jira offline_access';

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: JIRA_CLIENT_ID,
    scope: JIRA_SCOPE,
    redirect_uri: JIRA_REDIRECT_URI,
    state,
    response_type: 'code',
    prompt: 'consent',
  });

  const query = params.toString().replace(/\+/g, '%20');

  return `https://auth.atlassian.com/authorize?${query}`;
}

export async function exchangeCode(code: string): Promise<OAuthTokens> {
  const response = await fetch(`${API_BASE_URL}/api/auth/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const error = data as DashboardError;
    throw new Error(error.error?.message ?? 'Не вдалося увійти через Jira.');
  }

  return parseTokenResponse(data);
}

export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const error = data as DashboardError;
    throw new Error(error.error?.message ?? 'Не вдалося оновити сесію.');
  }

  return parseTokenResponse(data);
}

export async function fetchDashboard(accessToken: string): Promise<DashboardData> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const error = data as DashboardError;
    throw new Error(error.error?.message ?? 'Не вдалося завантажити задачі.');
  }

  return data as DashboardData;
}

function parseTokenResponse(data: unknown): OAuthTokens {
  const record = data as Record<string, unknown>;
  const accessToken = typeof record.accessToken === 'string' ? record.accessToken : '';
  const refreshToken = typeof record.refreshToken === 'string' ? record.refreshToken : '';
  const expiresAt = typeof record.expiresAt === 'number' ? record.expiresAt : 0;

  if (accessToken === '' || refreshToken === '') {
    throw new Error('Невірна відповідь сервера при авторизації.');
  }

  return { accessToken, refreshToken, expiresAt };
}
