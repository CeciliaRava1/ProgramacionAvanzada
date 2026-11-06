import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getStudentPlanning, getStudentRoutine } from '../src/plans/student-planning.ts';

const plan = { id: 3, studentId: 2, name: 'Plan inicial', objective: 'Mejorar la fuerza.' };
const program = { id: 4, planId: 3, name: 'Fuerza y técnica', startDate: '2026-10-01', endDate: '2026-11-30' };
const routine = { id: 5, programId: 4, name: 'Día A', description: null };
const exercise = { id: 6, name: 'Bench press', bodyPart: 'chest', equipment: 'barbell', target: 'pectorals', instructions: 'Bajar la barra de forma controlada.' };
const entry = { id: 7, routineId: 5, exerciseId: 6, exercise, setCount: 3, recommendedRepetitions: 8, recommendedWeightKg: null, restSeconds: 90, recommendedRir: 0 };
const planning = { plan, program, routines: [routine] };

test('consulta únicamente la planificación propia con cookies, GET y sin enviar identidades ni cuerpo', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(planning));
  assert.deepEqual(await getStudentPlanning(2, t.signal), planning);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/users/me/planning');
  assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'include');
  assert.equal(options.body, undefined); assert.equal(options.headers, undefined);
  for (const id of [0, -1, 1.5, NaN, '2', 4294967296]) await assert.rejects(getStudentPlanning(id, t.signal));
  assert.equal(mock.mock.callCount(), 1);
});

test('sin plan, sin programa y sin rutinas son resultados distintos y válidos', async t => {
  for (const value of [{ plan: null, program: null, routines: [] }, { plan, program: null, routines: [] }, { plan, program, routines: [] }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(value));
    assert.deepEqual(await getStudentPlanning(2, t.signal), value);
  }
});

test('rechaza planificación incoherente, de otro alumno o con datos privados', async t => {
  for (const value of [null, [], {}, { ...planning, passwordHash: 'private' }, { ...planning, plan: { ...plan, studentId: 9 } }, { ...planning, plan: { ...plan, email: 'private' } }, { ...planning, program: { ...program, planId: 9 } }, { ...planning, program: { ...program, startDate: '2026-02-30' } }, { ...planning, routines: [{ ...routine, programId: 9 }] }, { ...planning, routines: [{ ...routine, id: '5' }] }, { ...planning, routines: null }, { plan: null, program, routines: [] }, { plan: null, program: null, routines: [routine] }, { plan, program: null, routines: [routine] }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(value));
    await assert.rejects(getStudentPlanning(2, t.signal), /respuesta del servidor no es válida/);
  }
});

test('consulta una rutina propia sin escribir ni enviar identificadores de alumno o programa', async t => {
  const view = { routine, exercises: [entry] };
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(view));
  assert.deepEqual(await getStudentRoutine(5, 4, t.signal), view);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/users/me/planning/routines/5');
  assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'include'); assert.equal(options.body, undefined);
  for (const [id, programId] of [[0, 4], [1.5, 4], [4294967296, 4], [5, -1]]) await assert.rejects(getStudentRoutine(id, programId, t.signal), error => error.status === 400);
  assert.equal(mock.mock.callCount(), 1);
});

test('conserva instrucciones, opcionales vacíos y cero y admite rutinas sin ejercicios', async t => {
  for (const value of [null, 0, 15]) {
    const view = { routine, exercises: [{ ...entry, recommendedWeightKg: value, restSeconds: value, recommendedRir: value }] };
    t.mock.method(globalThis, 'fetch', async () => Response.json(view));
    assert.deepEqual(await getStudentRoutine(5, 4, t.signal), view);
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json({ routine, exercises: [] }));
  assert.deepEqual(await getStudentRoutine(5, 4, t.signal), { routine, exercises: [] });
});

test('rechaza rutinas y ejercicios que no corresponden a la consulta y campos inesperados', async t => {
  for (const value of [{ routine: { ...routine, id: 8 }, exercises: [] }, { routine: { ...routine, programId: 9 }, exercises: [] }, { routine, exercises: null }, { routine, exercises: [{ ...entry, routineId: 8 }] }, { routine, exercises: [{ ...entry, exerciseId: 9 }] }, { routine, exercises: [{ ...entry, recommendedWeightKg: '0' }] }, { routine, exercises: [{ ...entry, recommendedRir: undefined }] }, { routine, exercises: [{ ...entry, exercise: { ...exercise, source: 'private' } }] }, { routine, exercises: [], studentId: 2 }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(value));
    await assert.rejects(getStudentRoutine(5, 4, t.signal), /respuesta del servidor no es válida/);
  }
});

test('distingue sesión vencida, permisos, rutina retirada y sesión no disponible sin mostrar detalles internos', async t => {
  for (const [status, message] of [[400, /rutina válida/], [401, /sesión venció/], [403, /permiso/], [404, /ya no está disponible/], [500, /Intentá nuevamente/], [503, /recuperar tu sesión/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales privadas' }, { status }));
    await assert.rejects(getStudentRoutine(5, 4, t.signal), error => error.status === status && message.test(error.message) && !/SQL|credenciales/.test(error.message));
  }
});

test('un fallo de conexión o una respuesta inválida no se presenta como planificación vacía', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Red'); });
  await assert.rejects(getStudentPlanning(2, t.signal), /conexión/);
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(getStudentPlanning(2, t.signal), /respuesta del servidor no es válida/);
  t.mock.method(globalThis, 'fetch', async () => Response.json(planning, { status: 201 }));
  await assert.rejects(getStudentPlanning(2, t.signal), /respuesta del servidor no es válida/);
});
