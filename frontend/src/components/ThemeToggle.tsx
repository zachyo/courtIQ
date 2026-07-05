import { useState } from 'react';
import { currentTheme, toggleTheme } from '../theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme());
  return (
    <button
      type="button"
      className="btn btn-sm"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      onClick={() => setTheme(toggleTheme())}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
