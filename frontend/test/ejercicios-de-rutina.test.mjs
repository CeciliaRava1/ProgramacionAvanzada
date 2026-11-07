import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatearTiempoDeDescanso, interpretarTiempoDeDescanso, obtenerErroresDeEjercicioDeRutina, consultarEjerciciosDeRutina, buscarEjercicios, guardarEjercicioDeRutina, resumenDeEjercicioDeRutina } from '../src/planes/ejercicios-de-rutina.ts';

const context = { alumnoId: 1, planId: 2, rutinaId: 4 };
const ejercicio = { id: 6, nombre: 'Press', parteDelCuerpo: 'pecho', equipamiento: 'barra', musculoObjetivo: 'pectorales', instrucciones: 'Instrucciones.' };
const input = { cantidadDeSeries: 3, repeticionesRecomendadas: 8, pesoRecomendadoKg: 12.5, descansoEnSegundos: 90 };
const saved = { id: 5, rutinaId: 4, ejercicioId: 6, ejercicio, ...input, rirRecomendado: null };

test('valida cantidades y decimales y muestra series × repeticiones · peso', async t => {
  assert.deepEqual(obtenerErroresDeEjercicioDeRutina(input), {});
  assert.equal(resumenDeEjercicioDeRutina(input), '3 × 8 · 12,5 kg');
  assert.equal(resumenDeEjercicioDeRutina({ ...input, rirRecomendado: 0 }), '3 × 8 · 12,5 kg');
  for (const [field, values] of [['cantidadDeSeries', [0, 65536, 1.5]], ['repeticionesRecomendadas', [0, NaN]], ['pesoRecomendadoKg', [-1, 12.345, 0.000000001, Infinity]], ['descansoEnSegundos', [-1, 0.5]], ['rirRecomendado', [-1, 1.5, 65536, NaN, '2']]]) for (const value of values) assert.ok(obtenerErroresDeEjercicioDeRutina({ ...input, [field]: value })[field]);
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debe consultar'); });
  await assert.rejects(guardarEjercicioDeRutina(context, 6, { ...input, cantidadDeSeries: 0 }, t.signal));
  await assert.rejects(consultarEjerciciosDeRutina({ ...context, rutinaId: 0 }, t.signal));
  await assert.rejects(buscarEjercicios({ q: '', parteDelCuerpo: '', equipamiento: '', desde: -1 }, t.signal));
  assert.equal(mock.mock.callCount(), 0);
});

test('convierte minutos y segundos sin aceptar tiempos ambiguos ni segundos fuera de rango', () => {
  for (const seconds of [0, 15, 59, 60, 75, 90, 125, 65535]) assert.equal(interpretarTiempoDeDescanso(formatearTiempoDeDescanso(seconds)), seconds);
  assert.equal(interpretarTiempoDeDescanso(' 1:30 '), 90);
  for (const value of ['', '90', '1:3', '1:60', '-1:30', '1.5:00', '1:30:00', 'Infinity:00', '999999999999999999:00']) assert.ok(Number.isNaN(interpretarTiempoDeDescanso(value)));
  assert.ok(obtenerErroresDeEjercicioDeRutina({ ...input, descansoEnSegundos: interpretarTiempoDeDescanso('1092:16') }).descansoEnSegundos);
});

test('peso y descanso vacíos conservan null y cero sigue siendo un valor explícito', async t => {
  for (const value of [null, 0, 15]) {
    const details = { ...input, pesoRecomendadoKg: value, descansoEnSegundos: value, rirRecomendado: value };
    assert.deepEqual(obtenerErroresDeEjercicioDeRutina(details), {});
    const result = { ...saved, ...details };
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(result));
    assert.deepEqual(await guardarEjercicioDeRutina(context, 6, details, t.signal, 5), result);
    assert.deepEqual(JSON.parse(mock.mock.calls[0].arguments[1].body), details);
    t.mock.method(globalThis, 'fetch', async () => Response.json([result]));
    assert.deepEqual(await consultarEjerciciosDeRutina(context, t.signal), [result]);
  }
  assert.equal(resumenDeEjercicioDeRutina({ ...input, pesoRecomendadoKg: null }), '3 × 8');
  assert.equal(resumenDeEjercicioDeRutina({ ...input, pesoRecomendadoKg: 0 }), '3 × 8 · 0 kg');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...saved, pesoRecomendadoKg: 0, descansoEnSegundos: 0 }));
  await assert.rejects(guardarEjercicioDeRutina(context, 6, { ...input, pesoRecomendadoKg: null, descansoEnSegundos: null }, t.signal, 5), error => error.incierto);
});

test('series y repeticiones explican el valor inválido sin exponer límites de almacenamiento', () => {
  for (const field of ['cantidadDeSeries', 'repeticionesRecomendadas']) {
    for (const value of [NaN, 0, -1, 1.5]) assert.equal(obtenerErroresDeEjercicioDeRutina({ ...input, [field]: value })[field], 'Ingresá una cantidad entera mayor que cero.');
    assert.ok(obtenerErroresDeEjercicioDeRutina({ ...input, [field]: 65536 })[field]);
  }
  assert.doesNotMatch(JSON.stringify(obtenerErroresDeEjercicioDeRutina({ cantidadDeSeries: 65536, repeticionesRecomendadas: 0, pesoRecomendadoKg: -1, descansoEnSegundos: -1, rirRecomendado: -1 })), /65535|999999/);
});

test('RIR opcional distingue vacío, cero y valor informado al guardar y consultar', async t => {
  for (const rirRecomendado of [null, 0, 3]) {
    const details = { ...input, rirRecomendado };
    assert.deepEqual(obtenerErroresDeEjercicioDeRutina(details), {});
    const result = { ...saved, rirRecomendado };
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(result));
    assert.deepEqual(await guardarEjercicioDeRutina(context, 6, details, t.signal, 5), result);
    assert.deepEqual(JSON.parse(mock.mock.calls[0].arguments[1].body), details);
    t.mock.method(globalThis, 'fetch', async () => Response.json([result]));
    assert.deepEqual(await consultarEjerciciosDeRutina(context, t.signal), [result]);
  }
  for (const rirRecomendado of ['2', -1, 1.5, undefined]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json([{ ...saved, rirRecomendado }]));
    await assert.rejects(consultarEjerciciosDeRutina(context, t.signal), /no es válida/);
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...saved, rirRecomendado: 2 }));
  await assert.rejects(guardarEjercicioDeRutina(context, 6, { ...input, rirRecomendado: null }, t.signal, 5), error => error.incierto);
});

test('consulta catálogo paginado y ejercicios con la sesión sin aceptar datos extras', async t => {
  const page = { elementos: [ejercicio], total: 1, partesDelCuerpo: ['pecho'], equipamientos: ['barra'] };
  let mock = t.mock.method(globalThis, 'fetch', async () => Response.json(page));
  assert.deepEqual(await buscarEjercicios({ q: 'press', parteDelCuerpo: '', equipamiento: '', desde: 0 }, t.signal), page);
  assert.ok(mock.mock.calls[0].arguments[0].includes('ejercicios?q=press'));
  assert.equal(mock.mock.calls[0].arguments[1].credentials, 'include');
  t.mock.method(globalThis, 'fetch', async () => Response.json([saved])); assert.deepEqual(await consultarEjerciciosDeRutina(context, t.signal), [saved]);
  for (const value of [[{ ...saved, rutinaId: 8 }], [{ ...saved, ejercicioId: 9 }], [{ ...saved, pesoRecomendadoKg: '12.5' }], [{ ...saved, ejercicio: { ...ejercicio, fuente: 'interna' } }]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(value)); await assert.rejects(consultarEjerciciosDeRutina(context, t.signal), /no es válida/);
  }
  for (const value of [{ ...page, elementos: [{ ...ejercicio, id: '6' }] }, { ...page, total: -1 }, { ...page, partesDelCuerpo: [1] }, { ...page, privado: true }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(value)); await assert.rejects(buscarEjercicios({ q: '', parteDelCuerpo: '', equipamiento: '', desde: 0 }, t.signal), /no es válida/);
  }
});

test('crear y editar envían solo indicaciones permitidas y verifican identidad y resultado', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(saved, { status: 201 }));
  assert.deepEqual(await guardarEjercicioDeRutina(context, 6, { ...input, entrenadorId: 8 }, t.signal), saved);
  assert.deepEqual(JSON.parse(mock.mock.calls[0].arguments[1].body), { ejercicioId: 6, ...input });
  t.mock.method(globalThis, 'fetch', async (...args) => { assert.ok(args[0].endsWith('/ejercicios/5')); assert.equal(args[1].method, 'PUT'); assert.deepEqual(JSON.parse(args[1].body), input); return Response.json(saved); });
  assert.deepEqual(await guardarEjercicioDeRutina(context, 6, input, t.signal, 5), saved);
  for (const value of [{ ...saved, id: 9 }, { ...saved, ejercicioId: 9 }, { ...saved, cantidadDeSeries: 4 }, { ...saved, rutinaId: 8 }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(value)); await assert.rejects(guardarEjercicioDeRutina(context, 6, input, t.signal, 5), error => error.incierto && /no es válida/.test(error.message));
  }
});

test('no confirma escrituras ante fallos de red o respuesta y distingue los permisos', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Red'); });
  await assert.rejects(guardarEjercicioDeRutina(context, 6, input, t.signal), error => error.incierto && /No se pudo confirmar/.test(error.message));
  for (const [status, text] of [[400, /Revisá/], [401, /sesión/], [403, /permiso/], [404, /disponible/], [500, /operación/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL privado' }, { status }));
    await assert.rejects(consultarEjerciciosDeRutina(context, t.signal), error => error.estado === status && text.test(error.message) && !error.message.includes('SQL'));
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(guardarEjercicioDeRutina(context, 6, input, t.signal), error => error.incierto);
});
