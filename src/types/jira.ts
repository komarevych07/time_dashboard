export type Category = 'FE' | 'BE' | 'QA' | 'AQA' | 'FLIGHT' | 'BA' | 'BUGS' | 'OTHER';

export interface DashboardIssue {
  id: string;
  key: string;
  summary: string;
  priority: string;
  status: string;
  statusSince: string;
  assignee: string | null;
  issueType: string;
  url: string;
  category: Category;
}

export interface BoardInfo {
  id: number;
  name: string;
}

export interface SprintInfo {
  id: number;
  name: string;
  state: string;
}

export interface DashboardData {
  board: BoardInfo;
  sprint: SprintInfo;
  issues: DashboardIssue[];
  loadedAt: string;
}

export interface DashboardError {
  error: {
    code: string;
    message: string;
  };
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export type SortDirection = 'asc' | 'desc';

export type SortField = 'key' | 'summary' | 'priority' | 'status' | 'statusSince' | 'assignee';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export interface TabConfig {
  key: Category;
  label: string;
}
