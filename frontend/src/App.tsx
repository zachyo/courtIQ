import { Link, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth';
import ThemeToggle from './components/ThemeToggle';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MatchConsolePage from './pages/MatchConsolePage';
import SpectatePage from './pages/SpectatePage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-center muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          Court<span>IQ</span> 🏀
        </Link>
        <div className="topbar-user">
          {user && <span>{user.displayName}</span>}
          <ThemeToggle />
          {user && (
            <button type="button" className="btn btn-sm" onClick={logout}>
              Log out
            </button>
          )}
        </div>
      </header>
      {children}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Shell>
              <DashboardPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/match/:id"
        element={
          <RequireAuth>
            <Shell>
              <MatchConsolePage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route path="/watch/:code" element={<SpectatePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
