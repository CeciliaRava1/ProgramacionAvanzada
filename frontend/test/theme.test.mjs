import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readThemePreference, saveThemePreference } from '../src/ui/theme.ts';

test('el tema inicial es claro y solo acepta una preferencia reconocida', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else delete globalThis.window; });
  for (const value of [null, 'light', 'dark', 'system', 'invalid', 'Dark', ' dark ']) {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem(key) { assert.equal(key, 'gymhelper-theme'); return value; } } } });
    assert.equal(readThemePreference(), value === 'dark' ? 'dark' : 'light');
  }
});

test('guarda la elección para recuperarla en la próxima visita', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else delete globalThis.window; });
  const saved = new Map();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } } });
  for (const theme of ['dark', 'light']) {
    assert.equal(saveThemePreference(theme), true);
    assert.equal(saved.get('gymhelper-theme'), theme);
    assert.equal(readThemePreference(), theme);
  }
});

test('el almacenamiento bloqueado no impide usar la aplicación ni cambiar el tema', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else delete globalThis.window; });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { get localStorage() { throw new Error('Storage blocked'); } } });
  assert.equal(readThemePreference(), 'light');
  assert.equal(saveThemePreference('dark'), false);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem() { throw new Error('Read blocked'); }, setItem() { throw new Error('Write blocked'); } } } });
  assert.equal(readThemePreference(), 'light');
  assert.equal(saveThemePreference('light'), false);
});
