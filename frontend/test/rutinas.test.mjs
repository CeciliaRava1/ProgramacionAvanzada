import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearRutina, modificarRutina, consultarRutinas, obtenerErroresDeRutina } from '../src/planes/rutinas.ts';

const saved = { id: 5, planId: 2, nombre: 'Push / libre', descripcion: null };

test('valida nombre obligatorio y descripción opcional con límites Unicode antes de enviar', async (t) => {
  for (const description of [undefined, null, '', '  ']) assert.deepEqual(obtenerErroresDeRutina({ nombre: 'Push / libre', description }), {});
  assert.deepEqual(obtenerErroresDeRutina({ nombre: '\u{10400}'.repeat(200), descripcion: '\u{10400}'.repeat(5000) }), {});
  assert.ok(obtenerErroresDeRutina({ nombre: ' ', descripcion: '' }).nombre);
  assert.ok(obtenerErroresDeRutina({ nombre: 'x'.repeat(201), descripcion: 'x'.repeat(5001) }).descripcion);
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debería enviar'); });
  await assert.rejects(crearRutina(1, 2, { nombre: '' }, t.signal), /Revisá los datos/);
  for (const ids of [[0, 2], [1, -1], [1, 4294967296]]) await assert.rejects(consultarRutinas(...ids, t.signal), /válidos/);
  for (const id of [0, undefined, -1, 4294967296]) await assert.rejects(modificarRutina(1, 2, id, { nombre: saved.nombre }, t.signal), /rutina válida/);
  assert.equal(mock.mock.callCount(), 0);
});

test('consulta varias rutinas con la sesión y acepta una lista vacía', async (t) => {
  const list = [saved, { ...saved, id: 6, nombre: 'Otro nombre', descripcion: 'Descripción libre' }];
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(list));
  assert.deepEqual(await consultarRutinas(1, 2, t.signal), list);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/alumnos/1/planes/2/rutinas');
  assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'include');
  t.mock.method(globalThis, 'fetch', async () => Response.json([])); assert.deepEqual(await consultarRutinas(1, 2, t.signal), []);
});

test('crear envía solo nombre y descripción y exige confirmar plan y datos normalizados', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(saved, { status: 201 }));
  assert.deepEqual(await crearRutina(1, 2, { nombre: ' Push / libre ', descripcion: '  ', planId: 99 }, t.signal), saved);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.ok(url.endsWith('/2/rutinas')); assert.equal(options.method, 'POST'); assert.equal(options.credentials, 'include');
  assert.deepEqual(JSON.parse(options.body), { nombre: ' Push / libre ', descripcion: null });
  const conDescripcion = { ...saved, descripcion: 'Texto\nlibre' };
  t.mock.method(globalThis, 'fetch', async () => Response.json(conDescripcion, { status: 201 }));
  assert.deepEqual(await crearRutina(1, 2, { nombre: saved.nombre, descripcion: ' Texto\nlibre ' }, t.signal), conDescripcion);
  for (const body of [{ ...saved, planId: 9 }, { ...saved, nombre: 'Otro' }, { ...saved, descripcion: 'Otro' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body, { status: 201 }));
    await assert.rejects(crearRutina(1, 2, { nombre: saved.nombre }, t.signal), /no es válida/);
  }
});

test('rechaza respuestas incompletas, de otro plan o con datos privados', async (t) => {
  for (const body of [null, {}, [{}], [{ ...saved, id: '5' }], [{ ...saved, planId: 9 }], [{ ...saved, nombre: '' }], [{ ...saved, descripcion: false }], [{ ...saved, descripcion: 'x'.repeat(5001) }], ...['correo', 'hashDeContrasena', 'entrenadorId', 'numeroDeDia'].map((field) => [{ ...saved, [field]: 1 }])]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body)); await assert.rejects(consultarRutinas(1, 2, t.signal), /no es válida/);
  }
});

test('editar usa PUT sobre la rutina concreta y exige identidad, campos y estado HTTP correctos', async (t) => {
  const edited = { ...saved, nombre: 'Nombre editado', descripcion: 'Texto editado' };
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(edited));
  assert.deepEqual(await modificarRutina(1, 2, 5, { ...edited, nombre: ' Nombre editado ', planId: 99 }, t.signal), edited);
  const [url, options] = mock.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/alumnos/1/planes/2/rutinas/5');
  assert.equal(options.method, 'PUT'); assert.equal(options.credentials, 'include');
  assert.deepEqual(JSON.parse(options.body), { nombre: ' Nombre editado ', descripcion: 'Texto editado' });
  for (const body of [{ ...edited, id: 9 }, { ...edited, planId: 9 }, { ...edited, nombre: 'Otro' }, { ...edited, descripcion: null }, { ...edited, interno: true }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(modificarRutina(1, 2, 5, edited, t.signal), /no es válida/);
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json(edited, { status: 201 }));
  await assert.rejects(modificarRutina(1, 2, 5, edited, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin red'); });
  await assert.rejects(modificarRutina(1, 2, 5, edited, t.signal), /No se pudo confirmar la modificación/);
});

test('distingue permisos y errores sin exponer detalles ni confirmar escrituras inciertas', async (t) => {
  for (const [status, message] of [[400, /Revisá/], [401, /sesión venció/], [403, /No tenés permiso/], [404, /ya no está disponible/], [500, /No se pudo completar/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status }));
    await assert.rejects(consultarRutinas(1, 2, t.signal), (error) => error.estado === status && message.test(error.message) && !error.message.includes('SQL'));
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML')); await assert.rejects(consultarRutinas(1, 2, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => Response.json(saved)); await assert.rejects(crearRutina(1, 2, { nombre: saved.nombre }, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin red'); });
  await assert.rejects(crearRutina(1, 2, { nombre: saved.nombre }, t.signal), /No se pudo confirmar/);
  await assert.rejects(consultarRutinas(1, 2, t.signal), /Revisá la conexión/);
});
