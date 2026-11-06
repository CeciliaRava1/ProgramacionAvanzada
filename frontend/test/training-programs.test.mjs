import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTrainingProgram, getTrainingPrograms, getTrainingProgramFieldErrors, parseProgramDate, formatProgramDate } from '../src/plans/training-programs.ts';

const input = { name: 'Programa 1', startDate: '2026-05-11', endDate: '2026-06-05' };
const saved = { id: 4, planId: 2, ...input };

test('las fechas del formulario se interpretan como día, mes y año sin depender del idioma del navegador', () => {
  for (const [text, iso] of [['27/10/2026', '2026-10-27'], ['05/11/2026', '2026-11-05'], [' 29/02/2024 ', '2024-02-29'], ['27102026', '2026-10-27'], ['01/01/1000', '1000-01-01'], ['31/12/9999', '9999-12-31']]) {
    assert.equal(parseProgramDate(text), iso);
    assert.equal(parseProgramDate(formatProgramDate(iso)), iso);
  }
  assert.equal(formatProgramDate('2026-10-27'), '27/10/2026');
  assert.equal(formatProgramDate('2026-11-05'), '05/11/2026');
  for (const value of ['', '10/27/2026', '29/02/2026', '31/04/2026', '00/10/2026', '27/00/2026', '27/13/2026', '27/10/0000', '2026-10-27', '27/10/26', '27/10/2026extra', '2710202']) assert.equal(parseProgramDate(value), '');
  for (const value of ['', '2026-02-29', '2026-04-31', '27/10/2026']) assert.equal(formatProgramDate(value), '');
  assert.equal(getTrainingProgramFieldErrors({ ...input, startDate: parseProgramDate('05/11/2026'), endDate: parseProgramDate('04/11/2026') }).endDate, 'La fecha de fin no puede ser anterior a la de inicio.');
});

test('valida nombre, calendario y orden de fechas antes de enviar, sin imponer duración', async (t) => {
  for (const [startDate, endDate] of [['2024-02-29', '2024-02-29'], ['1000-01-01', '9999-12-31']]) assert.deepEqual(getTrainingProgramFieldErrors({ ...input, startDate, endDate }), {});
  assert.deepEqual(getTrainingProgramFieldErrors({ ...input, name: '\u{10400}'.repeat(200) }), {});
  for (const [field, value] of [['name', ' '], ['name', 'x'.repeat(201)], ['startDate', '2026-02-29'], ['startDate', '2026-04-31'], ['startDate', '11/05/2026'], ['startDate', '2026-5-11'], ['startDate', '0000-01-01'], ['endDate', ''], ['endDate', '2026-05-10'], ['endDate', '2026-06-05T00:00:00Z']]) assert.ok(getTrainingProgramFieldErrors({ ...input, [field]: value })[field]);
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debería enviar'); });
  await assert.rejects(createTrainingProgram(1, 2, { ...input, endDate: '' }, t.signal), /Revisá los datos/);
  for (const [studentId, planId] of [[0, 2], [1, -1], [1, 4294967296]]) await assert.rejects(getTrainingPrograms(studentId, planId, t.signal), /válidos/);
  assert.equal(mock.mock.callCount(), 0);
});

test('consulta el programa del plan con la sesión y distingue la ausencia de un error', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json([saved]));
  assert.deepEqual(await getTrainingPrograms(1, 2, t.signal), [saved]);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/users/students/1/plans/2/programs');
  assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'include');
  t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.deepEqual(await getTrainingPrograms(1, 2, t.signal), []);
});

test('crear envía únicamente nombre y fechas y exige confirmar el plan y los datos enviados', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(saved, { status: 201 }));
  assert.deepEqual(await createTrainingProgram(1, 2, { ...input, name: ' Programa 1 ', planId: 99, active: true }, t.signal), saved);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.ok(url.endsWith('/1/plans/2/programs')); assert.equal(options.method, 'POST'); assert.equal(options.credentials, 'include');
  assert.deepEqual(JSON.parse(options.body), { ...input, name: ' Programa 1 ' });
  for (const body of [{ ...saved, planId: 3 }, { ...saved, name: 'Otro' }, { ...saved, startDate: '2026-05-12' }, { ...saved, endDate: '2026-06-06' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body, { status: 201 }));
    await assert.rejects(createTrainingProgram(1, 2, input, t.signal), /no es válida/);
  }
});

test('rechaza respuestas incompletas, varios programas, fechas inválidas y datos privados', async (t) => {
  for (const body of [null, {}, [{}], [saved, { ...saved, id: 5 }], [{ ...saved, id: '4' }], [{ ...saved, planId: 3 }], [{ ...saved, name: '' }], [{ ...saved, endDate: '2026-02-30' }], ...['email', 'passwordHash', 'trainerId', 'active'].map((field) => [{ ...saved, [field]: 'privado' }])]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(getTrainingPrograms(1, 2, t.signal), /no es válida/);
  }
});

test('distingue permisos y conflictos sin filtrar errores internos ni confirmar resultados inciertos', async (t) => {
  for (const [status, message] of [[400, /Revisá/], [401, /sesión venció/], [403, /No tenés permiso/], [404, /ya no está disponible/], [409, /ya tiene un programa/], [500, /No se pudo completar/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status }));
    await assert.rejects(getTrainingPrograms(1, 2, t.signal), (error) => error.status === status && message.test(error.message) && !error.message.includes('SQL'));
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(getTrainingPrograms(1, 2, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => Response.json(saved));
  await assert.rejects(createTrainingProgram(1, 2, input, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => Response.json([saved], { status: 201 }));
  await assert.rejects(getTrainingPrograms(1, 2, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin red'); });
  await assert.rejects(createTrainingProgram(1, 2, input, t.signal), /No se pudo confirmar/);
  await assert.rejects(getTrainingPrograms(1, 2, t.signal), /Revisá la conexión/);
});
