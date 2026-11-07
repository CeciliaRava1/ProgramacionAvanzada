import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guardarPreferenciaDeTema, leerPreferenciaDeTema } from '../src/interfaz/tema.ts';

test('el tema inicial es claro y solo acepta una preferencia reconocida', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else delete globalThis.window; });
  for (const valor of [null, 'claro', 'oscuro', 'sistema', 'invalido', 'Oscuro', ' oscuro ', 'dark']) {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem(clave) { assert.equal(clave, 'gymhelper-tema'); return valor; } } } });
    assert.equal(leerPreferenciaDeTema(), valor === 'oscuro' ? 'oscuro' : 'claro');
  }
});

test('guarda la elección para recuperarla en la próxima visita', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else delete globalThis.window; });
  const guardado = new Map();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: clave => guardado.get(clave) ?? null, setItem: (clave, valor) => guardado.set(clave, valor) } } });
  for (const tema of ['oscuro', 'claro']) {
    assert.equal(guardarPreferenciaDeTema(tema), true);
    assert.equal(guardado.get('gymhelper-tema'), tema);
    assert.equal(leerPreferenciaDeTema(), tema);
  }
});

test('el almacenamiento bloqueado no impide usar la aplicación ni cambiar el tema', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else delete globalThis.window; });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { get localStorage() { throw new Error('Almacenamiento bloqueado'); } } });
  assert.equal(leerPreferenciaDeTema(), 'claro');
  assert.equal(guardarPreferenciaDeTema('oscuro'), false);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem() { throw new Error('Lectura bloqueada'); }, setItem() { throw new Error('Escritura bloqueada'); } } } });
  assert.equal(leerPreferenciaDeTema(), 'claro');
  assert.equal(guardarPreferenciaDeTema('claro'), false);
});
