import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTrainingRoutine, updateTrainingRoutine, getTrainingRoutines, getTrainingRoutineFieldErrors } from '../src/plans/training-routines.ts';

const saved = { id: 5, programId: 4, name: 'Push / libre', description: null };

test('valida nombre obligatorio y descripción opcional con límites Unicode antes de enviar', async (t) => {
  for (const description of [undefined, null, '', '  ']) assert.deepEqual(getTrainingRoutineFieldErrors({ name: 'Push / libre', description }), {});
  assert.deepEqual(getTrainingRoutineFieldErrors({ name: '\u{10400}'.repeat(200), description: '\u{10400}'.repeat(5000) }), {});
  assert.ok(getTrainingRoutineFieldErrors({ name: ' ', description: '' }).name);
  assert.ok(getTrainingRoutineFieldErrors({ name: 'x'.repeat(201), description: 'x'.repeat(5001) }).description);
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debería enviar'); });
  await assert.rejects(createTrainingRoutine(1, 2, 4, { name: '' }, t.signal), /Revisá los datos/);
  for (const ids of [[0, 2, 4], [1, -1, 4], [1, 2, 4294967296]]) await assert.rejects(getTrainingRoutines(...ids, t.signal), /válidos/);
  for (const id of [0, undefined, -1, 4294967296]) await assert.rejects(updateTrainingRoutine(1, 2, 4, id, { name: saved.name }, t.signal), /rutina válida/);
  assert.equal(mock.mock.callCount(), 0);
});

test('consulta varias rutinas con la sesión y acepta una lista vacía', async (t) => {
  const list = [saved, { ...saved, id: 6, name: 'Otro nombre', description: 'Descripción libre' }];
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(list));
  assert.deepEqual(await getTrainingRoutines(1, 2, 4, t.signal), list);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/users/students/1/plans/2/programs/4/routines');
  assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'include');
  t.mock.method(globalThis, 'fetch', async () => Response.json([])); assert.deepEqual(await getTrainingRoutines(1, 2, 4, t.signal), []);
});

test('crear envía solo nombre y descripción y exige confirmar programa y datos normalizados', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(saved, { status: 201 }));
  assert.deepEqual(await createTrainingRoutine(1, 2, 4, { name: ' Push / libre ', description: '  ', programId: 99 }, t.signal), saved);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.ok(url.endsWith('/4/routines')); assert.equal(options.method, 'POST'); assert.equal(options.credentials, 'include');
  assert.deepEqual(JSON.parse(options.body), { name: ' Push / libre ', description: null });
  const withDescription = { ...saved, description: 'Texto\nlibre' };
  t.mock.method(globalThis, 'fetch', async () => Response.json(withDescription, { status: 201 }));
  assert.deepEqual(await createTrainingRoutine(1, 2, 4, { name: saved.name, description: ' Texto\nlibre ' }, t.signal), withDescription);
  for (const body of [{ ...saved, programId: 9 }, { ...saved, name: 'Otro' }, { ...saved, description: 'Otro' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body, { status: 201 }));
    await assert.rejects(createTrainingRoutine(1, 2, 4, { name: saved.name }, t.signal), /no es válida/);
  }
});

test('rechaza respuestas incompletas, de otro programa o con datos privados', async (t) => {
  for (const body of [null, {}, [{}], [{ ...saved, id: '5' }], [{ ...saved, programId: 9 }], [{ ...saved, name: '' }], [{ ...saved, description: false }], [{ ...saved, description: 'x'.repeat(5001) }], ...['email', 'passwordHash', 'trainerId', 'dayNumber'].map((field) => [{ ...saved, [field]: 1 }])]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body)); await assert.rejects(getTrainingRoutines(1, 2, 4, t.signal), /no es válida/);
  }
});

test('editar usa PUT sobre la rutina concreta y exige identidad, campos y estado HTTP correctos', async (t) => {
  const edited = { ...saved, name: 'Nombre editado', description: 'Texto editado' };
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(edited));
  assert.deepEqual(await updateTrainingRoutine(1, 2, 4, 5, { ...edited, name: ' Nombre editado ', programId: 99 }, t.signal), edited);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/users/students/1/plans/2/programs/4/routines/5');
  assert.equal(options.method, 'PUT'); assert.equal(options.credentials, 'include');
  assert.deepEqual(JSON.parse(options.body), { name: ' Nombre editado ', description: 'Texto editado' });
  for (const body of [{ ...edited, id: 9 }, { ...edited, programId: 9 }, { ...edited, name: 'Otro' }, { ...edited, description: null }, { ...edited, internal: true }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(updateTrainingRoutine(1, 2, 4, 5, edited, t.signal), /no es válida/);
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json(edited, { status: 201 }));
  await assert.rejects(updateTrainingRoutine(1, 2, 4, 5, edited, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin red'); });
  await assert.rejects(updateTrainingRoutine(1, 2, 4, 5, edited, t.signal), /No se pudo confirmar la modificación/);
});

test('distingue permisos y errores sin exponer detalles ni confirmar escrituras inciertas', async (t) => {
  for (const [status, message] of [[400, /Revisá/], [401, /sesión venció/], [403, /No tenés permiso/], [404, /ya no está disponible/], [500, /No se pudo completar/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status }));
    await assert.rejects(getTrainingRoutines(1, 2, 4, t.signal), (error) => error.status === status && message.test(error.message) && !error.message.includes('SQL'));
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML')); await assert.rejects(getTrainingRoutines(1, 2, 4, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => Response.json(saved)); await assert.rejects(createTrainingRoutine(1, 2, 4, { name: saved.name }, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin red'); });
  await assert.rejects(createTrainingRoutine(1, 2, 4, { name: saved.name }, t.signal), /No se pudo confirmar/);
  await assert.rejects(getTrainingRoutines(1, 2, 4, t.signal), /Revisá la conexión/);
});
