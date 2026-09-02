import type { FC } from 'react';
import { buildAuthorizeUrl } from '../services/api';

interface LoginFormProps {
  loading: boolean;
  error: string | null;
  sprintId: string;
  onSprintIdChange: (value: string) => void;
}

function generateState(): string {
  const buffer = new Uint8Array(32);
  window.crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export const LoginForm: FC<LoginFormProps> = ({ loading, error, sprintId, onSprintIdChange }) => {
  const handleLogin = () => {
    const state = generateState();
    window.sessionStorage.setItem('jira_oauth_state', state);
    window.location.href = buildAuthorizeUrl(state);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">JIRA SPRINT DASHBOARD</h1>
        <p className="login-subtitle">Увійдіть через Jira Cloud</p>

        <label className="login-label" htmlFor="sprint-id">
          Sprint ID (необов’язково)
        </label>
        <input
          id="sprint-id"
          type="text"
          className="login-input"
          placeholder="наприклад, 31 або Sprint 31"
          value={sprintId}
          onChange={(event) => onSprintIdChange(event.target.value)}
          disabled={loading}
        />

        <button
          type="button"
          className="login-button"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Підключення...' : 'Login with Jira'}
        </button>

        {error !== null && <div className="login-error">{error}</div>}

        <p className="login-note">
          Якщо не вказати Sprint ID, dashboard спробує знайти активний спринт автоматично.
        </p>
      </div>
    </div>
  );
};
