import assert from 'node:assert/strict';
import { test } from 'node:test';
import { obtenerAlumnosAsignados } from '../src/entrenadores/alumnos-asignados.ts';

const alumno = { id: 1, nombre: 'Alumno', apellido: 'Prueba' };

test('consulta alumnos con la sesión sin enviar una identidad de entrenador elegida en la pantalla', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json([alumno]));
  assert.deepEqual(await obtenerAlumnosAsignados(t.signal), [alumno]);
  const [url, opciones] = simulacion.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/alumnos');
  assert.equal(opciones.credentials, 'include');
  assert.equal(opciones.body, undefined);
  assert.ok(opciones.signal instanceof AbortSignal);
});

test('una lista vacía de alumnos es un resultado válido', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.deepEqual(await obtenerAlumnosAsignados(t.signal), []);
});

test('distingue sesión vencida, falta de permisos y fallos sin exponer mensajes internos', async (t) => {
  for (const [estado, mensaje] of [[401, /sesión venció/], [403, /No tenés permiso/], [500, /No se pudo consultar/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status: estado }));
    await assert.rejects(obtenerAlumnosAsignados(t.signal), (error) => mensaje.test(error.message) && !error.message.includes('SQL'));
  }
});

test('rechaza respuestas incompletas, tipos incorrectos y datos privados', async (t) => {
  for (const cuerpo of [null, {}, [null], [{}], [{ ...alumno, id: '1' }], [{ ...alumno, id: 0 }], [{ ...alumno, id: 4_294_967_296 }],
    [{ ...alumno, nombre: ' ' }], [{ ...alumno, apellido: 2 }], [{ ...alumno, nombre: 'a'.repeat(101) }],
    ...['correo', 'contrasena', 'hashDeContrasena', 'rol'].map((campo) => [{ ...alumno, [campo]: 'privado' }])]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(cuerpo));
    await assert.rejects(obtenerAlumnosAsignados(t.signal), /respuesta del servidor no es válida/);
  }
});

test('un error de red o de formato no se confunde con ausencia de alumnos', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(obtenerAlumnosAsignados(t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => Response.json([alumno], { status: 201 }));
  await assert.rejects(obtenerAlumnosAsignados(t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin conexión'); });
  await assert.rejects(obtenerAlumnosAsignados(t.signal), /Revisá la conexión/);
});
