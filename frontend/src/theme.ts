const KEY = 'courtiq_theme';

export type Theme = 'light' | 'dark';

function stored(): Theme | null {
  const value = localStorage.getItem(KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

export function currentTheme(): Theme {
  return (
    stored() ??
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
}

export function initTheme() {
  const choice = stored();
  if (choice) document.documentElement.dataset.theme = choice;
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(KEY, next);
  document.documentElement.dataset.theme = next;
  return next;
}
