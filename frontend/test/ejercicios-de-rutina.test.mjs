import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRestTime, parseRestTime, getRoutineExerciseFieldErrors, getRoutineExercises, searchExercises, saveRoutineExercise, routineExerciseSummary } from '../src/plans/routine-exercises.ts';

const context = { studentId: 1, planId: 2, programId: 3, routineId: 4 };
const exercise = { id: 6, name: 'Press', bodyPart: 'chest', equipment: 'barbell', target: 'pectorals', instructions: 'Instrucciones.' };
const input = { setCount: 3, recommendedRepetitions: 8, recommendedWeightKg: 12.5, restSeconds: 90 };
const saved = { id: 5, routineId: 4, exerciseId: 6, exercise, ...input, recommendedRir: null };

test('valida cantidades y decimales y muestra series × repeticiones · peso', async t => {
  assert.deepEqual(getRoutineExerciseFieldErrors(input), {});
  assert.equal(routineExerciseSummary(input), '3 × 8 · 12,5 kg');
  assert.equal(routineExerciseSummary({ ...input, recommendedRir: 0 }), '3 × 8 · 12,5 kg');
  for (const [field, values] of [['setCount', [0, 65536, 1.5]], ['recommendedRepetitions', [0, NaN]], ['recommendedWeightKg', [-1, 12.345, 0.000000001, Infinity]], ['restSeconds', [-1, 0.5]], ['recommendedRir', [-1, 1.5, 65536, NaN, '2']]]) for (const value of values) assert.ok(getRoutineExerciseFieldErrors({ ...input, [field]: value })[field]);
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debe consultar'); });
  await assert.rejects(saveRoutineExercise(context, 6, { ...input, setCount: 0 }, t.signal));
  await assert.rejects(getRoutineExercises({ ...context, routineId: 0 }, t.signal));
  await assert.rejects(searchExercises({ q: '', bodyPart: '', equipment: '', offset: -1 }, t.signal));
  assert.equal(mock.mock.callCount(), 0);
});

test('convierte minutos y segundos sin aceptar tiempos ambiguos ni segundos fuera de rango', () => {
  for (const seconds of [0, 15, 59, 60, 75, 90, 125, 65535]) assert.equal(parseRestTime(formatRestTime(seconds)), seconds);
  assert.equal(parseRestTime(' 1:30 '), 90);
  for (const value of ['', '90', '1:3', '1:60', '-1:30', '1.5:00', '1:30:00', 'Infinity:00', '999999999999999999:00']) assert.ok(Number.isNaN(parseRestTime(value)));
  assert.ok(getRoutineExerciseFieldErrors({ ...input, restSeconds: parseRestTime('1092:16') }).restSeconds);
});

test('peso y descanso vacíos conservan null y cero sigue siendo un valor explícito', async t => {
  for (const value of [null, 0, 15]) {
    const details = { ...input, recommendedWeightKg: value, restSeconds: value, recommendedRir: value };
    assert.deepEqual(getRoutineExerciseFieldErrors(details), {});
    const result = { ...saved, ...details };
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(result));
    assert.deepEqual(await saveRoutineExercise(context, 6, details, t.signal, 5), result);
    assert.deepEqual(JSON.parse(mock.mock.calls[0].arguments[1].body), details);
    t.mock.method(globalThis, 'fetch', async () => Response.json([result]));
    assert.deepEqual(await getRoutineExercises(context, t.signal), [result]);
  }
  assert.equal(routineExerciseSummary({ ...input, recommendedWeightKg: null }), '3 × 8');
  assert.equal(routineExerciseSummary({ ...input, recommendedWeightKg: 0 }), '3 × 8 · 0 kg');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...saved, recommendedWeightKg: 0, restSeconds: 0 }));
  await assert.rejects(saveRoutineExercise(context, 6, { ...input, recommendedWeightKg: null, restSeconds: null }, t.signal, 5), error => error.uncertain);
});

test('series y repeticiones explican el valor inválido sin exponer límites de almacenamiento', () => {
  for (const field of ['setCount', 'recommendedRepetitions']) {
    for (const value of [NaN, 0, -1, 1.5]) assert.equal(getRoutineExerciseFieldErrors({ ...input, [field]: value })[field], 'Ingresá una cantidad entera mayor que cero.');
    assert.ok(getRoutineExerciseFieldErrors({ ...input, [field]: 65536 })[field]);
  }
  assert.doesNotMatch(JSON.stringify(getRoutineExerciseFieldErrors({ setCount: 65536, recommendedRepetitions: 0, recommendedWeightKg: -1, restSeconds: -1, recommendedRir: -1 })), /65535|999999/);
});

test('RIR opcional distingue vacío, cero y valor informado al guardar y consultar', async t => {
  for (const recommendedRir of [null, 0, 3]) {
    const details = { ...input, recommendedRir };
    assert.deepEqual(getRoutineExerciseFieldErrors(details), {});
    const result = { ...saved, recommendedRir };
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(result));
    assert.deepEqual(await saveRoutineExercise(context, 6, details, t.signal, 5), result);
    assert.deepEqual(JSON.parse(mock.mock.calls[0].arguments[1].body), details);
    t.mock.method(globalThis, 'fetch', async () => Response.json([result]));
    assert.deepEqual(await getRoutineExercises(context, t.signal), [result]);
  }
  for (const recommendedRir of ['2', -1, 1.5, undefined]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json([{ ...saved, recommendedRir }]));
    await assert.rejects(getRoutineExercises(context, t.signal), /no es válida/);
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...saved, recommendedRir: 2 }));
  await assert.rejects(saveRoutineExercise(context, 6, { ...input, recommendedRir: null }, t.signal, 5), error => error.uncertain);
});

test('consulta catálogo paginado y ejercicios con la sesión sin aceptar datos extras', async t => {
  const page = { items: [exercise], total: 1, bodyParts: ['chest'], equipment: ['barbell'] };
  let mock = t.mock.method(globalThis, 'fetch', async () => Response.json(page));
  assert.deepEqual(await searchExercises({ q: 'press', bodyPart: '', equipment: '', offset: 0 }, t.signal), page);
  assert.ok(mock.mock.calls[0].arguments[0].includes('exercises?q=press'));
  assert.equal(mock.mock.calls[0].arguments[1].credentials, 'include');
  t.mock.method(globalThis, 'fetch', async () => Response.json([saved])); assert.deepEqual(await getRoutineExercises(context, t.signal), [saved]);
  for (const value of [[{ ...saved, routineId: 8 }], [{ ...saved, exerciseId: 9 }], [{ ...saved, recommendedWeightKg: '12.5' }], [{ ...saved, exercise: { ...exercise, source: 'internal' } }]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(value)); await assert.rejects(getRoutineExercises(context, t.signal), /no es válida/);
  }
  for (const value of [{ ...page, items: [{ ...exercise, id: '6' }] }, { ...page, total: -1 }, { ...page, bodyParts: [1] }, { ...page, private: true }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(value)); await assert.rejects(searchExercises({ q: '', bodyPart: '', equipment: '', offset: 0 }, t.signal), /no es válida/);
  }
});

test('crear y editar envían solo indicaciones permitidas y verifican identidad y resultado', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(saved, { status: 201 }));
  assert.deepEqual(await saveRoutineExercise(context, 6, { ...input, trainerId: 8 }, t.signal), saved);
  assert.deepEqual(JSON.parse(mock.mock.calls[0].arguments[1].body), { exerciseId: 6, ...input });
  t.mock.method(globalThis, 'fetch', async (...args) => { assert.ok(args[0].endsWith('/exercises/5')); assert.equal(args[1].method, 'PUT'); assert.deepEqual(JSON.parse(args[1].body), input); return Response.json(saved); });
  assert.deepEqual(await saveRoutineExercise(context, 6, input, t.signal, 5), saved);
  for (const value of [{ ...saved, id: 9 }, { ...saved, exerciseId: 9 }, { ...saved, setCount: 4 }, { ...saved, routineId: 8 }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(value)); await assert.rejects(saveRoutineExercise(context, 6, input, t.signal, 5), error => error.uncertain && /no es válida/.test(error.message));
  }
});

test('no confirma escrituras ante fallos de red o respuesta y distingue los permisos', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Red'); });
  await assert.rejects(saveRoutineExercise(context, 6, input, t.signal), error => error.uncertain && /No se pudo confirmar/.test(error.message));
  for (const [status, text] of [[400, /Revisá/], [401, /sesión/], [403, /permiso/], [404, /disponible/], [500, /operación/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL privado' }, { status }));
    await assert.rejects(getRoutineExercises(context, t.signal), error => error.status === status && text.test(error.message) && !error.message.includes('SQL'));
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(saveRoutineExercise(context, 6, input, t.signal), error => error.uncertain);
});
