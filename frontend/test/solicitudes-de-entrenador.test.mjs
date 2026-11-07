import assert from 'node:assert/strict';
import { test } from 'node:test';
import { obtenerEstadoDelAlumno, obtenerSolicitudesRecibidas, enviarSolicitud, responderSolicitud } from '../src/entrenadores/solicitudes-de-entrenador.ts';

const entrenador = { id: 2, nombre: 'Entrenador', apellido: 'Prueba', horario: [] };

test('interpreta los estados sin entrenador, pendiente y asignado enviando la sesión', async (t) => {
  for (const estado of [{ estado: 'sin_asignar' }, { estado: 'pendiente', solicitudId: 3, entrenador }, { estado: 'asignado', entrenador }]) {
    const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json(estado));
    assert.deepEqual(await obtenerEstadoDelAlumno(t.signal), estado);
    const [url, opciones] = simulacion.mock.calls[0].arguments;
    assert.equal(url, 'http://127.0.0.1:3000/usuarios/solicitudes-de-entrenador/actual');
    assert.equal(opciones.credentials, 'include');
  }
});

test('la bandeja acepta solo identificador y datos públicos del alumno', async (t) => {
  const esperado = [{ id: 4, alumno: { id: 1, nombre: 'Alumno', apellido: 'Prueba' } }];
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json(esperado));
  assert.deepEqual(await obtenerSolicitudesRecibidas(t.signal), esperado);
  assert.equal(simulacion.mock.calls[0].arguments[0], 'http://127.0.0.1:3000/usuarios/solicitudes-de-entrenador');
  for (const cuerpo of [null, [{}], [{ ...esperado[0], correo: 'privado' }], [{ id: 4, alumno: { ...esperado[0].alumno, hashDeContrasena: 'hash' } }]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(cuerpo));
    await assert.rejects(obtenerSolicitudesRecibidas(t.signal), /respuesta del servidor no es válida/);
  }
});

test('el envío no permite elegir alumno ni estado y comprueba al entrenador de la confirmación', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 3, entrenadorId: 2, estado: 'pendiente' }, { status: 201 }));
  await enviarSolicitud(2, t.signal);
  assert.deepEqual(JSON.parse(simulacion.mock.calls[0].arguments[1].body), { entrenadorId: 2 });
  assert.equal(simulacion.mock.calls[0].arguments[1].credentials, 'include');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 3, entrenadorId: 9, estado: 'pendiente' }, { status: 201 }));
  await assert.rejects(enviarSolicitud(2, t.signal), /respuesta del servidor no es válida/);
});

test('aceptar, rechazar y cancelar usan el método y endpoint correspondientes y exigen 204', async (t) => {
  for (const [accion, metodo, sufijo] of [['aceptar', 'POST', '/3/aceptar'], ['rechazar', 'POST', '/3/rechazar'], ['cancelar', 'DELETE', '/3']]) {
    const simulacion = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
    await responderSolicitud(3, accion, t.signal);
    const [url, opciones] = simulacion.mock.calls[0].arguments;
    assert.ok(url.endsWith(sufijo));
    assert.equal(opciones.method, metodo);
    assert.equal(opciones.credentials, 'include');
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await assert.rejects(responderSolicitud(3, 'aceptar', t.signal), /respuesta del servidor no es válida/);
});

test('rechaza estados desconocidos, datos privados y respuestas incompletas', async (t) => {
  for (const cuerpo of [{ estado: 'desconocido' }, { estado: 'unassigned' }, { estado: 'pendiente', entrenador }, { estado: 'pendiente', solicitudId: '3', entrenador },
    { estado: 'asignado', entrenador: { ...entrenador, correo: 'privado' } }, { estado: 'sin_asignar', entrenador }, { estado: 'asignado' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(cuerpo));
    await assert.rejects(obtenerEstadoDelAlumno(t.signal), /respuesta del servidor no es válida/);
  }
});

test('los errores no exponen mensajes internos ni confirman operaciones de resultado incierto', async (t) => {
  for (const estado of [400, 401, 403, 404, 409, 500]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status: estado }));
    await assert.rejects(enviarSolicitud(2, t.signal), (error) => error.estado === estado && !error.message.includes('SQL'));
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(obtenerEstadoDelAlumno(t.signal), /respuesta del servidor no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin red'); });
  await assert.rejects(responderSolicitud(3, 'cancelar', t.signal), /No se pudo confirmar/);
});
