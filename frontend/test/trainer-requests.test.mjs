import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getStudentTrainerState, getReceivedTrainerRequests, sendTrainerRequest, respondTrainerRequest } from '../src/trainers/trainer-requests.ts';

const trainer = { id: 2, firstName: 'Entrenador', lastName: 'Prueba', availability: null };

test('interpreta los estados sin entrenador, pendiente y asignado enviando la sesión', async (t) => {
  for (const state of [{ status: 'unassigned' }, { status: 'pending', requestId: 3, trainer }, { status: 'assigned', trainer }]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(state));
    assert.deepEqual(await getStudentTrainerState(t.signal), state);
    const [url, options] = mock.mock.calls[0].arguments;
    assert.equal(url, 'http://127.0.0.1:3000/users/trainer-requests/current');
    assert.equal(options.credentials, 'include');
  }
});

test('la bandeja acepta solo identificador y datos públicos del alumno', async (t) => {
  const expected = [{ id: 4, student: { id: 1, firstName: 'Alumno', lastName: 'Prueba' } }];
  t.mock.method(globalThis, 'fetch', async () => Response.json(expected));
  assert.deepEqual(await getReceivedTrainerRequests(t.signal), expected);
  for (const body of [null, [{}], [{ ...expected[0], email: 'privado' }], [{ id: 4, student: { ...expected[0].student, passwordHash: 'hash' } }]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(getReceivedTrainerRequests(t.signal), /respuesta del servidor no es válida/);
  }
});

test('el envío no permite elegir alumno ni estado y comprueba al entrenador de la confirmación', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 3, trainerId: 2, status: 'pending' }, { status: 201 }));
  await sendTrainerRequest(2, t.signal);
  assert.deepEqual(JSON.parse(mock.mock.calls[0].arguments[1].body), { trainerId: 2 });
  assert.equal(mock.mock.calls[0].arguments[1].credentials, 'include');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 3, trainerId: 9, status: 'pending' }, { status: 201 }));
  await assert.rejects(sendTrainerRequest(2, t.signal), /respuesta del servidor no es válida/);
});

test('aceptar, rechazar y cancelar usan el método y endpoint correspondientes y exigen 204', async (t) => {
  for (const [action, method, suffix] of [['accept', 'POST', '/3/accept'], ['reject', 'POST', '/3/reject'], ['cancel', 'DELETE', '/3']]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
    await respondTrainerRequest(3, action, t.signal);
    const [url, options] = mock.mock.calls[0].arguments;
    assert.ok(url.endsWith(suffix));assert.equal(options.method, method);assert.equal(options.credentials, 'include');
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await assert.rejects(respondTrainerRequest(3, 'accept', t.signal), /respuesta del servidor no es válida/);
});

test('rechaza estados desconocidos, datos privados y respuestas incompletas', async (t) => {
  for (const body of [{ status: 'unknown' }, { status: 'pending', trainer }, { status: 'pending', requestId: '3', trainer },
    { status: 'assigned', trainer: { ...trainer, email: 'privado' } }, { status: 'unassigned', trainer }, { status: 'assigned' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(getStudentTrainerState(t.signal), /respuesta del servidor no es válida/);
  }
});

test('los errores no exponen mensajes internos ni confirman operaciones de resultado incierto', async (t) => {
  for (const status of [400, 401, 403, 404, 409, 500]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status }));
    await assert.rejects(sendTrainerRequest(2, t.signal), (error) => error.status === status && !error.message.includes('SQL'));
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(getStudentTrainerState(t.signal), /respuesta del servidor no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin red'); });
  await assert.rejects(respondTrainerRequest(3, 'cancel', t.signal), /No se pudo confirmar/);
});
