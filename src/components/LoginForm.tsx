import type { FC } from 'react';
import { buildAuthorizeUrl } from '../services/api';

interface LoginFormProps {
  loading: boolean;
  error: string | null;
}

function generateState(): string {
  const buffer = new Uint8Array(32);
  window.crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export const LoginForm: FC<LoginFormProps> = ({ loading, error }) => {
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
          Після входу ви повернетесь на цю сторінку. Авторизаційні токени зберігаються лише в пам’яті вкладки.
        </p>
      </div>
    </div>
  );
};
