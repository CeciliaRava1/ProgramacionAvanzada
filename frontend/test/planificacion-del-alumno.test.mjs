import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consultarPlanificacion, consultarRutinaDelAlumno } from '../src/planes/planificacion-del-alumno.ts';

const plan = { id: 3, alumnoId: 2, nombre: 'Plan inicial', objetivo: 'Mejorar la fuerza.' };
const rutina = { id: 5, planId: 3, nombre: 'Día A', descripcion: null };
const ejercicio = { id: 6, nombre: 'Press de banca', parteDelCuerpo: 'Pecho', equipamiento: 'Barra', musculoObjetivo: 'Pectorales', instrucciones: 'Bajar la barra de forma controlada.' };
const elemento = { id: 7, rutinaId: 5, ejercicioId: 6, ejercicio, cantidadDeSeries: 3, repeticionesRecomendadas: 8, pesoRecomendadoKg: null, descansoEnSegundos: 90, rirRecomendado: 0 };
const planificacion = { plan, rutinas: [rutina] };

test('consulta únicamente la planificación propia con cookies, GET y sin enviar identidades ni cuerpo', async t => {
  const simulacro = t.mock.method(globalThis, 'fetch', async () => Response.json(planificacion));
  assert.deepEqual(await consultarPlanificacion(2, t.signal), planificacion);
  const [url, opciones] = simulacro.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/mi-planificacion');
  assert.equal(opciones.method, 'GET'); assert.equal(opciones.credentials, 'include');
  assert.equal(opciones.body, undefined); assert.equal(opciones.headers, undefined);
  for (const id of [0, -1, 1.5, NaN, '2', 4294967296]) await assert.rejects(consultarPlanificacion(id, t.signal));
  assert.equal(simulacro.mock.callCount(), 1);
});

test('sin plan y sin rutinas son resultados distintos y válidos', async t => {
  for (const valor of [{ plan: null, rutinas: [] }, { plan, rutinas: [] }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(valor));
    assert.deepEqual(await consultarPlanificacion(2, t.signal), valor);
  }
});

test('rechaza planificación incoherente, de otro alumno, con programas o con datos privados', async t => {
  for (const valor of [null, [], {}, { ...planificacion, hashDeContrasena: 'privado' }, { ...planificacion, programa: null },
    { ...planificacion, plan: { ...plan, alumnoId: 9 } }, { ...planificacion, plan: { ...plan, correo: 'privado' } },
    { ...planificacion, rutinas: [{ ...rutina, planId: 9 }] }, { ...planificacion, rutinas: [{ ...rutina, id: '5' }] },
    { ...planificacion, rutinas: null }, { plan: null, rutinas: [rutina] }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(valor));
    await assert.rejects(consultarPlanificacion(2, t.signal), /respuesta del servidor no es válida/);
  }
});

test('consulta una rutina propia sin escribir ni enviar identificadores de alumno o plan', async t => {
  const vista = { rutina, ejercicios: [elemento] };
  const simulacro = t.mock.method(globalThis, 'fetch', async () => Response.json(vista));
  assert.deepEqual(await consultarRutinaDelAlumno(5, 3, t.signal), vista);
  const [url, opciones] = simulacro.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/mi-planificacion/rutinas/5');
  assert.equal(opciones.method, 'GET'); assert.equal(opciones.credentials, 'include'); assert.equal(opciones.body, undefined);
  for (const [id, planId] of [[0, 3], [1.5, 3], [4294967296, 3], [5, -1]]) await assert.rejects(consultarRutinaDelAlumno(id, planId, t.signal), error => error.estado === 400);
  assert.equal(simulacro.mock.callCount(), 1);
});

test('conserva instrucciones, opcionales vacíos y cero y admite rutinas sin ejercicios', async t => {
  for (const valor of [null, 0, 15]) {
    const vista = { rutina, ejercicios: [{ ...elemento, pesoRecomendadoKg: valor, descansoEnSegundos: valor, rirRecomendado: valor }] };
    t.mock.method(globalThis, 'fetch', async () => Response.json(vista));
    assert.deepEqual(await consultarRutinaDelAlumno(5, 3, t.signal), vista);
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json({ rutina, ejercicios: [] }));
  assert.deepEqual(await consultarRutinaDelAlumno(5, 3, t.signal), { rutina, ejercicios: [] });
});

test('rechaza rutinas y ejercicios que no corresponden a la consulta y campos inesperados', async t => {
  for (const valor of [
    { rutina: { ...rutina, id: 8 }, ejercicios: [] }, { rutina: { ...rutina, planId: 9 }, ejercicios: [] }, { rutina, ejercicios: null },
    { rutina, ejercicios: [{ ...elemento, rutinaId: 8 }] }, { rutina, ejercicios: [{ ...elemento, ejercicioId: 9 }] },
    { rutina, ejercicios: [{ ...elemento, pesoRecomendadoKg: '0' }] }, { rutina, ejercicios: [{ ...elemento, rirRecomendado: undefined }] },
    { rutina, ejercicios: [{ ...elemento, ejercicio: { ...ejercicio, identificador: 'privado' } }] }, { rutina, ejercicios: [], alumnoId: 2 },
  ]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(valor));
    await assert.rejects(consultarRutinaDelAlumno(5, 3, t.signal), /respuesta del servidor no es válida/);
  }
});

test('distingue sesión vencida, permisos, rutina retirada y sesión no disponible sin mostrar detalles internos', async t => {
  for (const [estado, mensaje] of [[400, /rutina válida/], [401, /sesión venció/], [403, /permiso/], [404, /ya no está disponible/], [500, /Intentá nuevamente/], [503, /recuperar tu sesión/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales privadas' }, { status: estado }));
    await assert.rejects(consultarRutinaDelAlumno(5, 3, t.signal), error => error.estado === estado && mensaje.test(error.message) && !/SQL|credenciales/.test(error.message));
  }
});

test('un fallo de conexión o una respuesta inválida no se presenta como planificación vacía', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Red'); });
  await assert.rejects(consultarPlanificacion(2, t.signal), /conexión/);
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(consultarPlanificacion(2, t.signal), /respuesta del servidor no es válida/);
  t.mock.method(globalThis, 'fetch', async () => Response.json(planificacion, { status: 201 }));
  await assert.rejects(consultarPlanificacion(2, t.signal), /respuesta del servidor no es válida/);
});
