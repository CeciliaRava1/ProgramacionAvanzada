import assert from 'node:assert/strict';
import { test } from 'node:test';
import { darDeBajaCuenta, esCuentaGestionada, listarCuentas, modificarCuenta } from '../src/administracion/cuentas.ts';
import { obtenerErroresDeDatosDeCuenta } from '../src/registro/registro-de-usuario.ts';

const alumno = { id: 1, nombre: 'Ana', apellido: 'Pérez', correo: 'ana@example.test', activa: true };
const entrenador = { id: 2, nombre: 'Leo', apellido: 'Gómez', correo: 'leo@example.test', activa: false, horario: ['manana', 'noche'] };
const entrada = { nombre: 'Ana', apellido: 'Pérez', correo: 'ana@example.test' };

test('lista alumnos y entrenadores con la sesión, incluidas las cuentas dadas de baja', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json([alumno, { ...alumno, id: 3, activa: false }]));
  assert.equal((await listarCuentas('alumnos', t.signal)).length, 2);
  let [url, opciones] = simulacion.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/administrador/alumnos');
  assert.equal(opciones.credentials, 'include');
  assert.equal(opciones.method, 'GET');

  const simulacionDeEntrenadores = t.mock.method(globalThis, 'fetch', async () => Response.json([entrenador, { ...entrenador, id: 4, horario: [] }]));
  assert.equal((await listarCuentas('entrenadores', t.signal))[0].activa, false);
  [url] = simulacionDeEntrenadores.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/administrador/entrenadores');
});

test('una lista vacía es válida', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.deepEqual(await listarCuentas('alumnos', t.signal), []);
});

test('valida la forma de cada cuenta según su tipo y rechaza datos privados', () => {
  assert.equal(esCuentaGestionada(alumno, 'alumnos'), true);
  assert.equal(esCuentaGestionada(entrenador, 'entrenadores'), true);
  const invalidas = [
    [{ ...alumno, horario: [] }, 'alumnos'], [alumno, 'entrenadores'], [{ ...entrenador, horario: 'Tarde' }, 'entrenadores'],
    [{ ...entrenador, horario: ['madrugada'] }, 'entrenadores'], [{ ...alumno, id: '1' }, 'alumnos'], [{ ...alumno, id: 0 }, 'alumnos'],
    [{ ...alumno, activa: 'sí' }, 'alumnos'], [{ ...alumno, nombre: ' ' }, 'alumnos'], [{ ...alumno, correo: '' }, 'alumnos'],
    [{ ...alumno, contrasena: 'x' }, 'alumnos'], [{ ...alumno, hashDeContrasena: 'x' }, 'alumnos'], [{ ...alumno, rol: 'alumno' }, 'alumnos'],
    [{ ...alumno, active: true }, 'alumnos'], [{ ...alumno, firstName: 'Ana' }, 'alumnos'], [null, 'alumnos'], [[], 'alumnos'],
  ];
  for (const [valor, tipo] of invalidas) assert.equal(esCuentaGestionada(valor, tipo), false, JSON.stringify(valor));
});

test('el listado rechaza respuestas inválidas y distingue sesión, permisos y fallos', async (t) => {
  for (const cuerpo of [null, {}, [null], [{ ...alumno, hashDeContrasena: 'x' }]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(cuerpo));
    await assert.rejects(listarCuentas('alumnos', t.signal), /respuesta del servidor no es válida/);
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('HTML'));
  await assert.rejects(listarCuentas('alumnos', t.signal), /no es válida/);
  for (const [estado, mensaje] of [[401, /sesión venció/], [403, /No tenés permiso/], [500, /No se pudo completar/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL y credenciales' }, { status: estado }));
    await assert.rejects(listarCuentas('alumnos', t.signal), (error) => mensaje.test(error.message) && !error.message.includes('SQL') && error.estado === estado);
  }
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin conexión'); });
  await assert.rejects(listarCuentas('alumnos', t.signal), /Revisá la conexión/);
});

test('modificar un alumno envía solo nombre, apellido y correo', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...alumno, nombre: 'Ana María' }));
  const guardada = await modificarCuenta('alumnos', 1, { ...entrada, nombre: 'Ana María', horario: ['manana'] }, t.signal);
  assert.equal(guardada.nombre, 'Ana María');
  const [url, opciones] = simulacion.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/administrador/alumnos/1');
  assert.equal(opciones.method, 'PUT');
  assert.equal(opciones.credentials, 'include');
  assert.deepEqual(JSON.parse(opciones.body), { nombre: 'Ana María', apellido: 'Pérez', correo: 'ana@example.test' });
});

test('modificar un entrenador envía el horario en orden y lo comprueba en la respuesta', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...entrenador, activa: true, horario: ['manana', 'noche'] }));
  const guardada = await modificarCuenta('entrenadores', 2, { ...entrada, horario: ['noche', 'manana'] }, t.signal);
  assert.deepEqual(guardada.horario, ['manana', 'noche']);
  assert.equal(simulacion.mock.calls[0].arguments[0], 'http://127.0.0.1:3000/usuarios/administrador/entrenadores/2');
  assert.deepEqual(JSON.parse(simulacion.mock.calls[0].arguments[1].body).horario, ['manana', 'noche']);
  for (const cuerpo of [{ ...entrenador, id: 9 }, { ...entrenador, horario: undefined }, alumno]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(cuerpo));
    await assert.rejects(modificarCuenta('entrenadores', 2, entrada, t.signal), /respuesta del servidor no es válida/);
  }
});

test('modificar valida antes de enviar y no hace pedidos con datos inválidos', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => Response.json(alumno));
  await assert.rejects(modificarCuenta('alumnos', 1, { ...entrada, correo: 'incorrecto' }, t.signal), (error) => Boolean(error.erroresDeCampo.correo));
  await assert.rejects(modificarCuenta('entrenadores', 2, { ...entrada, horario: ['madrugada'] }, t.signal), (error) => Boolean(error.erroresDeCampo.horario));
  await assert.rejects(modificarCuenta('alumnos', 0, entrada, t.signal), /cuenta válida/);
  assert.equal(simulacion.mock.callCount(), 0);
});

test('modificar muestra los errores de campo conocidos y mensajes por estado sin detalles internos', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ erroresDeCampo: { correo: 'Correo inválido.', rol: 'No mostrar.' } }, { status: 400 }));
  await assert.rejects(modificarCuenta('alumnos', 1, entrada, t.signal), (error) => {
    assert.deepEqual(error.erroresDeCampo, { correo: 'Correo inválido.' });
    return true;
  });
  for (const [estado, mensaje] of [[404, /ya no está disponible/], [409, /Ya existe una cuenta con ese correo o la cuenta fue dada de baja/], [403, /No tenés permiso/]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'SQL' }, { status: estado }));
    await assert.rejects(modificarCuenta('alumnos', 1, entrada, t.signal), (error) => mensaje.test(error.message) && !error.message.includes('SQL'));
  }
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Sin conexión'); });
  await assert.rejects(modificarCuenta('alumnos', 1, entrada, t.signal), /No se pudo confirmar la operación/);
});

test('dar de baja usa DELETE sobre la cuenta y espera 204', async (t) => {
  const simulacion = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await darDeBajaCuenta('entrenadores', 2, t.signal);
  const [url, opciones] = simulacion.mock.calls[0].arguments;
  assert.equal(url, 'http://127.0.0.1:3000/usuarios/administrador/entrenadores/2');
  assert.equal(opciones.method, 'DELETE');
  assert.equal(opciones.credentials, 'include');
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 200 }));
  await assert.rejects(darDeBajaCuenta('entrenadores', 2, t.signal), /respuesta del servidor no es válida/);
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 404 }));
  await assert.rejects(darDeBajaCuenta('alumnos', 1, t.signal), (error) => error.estado === 404);
  await assert.rejects(darDeBajaCuenta('alumnos', -1, t.signal), /cuenta válida/);
});

test('la validación compartida revisa nombre, correo y horario', () => {
  assert.deepEqual(obtenerErroresDeDatosDeCuenta(entrada), {});
  assert.deepEqual(Object.keys(obtenerErroresDeDatosDeCuenta({ nombre: ' ', apellido: 'a'.repeat(101), correo: 'x', horario: ['madrugada'] })),
    ['nombre', 'apellido', 'correo', 'horario']);
});
