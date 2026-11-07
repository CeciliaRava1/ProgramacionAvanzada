const assert = require('node:assert/strict');
const { test } = require('node:test');
const { prepararEntorno, crearEjercicioDePrueba } = require('./ayuda-de-planes.cjs');

test('las indicaciones del ejercicio validan cantidades, peso, descanso y RIR', async () => {
  const { validarEjercicioDeRutina, DatosDeEjercicioDeRutinaInvalidosError } = await import('../dist/planes/dominio/ejercicio-de-rutina.js');
  const base = { cantidadDeSeries: 3, repeticionesRecomendadas: 10, pesoRecomendadoKg: 42.5, descansoEnSegundos: 90 };
  assert.deepEqual(validarEjercicioDeRutina(base), base);
  assert.deepEqual(validarEjercicioDeRutina({ ...base, pesoRecomendadoKg: null, descansoEnSegundos: null, rirRecomendado: 2 }), { ...base, pesoRecomendadoKg: null, descansoEnSegundos: null, rirRecomendado: 2 });
  for (const [campo, valor] of [['cantidadDeSeries', 0], ['cantidadDeSeries', 1.5], ['repeticionesRecomendadas', -1], ['repeticionesRecomendadas', 65536], ['pesoRecomendadoKg', -1], ['pesoRecomendadoKg', 1.234], ['descansoEnSegundos', -5], ['rirRecomendado', 1.5], ['rirRecomendado', -1]]) {
    assert.throws(() => validarEjercicioDeRutina({ ...base, [campo]: valor }), (error) => error instanceof DatosDeEjercicioDeRutinaInvalidosError && Boolean(error.erroresDeCampo[campo]));
  }
});

test('agregar y modificar ejercicios autoriza la rutina antes de guardar y exige un ejercicio del catálogo', async () => {
  const { GestionarEjerciciosDeRutina } = await import('../dist/planes/aplicacion/gestionar-ejercicios-de-rutina.js');
  const { RutinaNoEncontradaError } = await import('../dist/planes/dominio/rutina.js');
  const { EjercicioNoEncontradoError } = await import('../dist/planes/dominio/ejercicio.js');
  const { DatosDeEjercicioDeRutinaInvalidosError } = await import('../dist/planes/dominio/ejercicio-de-rutina.js');
  let rutinasDelPlan = [{ id: 7 }], escrituras = 0, existeElEjercicio = true, modificable = true;
  const datos = { cantidadDeSeries: 3, repeticionesRecomendadas: 10, pesoRecomendadoKg: null, descansoEnSegundos: null };
  const servicio = new GestionarEjerciciosDeRutina({
    listar: async (id) => { assert.equal(id, 7); return []; },
    guardar: async (rutinaId, ejercicioId, validados) => { escrituras++; assert.deepEqual([rutinaId, ejercicioId, validados], [7, 5, datos]); return { id: 1 }; },
    modificar: async () => { escrituras++; return modificable ? { id: 1 } : null; },
  }, { buscarPorId: async () => existeElEjercicio ? { id: 5 } : null }, { listar: async () => rutinasDelPlan });
  assert.deepEqual(await servicio.listar(1, 2, 3, 7), []);
  assert.deepEqual(await servicio.agregar(1, 2, 3, 7, 5, datos), { id: 1 });
  assert.deepEqual(await servicio.modificar(1, 2, 3, 7, 1, datos), { id: 1 });
  await assert.rejects(servicio.agregar(1, 2, 3, 7, 5, { ...datos, cantidadDeSeries: 0 }), DatosDeEjercicioDeRutinaInvalidosError);
  existeElEjercicio = false;
  await assert.rejects(servicio.agregar(1, 2, 3, 7, 5, datos), EjercicioNoEncontradoError);
  modificable = false;
  await assert.rejects(servicio.modificar(1, 2, 3, 7, 1, datos), EjercicioNoEncontradoError);
  rutinasDelPlan = [];
  const previas = escrituras;
  await assert.rejects(servicio.agregar(1, 2, 3, 7, 5, datos), RutinaNoEncontradaError);
  await assert.rejects(servicio.listar(1, 2, 3, 7), RutinaNoEncontradaError);
  assert.equal(escrituras, previas);
});

test('el controlador valida las indicaciones y no expone errores internos', async () => {
  const { EjerciciosDeRutinaController } = await import('../dist/planes/presentacion/ejercicios-de-rutina.controller.js');
  const llamadas = [];
  const controlador = new EjerciciosDeRutinaController({
    agregar: async (...argumentos) => { llamadas.push(argumentos); },
    modificar: async (...argumentos) => { llamadas.push(argumentos); },
    listar: async () => { throw new Error('SQL privado'); },
  });
  const peticion = { session: { usuarioId: 4 } }, parametros = { alumnoId: '2', planId: '3', rutinaId: '7' };
  const valido = { ejercicioId: 5, cantidadDeSeries: 3, repeticionesRecomendadas: 10 };
  for (const cuerpo of [null, [], {}, { ...valido, ejercicioId: 'x' }, { ...valido, cantidadDeSeries: '3' }, { ...valido, pesoRecomendadoKg: '40' }, { ...valido, rutinaId: 9 }]) {
    assert.throws(() => controlador.agregar(parametros, cuerpo, peticion), (error) => error.getStatus() === 400);
  }
  await controlador.agregar(parametros, { ...valido, rirRecomendado: 2 }, peticion);
  await controlador.modificar({ ...parametros, id: '8' }, { cantidadDeSeries: 4, repeticionesRecomendadas: 8, descansoEnSegundos: 60 }, peticion);
  assert.deepEqual(llamadas[0].slice(0, 5), [4, 2, 3, 7, 5]);
  assert.deepEqual(llamadas[1], [4, 2, 3, 7, 8, { cantidadDeSeries: 4, repeticionesRecomendadas: 8, pesoRecomendadoKg: null, descansoEnSegundos: 60 }]);
  assert.throws(() => controlador.modificar({ ...parametros, id: '0' }, valido, peticion), (error) => error.getStatus() === 400);
  await assert.rejects(controlador.listar(parametros, peticion), (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
});

test('HTTP y MySQL agregan ejercicios del catálogo a la rutina y el alumno ve su planificación', { timeout: 40000 }, async (t) => {
  const entorno = await prepararEntorno(t);
  const [entrenador, otroEntrenador, alumno, otroAlumno] = await Promise.all(['entrenador', 'entrenador', 'alumno', 'alumno'].map((rol) => entorno.crearCuenta(rol)));
  await entorno.vinculaciones.insert([{ alumnoId: alumno.id, entrenadorId: entrenador.id }, { alumnoId: otroAlumno.id, entrenadorId: otroEntrenador.id }]);
  const ejercicio = await crearEjercicioDePrueba(entorno);
  const cookies = [];
  for (const cuenta of [entrenador, otroEntrenador, alumno, otroAlumno]) cookies.push(await entorno.iniciarSesion(cuenta));
  const [cookieEntrenador, cookieOtroEntrenador, cookieAlumno, cookieOtroAlumno] = cookies;
  const llamar = entorno.llamar;

  // Un alumno sin plan ve una planificación vacía.
  let respuesta = await llamar('mi-planificacion', 'GET', cookieAlumno);
  assert.equal(respuesta.status, 200); assert.deepEqual(await respuesta.json(), { plan: null, rutinas: [] });
  assert.equal((await llamar('mi-planificacion', 'GET', null)).status, 401);
  assert.equal((await llamar('mi-planificacion', 'GET', cookieEntrenador)).status, 403);

  const plan = await (await llamar(`alumnos/${alumno.id}/planes`, 'POST', cookieEntrenador, { nombre: 'Plan', objetivo: 'Fuerza' })).json();
  const rutina = await (await llamar(`alumnos/${alumno.id}/planes/${plan.id}/rutinas`, 'POST', cookieEntrenador, { nombre: 'Día 1' })).json();
  const ruta = `alumnos/${alumno.id}/planes/${plan.id}/rutinas/${rutina.id}/ejercicios`;
  const entrada = { ejercicioId: ejercicio.id, cantidadDeSeries: 4, repeticionesRecomendadas: 8, pesoRecomendadoKg: 60.5, descansoEnSegundos: 90, rirRecomendado: 2 };

  for (const metodo of ['GET', 'POST']) {
    const cuerpo = metodo === 'POST' ? entrada : undefined;
    assert.equal((await llamar(ruta, metodo, null, cuerpo)).status, 401);
    assert.equal((await llamar(ruta, metodo, cookieAlumno, cuerpo)).status, 403);
    assert.equal((await llamar(ruta, metodo, cookieOtroEntrenador, cuerpo)).status, 403);
  }
  assert.equal((await llamar(ruta, 'POST', cookieEntrenador, { ...entrada, ejercicioId: 4294967295 })).status, 404);
  assert.equal((await llamar(ruta, 'POST', cookieEntrenador, { ...entrada, cantidadDeSeries: 0 })).status, 400);
  assert.deepEqual(await (await llamar(ruta, 'GET', cookieEntrenador)).json(), []);

  respuesta = await llamar(ruta, 'POST', cookieEntrenador, entrada);
  assert.equal(respuesta.status, 201);
  const agregado = await respuesta.json();
  assert.deepEqual(agregado, {
    id: agregado.id, rutinaId: rutina.id, ejercicioId: ejercicio.id, cantidadDeSeries: 4, repeticionesRecomendadas: 8, pesoRecomendadoKg: 60.5,
    descansoEnSegundos: 90, rirRecomendado: 2,
    ejercicio: { id: ejercicio.id, nombre: 'Sentadilla de prueba', parteDelCuerpo: 'Piernas', equipamiento: 'Barra', musculoObjetivo: 'Cuádriceps', instrucciones: 'Instrucciones de prueba.' },
  });
  respuesta = await llamar(`${ruta}/${agregado.id}`, 'PUT', cookieEntrenador, { cantidadDeSeries: 5, repeticionesRecomendadas: 6 });
  assert.equal(respuesta.status, 200);
  const modificado = await respuesta.json();
  assert.equal(modificado.cantidadDeSeries, 5); assert.equal(modificado.pesoRecomendadoKg, null); assert.equal(modificado.descansoEnSegundos, null);
  assert.equal((await llamar(`${ruta}/${agregado.id}`, 'PUT', cookieOtroEntrenador, { cantidadDeSeries: 5, repeticionesRecomendadas: 6 })).status, 403);
  assert.equal((await llamar(`${ruta}/99999999`, 'PUT', cookieEntrenador, { cantidadDeSeries: 5, repeticionesRecomendadas: 6 })).status, 404);

  // El alumno ve su plan, sus rutinas y los ejercicios, sin datos internos.
  respuesta = await llamar('mi-planificacion', 'GET', cookieAlumno);
  assert.deepEqual(await respuesta.json(), { plan: { id: plan.id, alumnoId: alumno.id, nombre: 'Plan', objetivo: 'Fuerza' }, rutinas: [{ id: rutina.id, planId: plan.id, nombre: 'Día 1', descripcion: null }] });
  respuesta = await llamar(`mi-planificacion/rutinas/${rutina.id}`, 'GET', cookieAlumno);
  const detalle = await respuesta.json();
  assert.equal(respuesta.status, 200);
  assert.deepEqual(detalle.rutina, { id: rutina.id, planId: plan.id, nombre: 'Día 1', descripcion: null });
  assert.deepEqual(detalle.ejercicios.map((elemento) => [elemento.id, elemento.ejercicio.nombre]), [[agregado.id, 'Sentadilla de prueba']]);
  assert.equal((await llamar(`mi-planificacion/rutinas/${rutina.id}`, 'GET', cookieOtroAlumno)).status, 404);
  assert.equal((await llamar('mi-planificacion/rutinas/0', 'GET', cookieAlumno)).status, 400);

  // Eliminar el plan retira la planificación del alumno.
  assert.equal((await llamar(`alumnos/${alumno.id}/planes/${plan.id}`, 'DELETE', cookieEntrenador)).status, 204);
  assert.deepEqual(await (await llamar('mi-planificacion', 'GET', cookieAlumno)).json(), { plan: null, rutinas: [] });
  assert.equal((await llamar(`mi-planificacion/rutinas/${rutina.id}`, 'GET', cookieAlumno)).status, 404);
});
