import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAssignedStudents } from '../src/trainers/assigned-students.ts';

const student = { id: 1, firstName: 'Alumno', lastName: 'Prueba' };

test('consulta alumnos con la sesión sin enviar una identidad de entrenador elegida en la pantalla', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json([student]));
  assert.deepEqual(await getAssignedStudents(t.signal), [student]);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/users/students');
  assert.equal(options.credentials, 'include');
  assert.equal(options.body, undefined);
  assert.ok(options.signal instanceof AbortSignal);
});

test('una lista vacía de alumnos es un resultado válido', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.deepEqual(await getAssignedStudents(t.signal), []);
});

test('distingue sesión vencida, falta de permisos y fallos sin exponer mensajes internos', async (t) => {
  for (const [status, message] of [[401, /sesión venció/], [403, /No tenés permiso/], [500, /No se pudo consultar/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status }));
    await assert.rejects(getAssignedStudents(t.signal), (error) => message.test(error.message) && !error.message.includes('SQL'));
  }
});

test('rechaza respuestas incompletas, tipos incorrectos y datos privados', async (t) => {
  for (const body of [null, {}, [null], [{}], [{ ...student, id: '1' }], [{ ...student, id: 0 }], [{ ...student, id: 4_294_967_296 }],
    [{ ...student, firstName: ' ' }], [{ ...student, lastName: 2 }], [{ ...student, firstName: 'a'.repeat(101) }],
    ...['email', 'password', 'passwordHash', 'role'].map((field) => [{ ...student, [field]: 'privado' }])]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(getAssignedStudents(t.signal), /respuesta del servidor no es válida/);
  }
});

test('un error de red o de formato no se confunde con ausencia de alumnos', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(getAssignedStudents(t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => Response.json([student], { status: 201 }));
  await assert.rejects(getAssignedStudents(t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin conexión'); });
  await assert.rejects(getAssignedStudents(t.signal), /Revisá la conexión/);
});
