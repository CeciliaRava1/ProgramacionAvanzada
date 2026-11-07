import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comprobarSaludDelBackend } from '../src/salud.ts';

test('acepta la respuesta esperada del backend', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ status: 'ok' }),
  );

  await comprobarSaludDelBackend(t.signal);

  assert.equal(simulacion.mock.calls[0].arguments[0], 'http://127.0.0.1:3000/health');
});

test('rechaza un error HTTP aunque el cuerpo indique ok', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ status: 'ok' }, { status: 503 }),
  );

  await assert.rejects(comprobarSaludDelBackend(t.signal), /respondió con un error/);
});

test('rechaza una respuesta JSON que no confirma el estado', async (t) => {
  for (const cuerpo of [null, 'ok', {}, { status: 'error' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(cuerpo));
    await assert.rejects(comprobarSaludDelBackend(t.signal), /respuesta del backend no es válida/);
  }
});

test('rechaza una respuesta que no es JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('No es JSON'));

  await assert.rejects(comprobarSaludDelBackend(t.signal), SyntaxError);
});

test('propaga un fallo de red para mostrar el estado de error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });

  await assert.rejects(comprobarSaludDelBackend(t.signal), /Failed to fetch/);
});
