import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTrainers } from '../src/trainers/trainers.ts';

const trainer = { id: 1, firstName: 'Nombre', lastName: 'Apellido', availability: 'Tarde' };

test('consulta entrenadores con la sesión y admite horarios sin completar', async (t) => {
  const expected = [trainer, { ...trainer, id: 2, availability: null }];
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(expected));
  assert.deepEqual(await getTrainers(t.signal), expected);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/users/trainers');
  assert.equal(options.credentials, 'include');
});

test('una lista vacía es un resultado válido', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.deepEqual(await getTrainers(t.signal), []);
});

test('distingue sesión vencida, falta de permisos y fallos del servidor', async (t) => {
  for (const [status, message] of [[401, /sesión venció/], [403, /No tenés permiso/], [500, /No se pudo consultar/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status }));
    await assert.rejects(getTrainers(t.signal), (error) => message.test(error.message) && !error.message.includes('SQL'));
  }
});

test('rechaza datos incompletos, tipos incorrectos y cualquier campo privado', async (t) => {
  for (const body of [null, {}, [null], [{}], [{ ...trainer, id: '1' }], [{ ...trainer, firstName: ' ' }],
    [{ ...trainer, availability: undefined }], [{ ...trainer, availability: 123 }], [{ ...trainer, availability: 'a'.repeat(256) }],
    ...['email', 'password', 'passwordHash'].map((field) => [{ ...trainer, [field]: 'privado' }])]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(getTrainers(t.signal), /respuesta del servidor no es válida/);
  }
});

test('un error de red o una respuesta que no sea JSON no se presentan como lista vacía', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(getTrainers(t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin conexión'); });
  await assert.rejects(getTrainers(t.signal), /Revisá la conexión/);
});
