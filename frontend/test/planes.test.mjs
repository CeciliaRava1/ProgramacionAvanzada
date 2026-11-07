import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTrainingPlans, createTrainingPlan, updateTrainingPlan, deleteTrainingPlan, getTrainingPlanFieldErrors } from '../src/plans/training-plans.ts';

const plan = { id: 4, studentId: 2, name: 'PLAN DE FUERZA', objective: 'Salud' };

test('valida campos y límites incluyendo caracteres Unicode antes de enviar', async (t) => {
  assert.deepEqual(getTrainingPlanFieldErrors({ name: ' ', objective: '' }), { name: 'Ingresá entre 1 y 200 caracteres.', objective: 'Ingresá entre 1 y 5000 caracteres.' });
  assert.deepEqual(getTrainingPlanFieldErrors({ name: '\u{10400}'.repeat(200), objective: 'x'.repeat(5000) }), {});
  assert.ok(getTrainingPlanFieldErrors({ name: 'x'.repeat(201), objective: 'x'.repeat(5001) }).name);
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debería enviar'); });
  await assert.rejects(createTrainingPlan(2, { name: '', objective: 'Salud' }, t.signal), /Revisá los datos/);
  await assert.rejects(getTrainingPlans(0, t.signal), /alumno válido/);
  await assert.rejects(updateTrainingPlan(2, 0, plan, t.signal), /plan válido/);
  await assert.rejects(deleteTrainingPlan(2, -1, t.signal), /plan válido/);
  assert.equal(mock.mock.callCount(), 0);
});

test('consulta planes con cookies y distingue una lista vacía', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json([plan]));
  assert.deepEqual(await getTrainingPlans(2, t.signal), [plan]);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/users/students/2/plans');
  assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'include');
  t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.deepEqual(await getTrainingPlans(2, t.signal), []);
});

test('crear envía únicamente nombre y objetivo y exige la confirmación del alumno seleccionado', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(plan, { status: 201 }));
  assert.deepEqual(await createTrainingPlan(2, { name: ' PLAN DE FUERZA ', objective: ' Salud ', trainerId: 8 }, t.signal), plan);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.ok(url.endsWith('/2/plans')); assert.equal(options.credentials, 'include'); assert.equal(options.method, 'POST');
  assert.deepEqual(JSON.parse(options.body), { name: ' PLAN DE FUERZA ', objective: ' Salud ' });
  for (const body of [{ ...plan, studentId: 3 }, { ...plan, name: 'Otro' }, { ...plan, objective: 'Otro' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body, { status: 201 }));
    await assert.rejects(createTrainingPlan(2, plan, t.signal), /no es válida/);
  }
});

test('rechaza respuestas incompletas, planes de otro alumno y datos privados', async (t) => {
  for (const body of [null, {}, [{}], [plan, { ...plan, id: 5 }], [{ ...plan, id: '4' }], [{ ...plan, studentId: 3 }], [{ ...plan, name: '' }], [{ ...plan, objective: 'x'.repeat(5001) }],
    ...['email', 'passwordHash', 'trainerId'].map(field => [{ ...plan, [field]: 'privado' }])]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(getTrainingPlans(2, t.signal), /respuesta del servidor no es válida/);
  }
});

test('los errores no muestran detalles internos ni confirman escrituras de resultado incierto', async (t) => {
  for (const [status, expected] of [[400, /Revisá/], [401, /sesión venció/], [403, /No tenés permiso/], [404, /ya no está disponible/], [409, /ya tiene un plan/], [500, /No se pudo completar/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status }));
    await assert.rejects(getTrainingPlans(2, t.signal), (error) => error.status === status && expected.test(error.message) && !error.message.includes('SQL'));
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(getTrainingPlans(2, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => Response.json(plan));
  await assert.rejects(createTrainingPlan(2, plan, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin red'); });
  await assert.rejects(createTrainingPlan(2, plan, t.signal), /No se pudo confirmar la creación/);
  await assert.rejects(getTrainingPlans(2, t.signal), /Revisá la conexión/);
});

test('editar conserva el alumno y el identificador, envía solo los datos permitidos y exige 200', async (t) => {
  const edited = { ...plan, name: 'Plan editado' };
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(edited));
  assert.deepEqual(await updateTrainingPlan(2, 4, { ...edited, name: ' Plan editado ', deletedAt: null }, t.signal), edited);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/users/students/2/plans/4');
  assert.equal(options.method, 'PUT'); assert.equal(options.credentials, 'include');
  assert.deepEqual(JSON.parse(options.body), { name: ' Plan editado ', objective: 'Salud' });
  for (const body of [{ ...edited, id: 5 }, { ...edited, studentId: 3 }, { ...edited, deletedAt: null }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(updateTrainingPlan(2, 4, edited, t.signal), /no es válida/);
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json(edited, { status: 201 }));
  await assert.rejects(updateTrainingPlan(2, 4, edited, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin red'); });
  await assert.rejects(updateTrainingPlan(2, 4, edited, t.signal), /No se pudo confirmar la modificación/);
});

test('eliminar usa el identificador concreto y solo confirma con 204', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await deleteTrainingPlan(2, 4, t.signal), undefined);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.ok(url.endsWith('/2/plans/4')); assert.equal(options.method, 'DELETE'); assert.equal(options.credentials, 'include'); assert.equal(options.body, undefined);
  t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await assert.rejects(deleteTrainingPlan(2, 4, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL' }, { status: 404 }));
  await assert.rejects(deleteTrainingPlan(2, 4, t.signal), (error) => error.status === 404 && !error.message.includes('SQL'));
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin red'); });
  await assert.rejects(deleteTrainingPlan(2, 4, t.signal), /No se pudo confirmar la eliminación/);
});
