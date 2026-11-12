import type { DashboardError, DashboardPage, OAuthTokens } from '../types/jira';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const JIRA_CLIENT_ID = (import.meta.env.VITE_JIRA_CLIENT_ID ?? '').trim();
const JIRA_REDIRECT_URI = (import.meta.env.VITE_JIRA_REDIRECT_URI ?? '').trim();
const JIRA_SCOPE = 'read:jira-work read:jira-user offline_access';

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

const RETRY_DELAYS_MS = [1000, 2000, 4000];

export async function fetchDashboardPage(
  accessToken: string,
  nextPageToken: string | null,
): Promise<DashboardPage> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1]!);
    }

    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}/api/dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(nextPageToken === null ? {} : { nextPageToken }),
      });
    } catch (error) {
      // TypeError: Failed to fetch — мережева помилка, повторюємо
      lastError = error;
      continue;
    }

    const data: unknown = await response.json();

    if (!response.ok) {
      const error = data as DashboardError;
      const message = error.error?.message ?? 'Не вдалося завантажити задачі.';

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(message);
        continue;
      }

      throw new Error(message);
    }

    return data as DashboardPage;
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Не вдалося завантажити задачі. Перевірте з\'єднання.');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
