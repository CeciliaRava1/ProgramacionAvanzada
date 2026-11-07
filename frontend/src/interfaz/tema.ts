export type Tema = 'claro' | 'oscuro';

export function leerPreferenciaDeTema(): Tema {
  try { return window.localStorage.getItem('gymhelper-tema') === 'oscuro' ? 'oscuro' : 'claro'; }
  catch { return 'claro'; }
}

export function guardarPreferenciaDeTema(tema: Tema): boolean {
  try { window.localStorage.setItem('gymhelper-tema', tema); return true; }
  catch { return false; }
}
