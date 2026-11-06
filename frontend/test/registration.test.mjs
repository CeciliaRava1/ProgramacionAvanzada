import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRegistrationFieldErrors, registerUser } from '../src/registration/register-user.ts';

const input = { firstName: 'Nombre', lastName: 'Apellido', email: 'alumno@example.test', password: 'Clave123' };
const created = { id: 1, firstName: 'Nombre', lastName: 'Apellido', email: input.email, role: 'student' };

test('valida campos obligatorios, límites y formato antes del envío', () => {
  assert.deepEqual(getRegistrationFieldErrors(input), {});
  assert.deepEqual(Object.keys(getRegistrationFieldErrors({ firstName: ' ', lastName: 'a'.repeat(101), email: 'incorrecto', password: 'corta' })), ['firstName', 'lastName', 'email', 'password']);
  assert.ok(getRegistrationFieldErrors({ ...input, email: 'a\0@example.test' }).email);
  assert.ok(getRegistrationFieldErrors({ ...input, password: 'a'.repeat(129) }).password);
});

test('la contraseña acepta ocho caracteres y rechaza espacios y límites inválidos', () => {
  for (const password of ['Clave123', 'ñ'.repeat(8), 'a'.repeat(128)]) {
    assert.equal(getRegistrationFieldErrors({ ...input, password }).password, undefined);
  }
  for (const password of ['Clave12', 'a'.repeat(129), ' Clave123', 'Clave123 ', 'Clave 123', 'Clave\t123', 'Clave\n123', 'Clave\u00a0123']) {
    assert.ok(getRegistrationFieldErrors({ ...input, password }).password);
  }
});

test('envía únicamente los campos aprobados y acepta una cuenta de alumno', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(created, { status: 201 }));
  await registerUser({ ...input, role: 'admin' }, t.signal);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/users/students');
  assert.equal(options.method, 'POST');
  assert.deepEqual(JSON.parse(options.body), input);
});

test('muestra el duplicado y los errores de validación asociados a campos', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 409 }));
  await assert.rejects(registerUser(input, t.signal), (error) => Boolean(error.fieldErrors.email));
  t.mock.method(globalThis, 'fetch', async () => Response.json({ fieldErrors: { email: 'Correo inválido.', role: 'No mostrar.' } }, { status: 400 }));
  await assert.rejects(registerUser(input, t.signal), (error) => {
    assert.deepEqual(error.fieldErrors, { email: 'Correo inválido.' });
    return true;
  });
});

test('un fallo del servidor no muestra sus detalles internos', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status: 500 }));
  await assert.rejects(registerUser(input, t.signal), (error) => !error.message.includes('SQL'));
});

test('rechaza respuestas de éxito incompletas o con credenciales', async (t) => {
  for (const body of [null, {}, { ...created, id: '1' }, { ...created, role: 'admin' }, { ...created, passwordHash: 'hash' }, { ...created, password: 'secreto' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body, { status: 201 }));
    await assert.rejects(registerUser(input, t.signal), /respuesta del servidor no es válida/);
  }
});

test('no confirma un registro si la respuesta no es JSON o hay un error de red', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML', { status: 201 }));
  await assert.rejects(registerUser(input, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin conexión'); });
  await assert.rejects(registerUser(input, t.signal), /No se pudo confirmar el registro/);
});

test('el alta de entrenadores envía la sesión y solo los campos acordados', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...created, role: 'trainer' }, { status: 201 }));
  await registerUser({ ...input, role: 'admin' }, t.signal, 'trainer');
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/users/trainers');
  assert.equal(options.credentials, 'include');
  assert.equal(options.method, 'POST');
  assert.deepEqual(JSON.parse(options.body), input);
});

test('distingue sesión vencida, falta de permisos y respuestas con otro rol', async (t) => {
  for (const [status, message] of [[401, /sesión venció/], [403, /No tenés permiso/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Detalles internos' }, { status }));
    await assert.rejects(registerUser(input, t.signal, 'trainer'), message);
  }
  for (const body of [created, { ...created, role: 'admin' }, { ...created, role: 'trainer', passwordHash: 'hash' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body, { status: 201 }));
    await assert.rejects(registerUser(input, t.signal, 'trainer'), /respuesta del servidor no es válida/);
  }
});

test('el horario es opcional y se envía únicamente al crear entrenadores', async (t) => {
  for (const availability of [undefined, '', ' ', 'Mañana y tarde', 'ñ'.repeat(255)]) {
    assert.equal(getRegistrationFieldErrors({ ...input, availability }).availability, undefined);
  }
  assert.ok(getRegistrationFieldErrors({ ...input, availability: 'a'.repeat(256) }).availability);
  const trainer = { ...created, role: 'trainer' };
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(trainer, { status: 201 }));
  await registerUser({ ...input, availability: 'Tarde' }, t.signal, 'trainer');
  assert.equal(JSON.parse(fetchMock.mock.calls[0].arguments[1].body).availability, 'Tarde');
  t.mock.method(globalThis, 'fetch', async () => Response.json(created, { status: 201 }));
  await registerUser({ ...input, availability: 'Tarde' }, t.signal, 'student');
  const lastRequest = globalThis.fetch.mock.calls[0].arguments[1];
  assert.equal('availability' in JSON.parse(lastRequest.body), false);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ fieldErrors: { availability: 'Horario inválido.' } }, { status: 400 }));
  await assert.rejects(registerUser(input, t.signal, 'trainer'), (error) => error.fieldErrors.availability === 'Horario inválido.');
});
