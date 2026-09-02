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
  changelog?: {
    histories: JiraChangelogEntry[];
  };
}

interface JiraChangelogEntry {
  id: string;
  created: string;
  items: JiraChangelogItem[];
}

interface JiraChangelogItem {
  field: string;
  fromString?: string;
  toString: string;
}

interface StatusDuration {
  status: string;
  durationSeconds: number;
  percentage: number;
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
  category: 'FE' | 'BE' | 'QA' | 'AQA' | 'FLIGHT' | 'BA' | 'UX' | 'EPIC' | 'BUGS' | 'OTHER';
  leadTimeSeconds: number;
  statusDurations: StatusDuration[];
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
    const body = (await parseJsonBody<{ sprintId?: string }>(request)) ?? {};
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

    const { sprint, issues } = await fetchActiveSprintIssues(context, env.PROJECT_KEY, body.sprintId);

    if (sprint === null) {
      return jsonResponse(
        {
          error: {
            code: 'ACTIVE_SPRINT_NOT_FOUND',
            message: `Sprint не знайдено. Project: "${env.PROJECT_KEY}", Sprint: "${body.sprintId ?? 'auto'}", issues: ${issues.length}. Перевір PROJECT_KEY та Sprint ID/назву.`,
          },
        },
        404,
        request,
        env,
      );
    }

    const dashboardIssues = await buildDashboardIssues(issues, env.JIRA_BASE_URL);

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

function isSprintValue(value: unknown): value is { id: number; name: string; state: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'state' in value &&
    typeof (value as Record<string, unknown>).state === 'string'
  );
}

function extractActiveSprint(issues: JiraIssue[], sprintId?: string): JiraSprint | null {
  let fallback: JiraSprint | null = null;

  for (const issue of issues) {
    for (const fieldValue of Object.values(issue.fields)) {
      if (!Array.isArray(fieldValue)) {
        continue;
      }

      for (const item of fieldValue) {
        if (!isSprintValue(item)) {
          continue;
        }

        if (sprintId !== undefined && String(item.id) === sprintId) {
          return { id: item.id, name: item.name, state: item.state };
        }

        if (item.state.toUpperCase() === 'ACTIVE') {
          return { id: item.id, name: item.name, state: item.state };
        }

        if (fallback === null) {
          fallback = { id: item.id, name: item.name, state: item.state };
        }
      }
    }
  }

  return fallback;
}

function buildSprintFilter(sprintId?: string): string {
  if (sprintId === undefined || sprintId === '') {
    return 'sprint in openSprints()';
  }

  if (/^\d+$/.test(sprintId)) {
    return `sprint = "Sprint ${sprintId}"`;
  }

  const escaped = sprintId.replace(/"/g, '\\"');
  return `sprint = "${escaped}"`;
}

async function fetchActiveSprintIssues(
  context: JiraApiContext,
  projectKey: string,
  sprintId?: string,
): Promise<{ sprint: JiraSprint | null; issues: JiraIssue[] }> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | null = null;
  const sprintFilter = buildSprintFilter(sprintId);
  const jql = `project = ${projectKey} AND ${sprintFilter} ORDER BY key ASC`;
  const url = `${context.jiraApiBase}/rest/api/3/search/jql`;

  while (true) {
    const body: Record<string, unknown> = {
      jql,
      maxResults: DEFAULT_MAX_RESULTS,
      fields: ['*all'],
      expand: 'changelog',
    };

    if (nextPageToken !== null) {
      body.nextPageToken = nextPageToken;
    }

    const response = await fetchJira(context, url, {
      method: 'POST',
      body,
    });

    const data = (await response.json()) as {
      issues: JiraIssue[];
      isLast?: boolean;
      nextPageToken?: string;
    };

    const pageIssues = data.issues ?? [];
    issues.push(...pageIssues);

    if (data.isLast ?? data.nextPageToken === undefined) {
      break;
    }

    nextPageToken = data.nextPageToken ?? null;

    if (nextPageToken === null) {
      break;
    }
  }

  const sprint = extractActiveSprint(issues, sprintId);

  return { sprint, issues };
}

async function buildDashboardIssues(
  issues: JiraIssue[],
  baseUrl: string,
): Promise<DashboardIssue[]> {
  const result: DashboardIssue[] = [];

  for (const issue of issues) {
    const statusSince = computeStatusSince(issue);
    const summary = issue.fields.summary ?? '';
    const issueType = issue.fields.issuetype?.name ?? 'Unknown';
    const statusDurations = computeStatusDurations(issue);
    const leadTimeSeconds = computeLeadTimeSeconds(issue);

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
      leadTimeSeconds,
      statusDurations,
    });
  }

  return result;
}

function computeStatusSince(issue: JiraIssue): string {
  const currentStatus = issue.fields.status?.name ?? '';
  let latestTransition: JiraChangelogEntry | null = null;

  const entries = issue.changelog?.histories ?? [];

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

  if (latestTransition !== null) {
    return latestTransition.created;
  }

  return issue.fields.created;
}

function computeLeadTimeSeconds(issue: JiraIssue): number {
  const createdTime = new Date(issue.fields.created).getTime();
  const currentStatus = issue.fields.status?.name ?? '';

  if (currentStatus.toLowerCase() === 'done') {
    const doneTransition = findLatestDoneTransition(issue);

    if (doneTransition !== null) {
      return Math.max(0, Math.round((doneTransition.getTime() - createdTime) / 1000));
    }
  }

  return Math.max(0, Math.round((Date.now() - createdTime) / 1000));
}

function findLatestDoneTransition(issue: JiraIssue): Date | null {
  const entries = issue.changelog?.histories ?? [];
  let latestDone: Date | null = null;

  for (const entry of entries) {
    const movedToDone = entry.items.some(
      (item) => item.field === 'status' && item.toString.toLowerCase() === 'done',
    );

    if (!movedToDone) {
      continue;
    }

    const entryDate = new Date(entry.created);

    if (latestDone === null || entryDate.getTime() > latestDone.getTime()) {
      latestDone = entryDate;
    }
  }

  return latestDone;
}

function computeStatusDurations(issue: JiraIssue): StatusDuration[] {
  const now = Date.now();
  const createdTime = new Date(issue.fields.created).getTime();

  const transitions = (issue.changelog?.histories ?? [])
    .flatMap((entry) =>
      entry.items
        .filter((item) => item.field === 'status')
        .map((item) => ({
          time: new Date(entry.created).getTime(),
          from: item.fromString,
          to: item.toString,
        })),
    )
    .sort((a, b) => a.time - b.time);

  const intervals: { status: string; start: number; end: number }[] = [];

  if (transitions.length === 0) {
    intervals.push({
      status: issue.fields.status?.name ?? 'Unknown',
      start: createdTime,
      end: now,
    });
  } else {
    const first = transitions[0];

    if (first.from) {
      intervals.push({ status: first.from, start: createdTime, end: first.time });
    }

    for (let index = 0; index < transitions.length; index++) {
      const transition = transitions[index];
      const nextTime = index + 1 < transitions.length ? transitions[index + 1].time : now;
      intervals.push({ status: transition.to, start: transition.time, end: nextTime });
    }
  }

  const durations = new Map<string, number>();

  for (const interval of intervals) {
    const durationMs = interval.end - interval.start;

    if (durationMs <= 0) {
      continue;
    }

    durations.set(interval.status, (durations.get(interval.status) ?? 0) + durationMs);
  }

  const total = Array.from(durations.values()).reduce((sum, duration) => sum + duration, 0);

  return Array.from(durations.entries()).map(([status, durationMs]) => ({
    status,
    durationSeconds: Math.round(durationMs / 1000),
    percentage: total > 0 ? Math.round((durationMs / total) * 1000) / 10 : 0,
  }));
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

  if (/\[AQA\]/i.test(summary)) {
    return 'AQA';
  }

  if (/\[Flight\]/i.test(summary)) {
    return 'FLIGHT';
  }

  if (/\[BA\]/i.test(summary)) {
    return 'BA';
  }

  if (/\[UX\]/i.test(summary)) {
    return 'UX';
  }

  if (issueType.toLowerCase() === 'epic') {
    return 'EPIC';
  }

  if (issueType.toLowerCase() === 'bug') {
    return 'BUGS';
  }

  return 'OTHER';
}

async function fetchJira(
  context: JiraApiContext,
  url: string,
  options: { method?: 'GET' | 'POST'; body?: Record<string, unknown> } = {},
): Promise<Response> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Jira API error: ${response.status} ${response.statusText}`);
    (error as Error & { status?: number; body?: string; url?: string }).status = response.status;
    (error as Error & { status?: number; body?: string; url?: string }).body = body;
    (error as Error & { status?: number; body?: string; url?: string }).url = url;
    throw error;
  }

  return response;
}

function handleJiraError(error: unknown, request: Request, env: Env): Response {
  if (error instanceof Error && 'status' in error) {
    const status = error.status as number;

    const detail = (error as Error & { body?: string }).body ?? '';
    const failedUrl = (error as Error & { url?: string }).url ?? '';

    if (status === 401) {
      return jsonResponse(
        {
          error: {
            code: 'JIRA_AUTH_FAILED',
            message: `Access token недійсний або прострочений. ${detail} URL: ${failedUrl}`.trim(),
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

  const internalMessage = error instanceof Error ? error.message : String(error);

  return jsonResponse(
    { error: { code: 'INTERNAL_ERROR', message: `Не вдалося обробити запит: ${internalMessage}` } },
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
