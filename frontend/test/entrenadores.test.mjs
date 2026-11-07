import assert from 'node:assert/strict';
import { test } from 'node:test';
import { obtenerEntrenadores } from '../src/entrenadores/entrenadores.ts';

const entrenador = { id: 1, nombre: 'Nombre', apellido: 'Apellido', horario: ['tarde'] };

test('consulta entrenadores con la sesión y admite horarios sin completar', async (t) => {
  const esperado = [entrenador, { ...entrenador, id: 2, horario: [] }, { ...entrenador, id: 3, horario: ['manana', 'noche'] }];
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json(esperado));
  assert.deepEqual(await obtenerEntrenadores(t.signal), esperado);
  const [url, opciones] = simulacion.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/entrenadores');
  assert.equal(opciones.credentials, 'include');
});

test('una lista vacía es un resultado válido', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.deepEqual(await obtenerEntrenadores(t.signal), []);
});

test('distingue sesión vencida, falta de permisos y fallos del servidor', async (t) => {
  for (const [estado, mensaje] of [[401, /sesión venció/], [403, /No tenés permiso/], [500, /No se pudo consultar/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status: estado }));
    await assert.rejects(obtenerEntrenadores(t.signal), (error) => mensaje.test(error.message) && !error.message.includes('SQL'));
  }
});

test('rechaza datos incompletos, tipos incorrectos y cualquier campo privado', async (t) => {
  for (const cuerpo of [null, {}, [null], [{}], [{ ...entrenador, id: '1' }], [{ ...entrenador, nombre: ' ' }],
    [{ ...entrenador, horario: undefined }], [{ ...entrenador, horario: null }], [{ ...entrenador, horario: 123 }],
    [{ ...entrenador, horario: 'Tarde' }], [{ ...entrenador, horario: ['madrugada'] }], [{ ...entrenador, horario: ['noche', 'noche'] }],
    [{ ...entrenador, availability: ['tarde'] }],
    ...['correo', 'contrasena', 'hashDeContrasena'].map((campo) => [{ ...entrenador, [campo]: 'privado' }])]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(cuerpo));
    await assert.rejects(obtenerEntrenadores(t.signal), /respuesta del servidor no es válida/);
  }
});

test('un error de red o una respuesta que no sea JSON no se presentan como lista vacía', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(obtenerEntrenadores(t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin conexión'); });
  await assert.rejects(obtenerEntrenadores(t.signal), /Revisá la conexión/);
});
