import assert from 'node:assert/strict';
import { test } from 'node:test';
import { obtenerErroresDeRegistro, registrarUsuario } from '../src/registro/registro-de-usuario.ts';

const entrada = { nombre: 'Nombre', apellido: 'Apellido', correo: 'alumno@example.test', contrasena: 'Clave123' };
const creada = { id: 1, nombre: 'Nombre', apellido: 'Apellido', correo: entrada.correo, rol: 'alumno' };

test('valida campos obligatorios, límites y formato antes del envío', () => {
  assert.deepEqual(obtenerErroresDeRegistro(entrada), {});
  assert.deepEqual(Object.keys(obtenerErroresDeRegistro({ nombre: ' ', apellido: 'a'.repeat(101), correo: 'incorrecto', contrasena: 'corta' })), ['nombre', 'apellido', 'correo', 'contrasena']);
  assert.ok(obtenerErroresDeRegistro({ ...entrada, correo: 'a\0@example.test' }).correo);
  assert.ok(obtenerErroresDeRegistro({ ...entrada, contrasena: 'a'.repeat(129) }).contrasena);
});

test('la contraseña acepta ocho caracteres y rechaza espacios y límites inválidos', () => {
  for (const contrasena of ['Clave123', 'ñ'.repeat(8), 'a'.repeat(128)]) {
    assert.equal(obtenerErroresDeRegistro({ ...entrada, contrasena }).contrasena, undefined);
  }
  for (const contrasena of ['Clave12', 'a'.repeat(129), ' Clave123', 'Clave123 ', 'Clave 123', 'Clave\t123', 'Clave\n123', 'Clave 123']) {
    assert.ok(obtenerErroresDeRegistro({ ...entrada, contrasena }).contrasena);
  }
});

test('envía únicamente los campos aprobados y acepta una cuenta de alumno', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json(creada, { status: 201 }));
  await registrarUsuario({ ...entrada, rol: 'administrador' }, t.signal);
  const [url, opciones] = simulacion.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/alumnos');
  assert.equal(opciones.method, 'POST');
  assert.equal(opciones.credentials, 'include');
  assert.deepEqual(JSON.parse(opciones.body), entrada);
});

test('muestra el duplicado y los errores de validación asociados a campos', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 409 }));
  await assert.rejects(registrarUsuario(entrada, t.signal), (error) => Boolean(error.erroresDeCampo.correo));
  t.mock.method(globalThis, 'fetch', async () => Response.json({ erroresDeCampo: { correo: 'Correo inválido.', rol: 'No mostrar.' } }, { status: 400 }));
  await assert.rejects(registrarUsuario(entrada, t.signal), (error) => {
    assert.deepEqual(error.erroresDeCampo, { correo: 'Correo inválido.' });
    return true;
  });
});

test('un fallo del servidor no muestra sus detalles internos', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status: 500 }));
  await assert.rejects(registrarUsuario(entrada, t.signal), (error) => !error.message.includes('SQL'));
});

test('rechaza respuestas de éxito incompletas o con credenciales', async (t) => {
  for (const cuerpo of [null, {}, { ...creada, id: '1' }, { ...creada, rol: 'administrador' }, { ...creada, hashDeContrasena: 'hash' }, { ...creada, contrasena: 'secreto' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(cuerpo, { status: 201 }));
    await assert.rejects(registrarUsuario(entrada, t.signal), /respuesta del servidor no es válida/);
  }
});

test('no confirma un registro si la respuesta no es JSON o hay un error de red', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML', { status: 201 }));
  await assert.rejects(registrarUsuario(entrada, t.signal), /no es válida/);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin conexión'); });
  await assert.rejects(registrarUsuario(entrada, t.signal), /No se pudo confirmar el registro/);
});

test('el alta de entrenadores envía la sesión y solo los campos acordados', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...creada, rol: 'entrenador' }, { status: 201 }));
  await registrarUsuario({ ...entrada, rol: 'administrador' }, t.signal, 'entrenador');
  const [url, opciones] = simulacion.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/entrenadores');
  assert.equal(opciones.credentials, 'include');
  assert.equal(opciones.method, 'POST');
  assert.deepEqual(JSON.parse(opciones.body), entrada);
});

test('distingue sesión vencida, falta de permisos y respuestas con otro rol', async (t) => {
  for (const [estado, mensaje] of [[401, /sesión venció/], [403, /No tenés permiso para crear cuentas/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Detalles internos' }, { status: estado }));
    await assert.rejects(registrarUsuario(entrada, t.signal, 'entrenador'), mensaje);
    await assert.rejects(registrarUsuario(entrada, t.signal, 'alumno'), mensaje);
  }
  for (const cuerpo of [creada, { ...creada, rol: 'administrador' }, { ...creada, rol: 'entrenador', hashDeContrasena: 'hash' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(cuerpo, { status: 201 }));
    await assert.rejects(registrarUsuario(entrada, t.signal, 'entrenador'), /respuesta del servidor no es válida/);
  }
});

test('el horario es opcional y se envía únicamente al crear entrenadores', async (t) => {
  for (const horario of [undefined, [], ['manana'], ['manana', 'tarde', 'noche'], ['noche', 'manana']]) {
    assert.equal(obtenerErroresDeRegistro({ ...entrada, horario }).horario, undefined);
  }
  for (const horario of ['Tarde', ['madrugada'], ['manana', 'manana'], [1], null]) {
    assert.ok(obtenerErroresDeRegistro({ ...entrada, horario }).horario);
  }
  const entrenador = { ...creada, rol: 'entrenador' };
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json(entrenador, { status: 201 }));
  await registrarUsuario({ ...entrada, horario: ['noche', 'manana'] }, t.signal, 'entrenador');
  assert.deepEqual(JSON.parse(simulacion.mock.calls[0].arguments[1].body).horario, ['manana', 'noche']);
  t.mock.method(globalThis, 'fetch', async () => Response.json(creada, { status: 201 }));
  await registrarUsuario({ ...entrada, horario: ['tarde'] }, t.signal, 'alumno');
  const ultimoPedido = globalThis.fetch.mock.calls[0].arguments[1];
  assert.equal('horario' in JSON.parse(ultimoPedido.body), false);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ erroresDeCampo: { horario: 'Horario inválido.' } }, { status: 400 }));
  await assert.rejects(registrarUsuario(entrada, t.signal, 'entrenador'), (error) => error.erroresDeCampo.horario === 'Horario inválido.');
});
