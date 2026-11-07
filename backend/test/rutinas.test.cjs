const assert = require('node:assert/strict');
const { test } = require('node:test');
const { prepararEntorno } = require('./ayuda-de-planes.cjs');

test('la rutina tiene nombre libre obligatorio y descripción opcional con límites Unicode', async () => {
  const { crearRutina, DatosDeRutinaInvalidosError } = await import('../dist/planes/dominio/rutina.js');
  for (const descripcion of [undefined, null, '', '  \n ']) assert.deepEqual(crearRutina(2, { nombre: ' Empuje / libre ', descripcion }), { planId: 2, nombre: 'Empuje / libre', descripcion: null });
  assert.equal(crearRutina(2, { nombre: 'Rutina', descripcion: ' Texto\nlibre ' }).descripcion, 'Texto\nlibre');
  assert.equal([...crearRutina(2, { nombre: '\u{10400}'.repeat(200), descripcion: '\u{10400}'.repeat(5000) }).descripcion].length, 5000);
  for (const [nombre, descripcion, campo] of [[' ', null, 'nombre'], ['x'.repeat(201), null, 'nombre'], ['Rutina', 'x'.repeat(5001), 'descripcion']]) {
    assert.throws(() => crearRutina(2, { nombre, descripcion }), (error) => error instanceof DatosDeRutinaInvalidosError && Boolean(error.erroresDeCampo[campo]));
  }
});

test('los casos de uso comprueban el plan autorizado antes de consultar o guardar y proyectan solo datos públicos', async () => {
  const { GestionarRutinas } = await import('../dist/planes/aplicacion/gestionar-rutinas.js');
  const { AccesoAPlanDenegadoError } = await import('../dist/planes/aplicacion/gestionar-planes.js');
  const { PlanNoEncontradoError } = await import('../dist/planes/dominio/plan-de-entrenamiento.js');
  const { RutinaNoEncontradaError, DatosDeRutinaInvalidosError } = await import('../dist/planes/dominio/rutina.js');
  let permitido = true, existe = true, lecturas = 0, escrituras = 0;
  const guardada = { id: 5, planId: 4, nombre: 'Empuje', descripcion: null };
  const servicio = new GestionarRutinas({
    buscarPorPlan: async (id) => { assert.equal(id, 4); lecturas++; return [{ ...guardada, interno: true }]; },
    guardar: async (rutina) => { escrituras++; assert.deepEqual(rutina, { planId: 4, nombre: 'Empuje', descripcion: null }); return { ...guardada, interno: true }; },
    modificar: async (id, planId, datos) => { escrituras++; assert.deepEqual([id, planId], [5, 4]); return existe ? { id, planId, ...datos, interno: true } : null; },
  }, {
    listar: async (entrenadorId, alumnoId) => {
      assert.deepEqual([entrenadorId, alumnoId], [1, 2]);
      if (!permitido) throw new AccesoAPlanDenegadoError('Sin permiso');
      return [{ id: 4 }];
    },
  });
  assert.deepEqual(await servicio.listar(1, 2, 4), [guardada]);
  assert.deepEqual(await servicio.crear(1, 2, 4, { nombre: ' Empuje ' }), guardada);
  assert.deepEqual(await servicio.modificar(1, 2, 4, 5, { nombre: ' Tirón ', descripcion: ' Espalda ' }), { id: 5, planId: 4, nombre: 'Tirón', descripcion: 'Espalda' });
  await assert.rejects(servicio.listar(1, 2, 9), PlanNoEncontradoError);
  await assert.rejects(servicio.crear(1, 2, 4, { nombre: ' ' }), DatosDeRutinaInvalidosError);
  existe = false;
  await assert.rejects(servicio.modificar(1, 2, 4, 5, { nombre: 'Tirón' }), RutinaNoEncontradaError);
  permitido = false;
  const lecturasPrevias = lecturas, escriturasPrevias = escrituras;
  await assert.rejects(servicio.listar(1, 2, 4), AccesoAPlanDenegadoError);
  await assert.rejects(servicio.crear(1, 2, 4, { nombre: 'Empuje' }), AccesoAPlanDenegadoError);
  assert.equal(lecturas, lecturasPrevias); assert.equal(escrituras, escriturasPrevias);
});

test('el controlador valida formato y no expone errores internos', async () => {
  const { RutinasController } = await import('../dist/planes/presentacion/rutinas.controller.js');
  const { RutinaNoEncontradaError } = await import('../dist/planes/dominio/rutina.js');
  const llamadas = [];
  const controlador = new RutinasController({
    crear: async (...argumentos) => { llamadas.push(argumentos); },
    modificar: async (...argumentos) => { llamadas.push(argumentos); },
    listar: async () => { throw new Error('SQL privado'); },
  });
  const peticion = { session: { usuarioId: 4 } };
  for (const cuerpo of [null, [], {}, { nombre: 3 }, { nombre: 'Rutina', descripcion: 3 }, { nombre: 'Rutina', planId: 9 }]) {
    assert.throws(() => controlador.crear('2', '3', cuerpo, peticion), (error) => error.getStatus() === 400);
  }
  await controlador.crear('2', '3', { nombre: 'Rutina' }, peticion);
  await controlador.modificar('2', '3', '5', { nombre: 'Rutina', descripcion: null }, peticion);
  assert.deepEqual(llamadas, [[4, 2, 3, { nombre: 'Rutina', descripcion: undefined }], [4, 2, 3, 5, { nombre: 'Rutina', descripcion: null }]]);
  assert.throws(() => controlador.listar('2', 'x', peticion), (error) => error.getStatus() === 400);
  await assert.rejects(controlador.listar('2', '3', peticion), (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
  await assert.rejects(new RutinasController({ listar: async () => { throw new RutinaNoEncontradaError(); } }).listar('2', '3', peticion), (error) => error.getStatus() === 404);
});

test('HTTP y MySQL crean y editan rutinas dentro del plan del alumno y bloquean a quien no corresponde', { timeout: 40000 }, async (t) => {
  const entorno = await prepararEntorno(t);
  const [entrenador, otroEntrenador, alumno, otroAlumno] = await Promise.all(['entrenador', 'entrenador', 'alumno', 'alumno'].map((rol) => entorno.crearCuenta(rol)));
  await entorno.vinculaciones.insert([{ alumnoId: alumno.id, entrenadorId: entrenador.id }, { alumnoId: otroAlumno.id, entrenadorId: otroEntrenador.id }]);
  const cookies = [];
  for (const cuenta of [entrenador, otroEntrenador, alumno]) cookies.push(await entorno.iniciarSesion(cuenta));
  const [cookieDelEntrenador, cookieDelOtro, cookieDelAlumno] = cookies;
  const llamar = entorno.llamar;
  const plan = await (await llamar(`alumnos/${alumno.id}/planes`, 'POST', cookieDelEntrenador, { nombre: 'Plan', objetivo: 'Fuerza' })).json();
  const otroPlan = await (await llamar(`alumnos/${otroAlumno.id}/planes`, 'POST', cookieDelOtro, { nombre: 'Otro plan', objetivo: 'Fuerza' })).json();
  const ruta = `alumnos/${alumno.id}/planes/${plan.id}/rutinas`;

  for (const metodo of ['GET', 'POST']) {
    const cuerpo = metodo === 'POST' ? { nombre: 'Día 1' } : undefined;
    assert.equal((await llamar(ruta, metodo, null, cuerpo)).status, 401);
    assert.equal((await llamar(ruta, metodo, cookieDelAlumno, cuerpo)).status, 403);
    assert.equal((await llamar(ruta, metodo, cookieDelOtro, cuerpo)).status, 403);
  }
  assert.equal((await llamar(ruta, 'POST', cookieDelEntrenador, { nombre: 'Día 1' }, 'http://otro.example')).status, 403);
  assert.equal((await llamar(`alumnos/${alumno.id}/planes/${otroPlan.id}/rutinas`, 'GET', cookieDelEntrenador)).status, 404);
  for (const cuerpo of [{ nombre: ' ' }, { nombre: 'Día 1', planId: otroPlan.id }, { nombre: 'x'.repeat(201) }, { nombre: 'Día 1', descripcion: 'x'.repeat(5001) }]) {
    assert.equal((await llamar(ruta, 'POST', cookieDelEntrenador, cuerpo)).status, 400);
  }
  assert.deepEqual(await (await llamar(ruta, 'GET', cookieDelEntrenador)).json(), []);
  let respuesta = await llamar(ruta, 'POST', cookieDelEntrenador, { nombre: ' Día 1 ', descripcion: '  ' });
  assert.equal(respuesta.status, 201);
  const rutina = await respuesta.json();
  assert.deepEqual(rutina, { id: rutina.id, planId: plan.id, nombre: 'Día 1', descripcion: null });
  respuesta = await llamar(`${ruta}/${rutina.id}`, 'PUT', cookieDelEntrenador, { nombre: 'Día 1 editado', descripcion: 'Pecho y hombros' });
  assert.equal(respuesta.status, 200);
  const editada = { ...rutina, nombre: 'Día 1 editado', descripcion: 'Pecho y hombros' };
  assert.deepEqual(await respuesta.json(), editada);
  assert.equal((await llamar(`${ruta}/${rutina.id}`, 'PUT', cookieDelOtro, { nombre: 'x' })).status, 403);
  assert.equal((await llamar(`${ruta}/99999999`, 'PUT', cookieDelEntrenador, { nombre: 'x' })).status, 404);
  assert.deepEqual(await (await llamar(ruta, 'GET', cookieDelEntrenador)).json(), [editada]);

  assert.equal((await llamar(`alumnos/${alumno.id}/planes/${plan.id}`, 'DELETE', cookieDelEntrenador)).status, 204);
  assert.equal((await llamar(ruta, 'GET', cookieDelEntrenador)).status, 404);
  assert.equal((await llamar(ruta, 'POST', cookieDelEntrenador, { nombre: 'Día 2' })).status, 404);
});
