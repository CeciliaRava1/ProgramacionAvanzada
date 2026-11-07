import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cerrarSesion, iniciarSesion, obtenerSesion } from '../src/autenticacion/sesion.ts';

const usuario = { id: 1, nombre: 'Nombre', apellido: 'Apellido', correo: 'alumno@example.test', rol: 'alumno' };

test('recupera la sesión con cookies y distingue la ausencia de sesión de un fallo', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json(usuario));
  assert.deepEqual(await obtenerSesion(t.signal), usuario);
  assert.equal(simulacion.mock.calls[0].arguments[0], 'http://127.0.0.1:3000/usuarios/sesion');
  assert.equal(simulacion.mock.calls[0].arguments[1].credentials, 'include');
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 401 }));
  assert.equal(await obtenerSesion(t.signal), null);
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 503 }));
  await assert.rejects(obtenerSesion(t.signal), /No se pudo consultar/);
});

test('iniciar sesión envía credenciales exactas y solo acepta datos públicos válidos', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json(usuario));
  assert.deepEqual(await iniciarSesion(usuario.correo, ' una clave anterior ', t.signal), usuario);
  const opciones = simulacion.mock.calls[0].arguments[1];
  assert.equal(opciones.method, 'POST');
  assert.equal(opciones.credentials, 'include');
  assert.deepEqual(JSON.parse(opciones.body), { correo: usuario.correo, contrasena: ' una clave anterior ' });
});

test('credenciales incorrectas y límite de intentos tienen mensajes conocidos', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Detalle interno' }, { status: 401 }));
  await assert.rejects(iniciarSesion(usuario.correo, 'Clave123', t.signal), /Correo o contraseña incorrectos/);
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 429 }));
  await assert.rejects(iniciarSesion(usuario.correo, 'Clave123', t.signal), /Demasiados intentos/);
});

test('acepta los tres roles y rechaza identidades incompletas, roles desconocidos o respuestas con contraseñas', async (t) => {
  for (const rol of ['alumno', 'entrenador', 'administrador']) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ ...usuario, rol }));
    assert.equal((await obtenerSesion(t.signal)).rol, rol);
  }
  for (const cuerpo of [null, {}, { ...usuario, id: '1' }, { ...usuario, rol: 'otro' }, { ...usuario, rol: 'student' }, { ...usuario, contrasena: 'secreto' }, { ...usuario, hashDeContrasena: 'hash' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(cuerpo));
    await assert.rejects(obtenerSesion(t.signal), /no es válida/);
  }
});

test('el cierre requiere confirmación del servidor', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await cerrarSesion(t.signal);
  assert.equal(simulacion.mock.calls[0].arguments[1].method, 'DELETE');
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 500 }));
  await assert.rejects(cerrarSesion(t.signal), /No se pudo cerrar sesión/);
});

test('una respuesta no JSON o un fallo de red no confirma el acceso', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(obtenerSesion(t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin conexión'); });
  await assert.rejects(iniciarSesion(usuario.correo, 'Clave123', t.signal), /No se pudo confirmar/);
});
