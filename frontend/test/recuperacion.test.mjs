import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ErrorDeRecuperacion, errorDeContrasenaNueva, interpretarRutaDeAcceso, pedirRecuperacion, restablecerContrasena,
} from '../src/autenticacion/recuperacion.ts';

test('interpreta las rutas de acceso y descarta valores inválidos', () => {
  assert.deepEqual(interpretarRutaDeAcceso(''), { pantalla: 'inicio' });
  assert.deepEqual(interpretarRutaDeAcceso('#/otra'), { pantalla: 'inicio' });
  assert.deepEqual(interpretarRutaDeAcceso('#/recuperar'), { pantalla: 'recuperar' });
  assert.deepEqual(interpretarRutaDeAcceso('#/restablecer?token=abc_-1&rol=entrenador'), { pantalla: 'restablecer', token: 'abc_-1', rol: 'entrenador' });
  assert.deepEqual(interpretarRutaDeAcceso('#/restablecer?rol=superusuario'), { pantalla: 'restablecer', token: null, rol: null });
  assert.equal(interpretarRutaDeAcceso(`#/restablecer?token=${'a'.repeat(201)}`).token, null);
  assert.deepEqual(interpretarRutaDeAcceso('#/restablecer'), { pantalla: 'restablecer', token: null, rol: null });
});

test('la contraseña nueva sigue la misma regla que el backend y debe confirmarse', () => {
  assert.equal(errorDeContrasenaNueva('Clave1234', 'Clave1234'), null);
  assert.match(errorDeContrasenaNueva('corta', 'corta'), /al menos 8/);
  assert.match(errorDeContrasenaNueva('con espacio', 'con espacio'), /sin espacios/);
  assert.match(errorDeContrasenaNueva('a'.repeat(129), 'a'.repeat(129)), /demasiado larga/);
  assert.match(errorDeContrasenaNueva('Clave1234', 'Clave12345'), /no coinciden/);
});

test('pedir el enlace envía correo y rol; cualquier 202 es igual de exitoso', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'ok' }, { status: 202 }));
  await pedirRecuperacion(' ana@example.test ', 'alumno', t.signal);
  const [url, opciones] = simulacion.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/recuperacion');
  assert.equal(opciones.method, 'POST');
  assert.deepEqual(JSON.parse(opciones.body), { correo: 'ana@example.test', rol: 'alumno' });
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 429 }));
  await assert.rejects(pedirRecuperacion('ana@example.test', 'alumno', t.signal), /Demasiados intentos/);
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 500 }));
  await assert.rejects(pedirRecuperacion('ana@example.test', 'alumno', t.signal), /No se pudo pedir/);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('red'); });
  await assert.rejects(pedirRecuperacion('ana@example.test', 'alumno', t.signal), /Revisá la conexión/);
});

test('restablecer envía el token y distingue enlace vencido de contraseña inválida', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await restablecerContrasena('token', 'Clave1234', t.signal);
  const [url, opciones] = simulacion.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/recuperacion/restablecer');
  assert.deepEqual(JSON.parse(opciones.body), { token: 'token', contrasena: 'Clave1234' });

  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'x' }, { status: 410 }));
  await assert.rejects(restablecerContrasena('token', 'Clave1234', t.signal), (error) => error instanceof ErrorDeRecuperacion && error.enlaceInvalido && /ya venció/.test(error.message));

  t.mock.method(globalThis, 'fetch', async () => Response.json({ erroresDeCampo: { contrasena: 'Usá al menos 8 caracteres, sin espacios.' } }, { status: 400 }));
  await assert.rejects(restablecerContrasena('token', 'corta', t.signal), (error) => !error.enlaceInvalido && /al menos 8/.test(error.message));

  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 500 }));
  await assert.rejects(restablecerContrasena('token', 'Clave1234', t.signal), /No se pudo cambiar/);
});
