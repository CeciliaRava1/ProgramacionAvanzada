export type Theme = 'light' | 'dark';

export function readThemePreference(): Theme {
  try { return window.localStorage.getItem('gymhelper-theme') === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

export function saveThemePreference(theme: Theme): boolean {
  try { window.localStorage.setItem('gymhelper-theme', theme); return true; }
  catch { return false; }
}
