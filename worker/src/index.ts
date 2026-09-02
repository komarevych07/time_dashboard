export interface Env {
  JIRA_BASE_URL: string;
  BOARD_NAME: string;
  PROJECT_KEY: string;
  ALLOWED_ORIGINS: string;
  JIRA_CLIENT_ID: string;
  JIRA_CLIENT_SECRET: string;
  REDIRECT_URI: string;
}

interface TokenExchangeRequest {
  code?: string;
  refreshToken?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface OAuthTokensPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface JiraApiContext {
  accessToken: string;
  jiraApiBase: string;
}

interface JiraSprint {
  id: number;
  name: string;
  state: string;
}

interface JiraIssueFields {
  summary: string;
  created: string;
  priority?: { name: string } | null;
  status?: { name: string } | null;
  assignee?: { displayName: string } | null;
  issuetype?: { name: string } | null;
  [key: string]: unknown;
}

interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}

interface JiraChangelogEntry {
  id: string;
  created: string;
  items: JiraChangelogItem[];
}

interface JiraChangelogItem {
  field: string;
  toString: string;
}

interface DashboardIssue {
  id: string;
  key: string;
  summary: string;
  priority: string;
  status: string;
  statusSince: string;
  assignee: string | null;
  issueType: string;
  url: string;
  category: 'FE' | 'BE' | 'QA' | 'BUGS' | 'OTHER';
}

interface DashboardResponse {
  board: { id: number; name: string };
  sprint: { id: number; name: string; state: string };
  issues: DashboardIssue[];
  loadedAt: string;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

interface AccessibleResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
  avatarUrl: string;
}

const DEFAULT_MAX_RESULTS = 50;
const CHANGELOG_MAX_RESULTS = 100;
const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ATLASSIAN_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return handleCors(request, env, 204);
    }

    const path = url.pathname;

    if (path === '/api/auth/callback' && request.method === 'POST') {
      return handleAuthCallback(request, env);
    }

    if (path === '/api/auth/refresh' && request.method === 'POST') {
      return handleAuthRefresh(request, env);
    }

    if (path === '/api/dashboard' && request.method === 'POST') {
      return handleDashboard(request, env);
    }

    return jsonResponse(
      { error: { code: 'NOT_FOUND', message: 'Endpoint не знайдено.' } },
      404,
      request,
      env,
    );
  },
};

async function handleAuthCallback(request: Request, env: Env): Promise<Response> {
  const body = await parseJsonBody<TokenExchangeRequest>(request);

  if (body === null || typeof body.code !== 'string' || body.code === '') {
    return jsonResponse(
      { error: { code: 'MISSING_CODE', message: 'Відсутній authorization code.' } },
      400,
      request,
      env,
    );
  }

  try {
    const tokens = await exchangeToken({
      grant_type: 'authorization_code',
      client_id: env.JIRA_CLIENT_ID,
      client_secret: env.JIRA_CLIENT_SECRET,
      code: body.code,
      redirect_uri: env.REDIRECT_URI,
    });

    return jsonResponse(tokens, 200, request, env);
  } catch {
    return jsonResponse(
      { error: { code: 'OAUTH_CALLBACK_FAILED', message: 'Не вдалося увійти через Jira.' } },
      401,
      request,
      env,
    );
  }
}

async function handleAuthRefresh(request: Request, env: Env): Promise<Response> {
  const body = await parseJsonBody<TokenExchangeRequest>(request);

  if (body === null || typeof body.refreshToken !== 'string' || body.refreshToken === '') {
    return jsonResponse(
      { error: { code: 'MISSING_REFRESH_TOKEN', message: 'Відсутній refresh token.' } },
      400,
      request,
      env,
    );
  }

  try {
    const tokens = await exchangeToken({
      grant_type: 'refresh_token',
      client_id: env.JIRA_CLIENT_ID,
      client_secret: env.JIRA_CLIENT_SECRET,
      refresh_token: body.refreshToken,
    });

    return jsonResponse(tokens, 200, request, env);
  } catch {
    return jsonResponse(
      { error: { code: 'OAUTH_REFRESH_FAILED', message: 'Не вдалося оновити сесію. Увійдіть знову.' } },
      401,
      request,
      env,
    );
  }
}

async function exchangeToken(
  payload: Record<string, string>,
): Promise<OAuthTokensPayload> {
  const response = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as TokenResponse;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

async function handleDashboard(request: Request, env: Env): Promise<Response> {
  const accessToken = extractBearerToken(request);

  if (accessToken === null) {
    return jsonResponse(
      { error: { code: 'MISSING_TOKEN', message: 'Відсутній access token.' } },
      401,
      request,
      env,
    );
  }

  try {
    const cloudId = await resolveCloudId(accessToken, env.JIRA_BASE_URL);

    if (cloudId === null) {
      return jsonResponse(
        { error: { code: 'SITE_NOT_FOUND', message: 'Jira site не знайдено для налаштованого JIRA_BASE_URL.' } },
        404,
        request,
        env,
      );
    }

    const jiraApiBase = `https://api.atlassian.com/ex/jira/${cloudId}`;
    const context: JiraApiContext = { accessToken, jiraApiBase };

    const { sprint, issues } = await fetchActiveSprintIssues(context, env.PROJECT_KEY);

    if (sprint === null) {
      return jsonResponse(
        {
          error: {
            code: 'ACTIVE_SPRINT_NOT_FOUND',
            message: `Active sprint для проєкту "${env.PROJECT_KEY}" не знайдено.`,
          },
        },
        404,
        request,
        env,
      );
    }

    const dashboardIssues = await buildDashboardIssues(context, issues, env.JIRA_BASE_URL);

    const response: DashboardResponse = {
      board: { id: 0, name: env.BOARD_NAME },
      sprint: { id: sprint.id, name: sprint.name, state: sprint.state },
      issues: dashboardIssues,
      loadedAt: new Date().toISOString(),
    };

    return jsonResponse(response, 200, request, env);
  } catch (error) {
    return handleJiraError(error, request, env);
  }
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/.exec(auth);
  return match?.[1] ?? null;
}

async function resolveCloudId(accessToken: string, configuredBaseUrl: string): Promise<string | null> {
  const response = await fetch(ATLASSIAN_RESOURCES_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Accessible resources failed: ${response.status} ${text}`);
  }

  const resources = (await response.json()) as AccessibleResource[];
  const normalizedTarget = normalizeUrl(configuredBaseUrl);

  for (const resource of resources) {
    if (normalizeUrl(resource.url) === normalizedTarget) {
      return resource.id;
    }
  }

  return null;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '').toLowerCase();
}

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  const contentType = request.headers.get('Content-Type') ?? '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

async function findSprintFieldId(context: JiraApiContext): Promise<string | null> {
  const url = `${context.jiraApiBase}/rest/api/3/field`;
  const response = await fetchJira(context, url);
  const fields = (await response.json()) as Array<{
    id: string;
    name: string;
    schema?: { custom?: string };
  }>;

  for (const field of fields) {
    if (field.name === 'Sprint' && field.schema?.custom === 'com.pyxis.greenhopper.jira:sprint') {
      return field.id;
    }
  }

  return null;
}

function extractActiveSprint(issues: JiraIssue[], sprintFieldId: string | null): JiraSprint | null {
  if (sprintFieldId === null) {
    return null;
  }

  for (const issue of issues) {
    const sprints = issue.fields[sprintFieldId] as Array<{ id: number; name: string; state: string }> | undefined;

    if (Array.isArray(sprints)) {
      for (const sprint of sprints) {
        if (sprint.state === 'ACTIVE') {
          return { id: sprint.id, name: sprint.name, state: sprint.state };
        }
      }
    }
  }

  return null;
}

async function fetchActiveSprintIssues(
  context: JiraApiContext,
  projectKey: string,
): Promise<{ sprint: JiraSprint | null; issues: JiraIssue[] }> {
  const sprintFieldId = await findSprintFieldId(context);
  const issues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = DEFAULT_MAX_RESULTS;
  const jql = `project = ${projectKey} AND sprint in openSprints() ORDER BY key ASC`;
  const fields = sprintFieldId
    ? `summary,created,priority,status,assignee,issuetype,${sprintFieldId}`
    : 'summary,created,priority,status,assignee,issuetype';

  while (true) {
    const url = `${context.jiraApiBase}/rest/api/3/search?jql=${encodeURIComponent(
      jql,
    )}&startAt=${startAt}&maxResults=${maxResults}&fields=${fields}`;
    const response = await fetchJira(context, url);
    const data = (await response.json()) as {
      issues: JiraIssue[];
      total: number;
      maxResults: number;
      startAt: number;
    };

    const pageIssues = data.issues ?? [];
    issues.push(...pageIssues);

    const returnedCount = pageIssues.length;
    const processedCount = startAt + returnedCount;

    if (returnedCount < maxResults || processedCount >= data.total) {
      break;
    }

    startAt = processedCount;
  }

  const sprint = extractActiveSprint(issues, sprintFieldId);

  return { sprint, issues };
}

async function buildDashboardIssues(
  context: JiraApiContext,
  issues: JiraIssue[],
  baseUrl: string,
): Promise<DashboardIssue[]> {
  const result: DashboardIssue[] = [];

  for (const issue of issues) {
    const statusSince = await computeStatusSince(context, issue);
    const summary = issue.fields.summary ?? '';
    const issueType = issue.fields.issuetype?.name ?? 'Unknown';

    result.push({
      id: issue.id,
      key: issue.key,
      summary,
      priority: issue.fields.priority?.name ?? 'None',
      status: issue.fields.status?.name ?? 'Unknown',
      statusSince,
      assignee: issue.fields.assignee?.displayName ?? null,
      issueType,
      url: `${baseUrl.replace(/\/$/, '')}/browse/${issue.key}`,
      category: categorizeIssue(summary, issueType),
    });
  }

  return result;
}

async function computeStatusSince(context: JiraApiContext, issue: JiraIssue): Promise<string> {
  const currentStatus = issue.fields.status?.name ?? '';
  let startAt = 0;
  let latestTransition: JiraChangelogEntry | null = null;

  while (true) {
    const url = `${context.jiraApiBase}/rest/api/2/issue/${issue.id}/changelog?startAt=${startAt}&maxResults=${CHANGELOG_MAX_RESULTS}`;
    const response = await fetchJira(context, url);
    const data = (await response.json()) as {
      values: JiraChangelogEntry[];
      maxResults: number;
      total: number;
    };

    const entries = data.values ?? [];

    for (const entry of entries) {
      const hasStatusTransition = entry.items.some(
        (item) => item.field === 'status' && item.toString === currentStatus,
      );

      if (!hasStatusTransition) {
        continue;
      }

      if (
        latestTransition === null ||
        new Date(entry.created).getTime() > new Date(latestTransition.created).getTime()
      ) {
        latestTransition = entry;
      }
    }

    if (entries.length < data.maxResults || startAt + entries.length >= data.total) {
      break;
    }

    startAt += CHANGELOG_MAX_RESULTS;
  }

  if (latestTransition !== null) {
    return latestTransition.created;
  }

  return issue.fields.created;
}

function categorizeIssue(summary: string, issueType: string): DashboardIssue['category'] {
  if (/\[FE\]/i.test(summary)) {
    return 'FE';
  }

  if (/\[BE\]/i.test(summary)) {
    return 'BE';
  }

  if (/\[QA\]/i.test(summary)) {
    return 'QA';
  }

  if (issueType.toLowerCase() === 'bug') {
    return 'BUGS';
  }

  return 'OTHER';
}

async function fetchJira(context: JiraApiContext, url: string): Promise<Response> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${context.accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Jira API error: ${response.status} ${response.statusText}`);
    (error as Error & { status?: number; body?: string }).status = response.status;
    (error as Error & { status?: number; body?: string }).body = body;
    throw error;
  }

  return response;
}

function handleJiraError(error: unknown, request: Request, env: Env): Response {
  if (error instanceof Error && 'status' in error) {
    const status = error.status as number;

    const detail = (error as Error & { body?: string }).body ?? '';

    if (status === 401) {
      return jsonResponse(
        {
          error: {
            code: 'JIRA_AUTH_FAILED',
            message: `Access token недійсний або прострочений. ${detail}`.trim(),
          },
        },
        401,
        request,
        env,
      );
    }

    if (status === 403) {
      return jsonResponse(
        {
          error: {
            code: 'JIRA_ACCESS_DENIED',
            message: `Немає доступу до Jira board. ${detail}`.trim(),
          },
        },
        403,
        request,
        env,
      );
    }

    if (status === 404) {
      return jsonResponse(
        {
          error: {
            code: 'JIRA_NOT_FOUND',
            message: `Ресурс Jira не знайдено. ${detail}`.trim(),
          },
        },
        404,
        request,
        env,
      );
    }

    return jsonResponse(
      {
        error: {
          code: 'JIRA_API_ERROR',
          message: `Jira API повернула помилку. ${detail}`.trim(),
        },
      },
      502,
      request,
      env,
    );
  }

  return jsonResponse(
    { error: { code: 'INTERNAL_ERROR', message: 'Не вдалося обробити запит.' } },
    500,
    request,
    env,
  );
}

function jsonResponse(
  body: DashboardResponse | OAuthTokensPayload | ErrorResponse,
  status: number,
  request: Request,
  env: Env,
): Response {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return applyCorsHeaders(response, request, env);
}

function handleCors(request: Request, env: Env, status: number): Response {
  const response = new Response(null, { status });
  return applyCorsHeaders(response, request, env);
}

function applyCorsHeaders(response: Response, request: Request, env: Env): Response {
  const origin = request.headers.get('Origin') ?? '';
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim());
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : '';

  if (allowedOrigin !== '') {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  }

  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}
