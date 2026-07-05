import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { useAuth } from '../auth';

export default function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [watchCode, setWatchCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent, mode: 'login' | 'register') {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, displayName);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const emailField = (
    <>
      <label className="label" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        className="input"
        type="email"
        value={email}
        required
        onChange={(e) => setEmail(e.target.value)}
      />
    </>
  );
  const passwordField = (
    <>
      <label className="label" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        className="input"
        type="password"
        value={password}
        minLength={8}
        required
        onChange={(e) => setPassword(e.target.value)}
      />
    </>
  );

  return (
    <div className="page-center">
      <div style={{ width: 'min(92vw, 400px)' }}>
        <h1 style={{ textAlign: 'center' }}>
          Court<span style={{ color: 'var(--accent)' }}>IQ</span> 🏀
        </h1>

        <div className="card">
          <Tabs.Root defaultValue="login">
            <Tabs.List className="tabs-list">
              <Tabs.Trigger className="tabs-trigger" value="login">
                Log in
              </Tabs.Trigger>
              <Tabs.Trigger className="tabs-trigger" value="register">
                Sign up
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="login">
              <form onSubmit={(e) => submit(e, 'login')}>
                {emailField}
                {passwordField}
                {error && <p className="error">{error}</p>}
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1.2rem' }}
                  disabled={busy}
                >
                  Log in
                </button>
              </form>
            </Tabs.Content>

            <Tabs.Content value="register">
              <form onSubmit={(e) => submit(e, 'register')}>
                <label className="label" htmlFor="displayName">
                  Your name
                </label>
                <input
                  id="displayName"
                  className="input"
                  value={displayName}
                  maxLength={60}
                  required
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                {emailField}
                {passwordField}
                {error && <p className="error">{error}</p>}
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1.2rem' }}
                  disabled={busy}
                >
                  Create account
                </button>
              </form>
            </Tabs.Content>
          </Tabs.Root>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <p className="muted" style={{ margin: '0 0 0.6rem' }}>
            Just watching? Enter a match code:
          </p>
          <form
            className="field-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (watchCode.trim()) navigate(`/watch/${watchCode.trim().toUpperCase()}`);
            }}
          >
            <input
              className="input"
              placeholder="e.g. 8RYGKQ"
              aria-label="Match code"
              value={watchCode}
              maxLength={10}
              onChange={(e) => setWatchCode(e.target.value)}
            />
            <button className="btn" type="submit">
              Watch
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
