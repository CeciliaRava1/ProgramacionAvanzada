import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSession, signIn, signOut } from '../src/auth/session.ts';

const user = { id: 1, firstName: 'Nombre', lastName: 'Apellido', email: 'alumno@example.test', role: 'student' };

test('recupera la sesión con cookies y distingue la ausencia de sesión de un fallo', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(user));
  assert.deepEqual(await getSession(t.signal), user);
  assert.equal(fetchMock.mock.calls[0].arguments[1].credentials, 'include');
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 401 }));
  assert.equal(await getSession(t.signal), null);
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 503 }));
  await assert.rejects(getSession(t.signal), /No se pudo consultar/);
});

test('iniciar sesión envía credenciales exactas y solo acepta datos públicos válidos', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(user));
  assert.deepEqual(await signIn(user.email, ' una clave anterior ', t.signal), user);
  const options = fetchMock.mock.calls[0].arguments[1];
  assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'include');
  assert.deepEqual(JSON.parse(options.body), { email: user.email, password: ' una clave anterior ' });
});

test('credenciales incorrectas y límite de intentos tienen mensajes conocidos', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Detalle interno' }, { status: 401 }));
  await assert.rejects(signIn(user.email, 'Clave123', t.signal), /Correo o contraseña incorrectos/);
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 429 }));
  await assert.rejects(signIn(user.email, 'Clave123', t.signal), /Demasiados intentos/);
});

test('rechaza identidades incompletas, roles desconocidos o respuestas con contraseñas', async (t) => {
  for (const body of [null, {}, { ...user, id: '1' }, { ...user, role: 'otro' }, { ...user, password: 'secreto' }, { ...user, passwordHash: 'hash' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(getSession(t.signal), /no es válida/);
  }
});

test('el cierre requiere confirmación del servidor', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await signOut(t.signal);
  assert.equal(fetchMock.mock.calls[0].arguments[1].method, 'DELETE');
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 500 }));
  await assert.rejects(signOut(t.signal), /No se pudo cerrar sesión/);
});

test('una respuesta no JSON o un fallo de red no confirma el acceso', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(getSession(t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin conexión'); });
  await assert.rejects(signIn(user.email, 'Clave123', t.signal), /No se pudo confirmar/);
});
