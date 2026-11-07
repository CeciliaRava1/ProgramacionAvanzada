const assert = require('node:assert/strict');
const { test } = require('node:test');
const { prepararEntorno } = require('./ayuda-de-planes.cjs');

test('el plan normaliza nombre y objetivo y valida sus límites sin categorías cerradas', async () => {
  const { crearPlanDeEntrenamiento, DatosDePlanInvalidosError } = await import('../dist/planes/dominio/plan-de-entrenamiento.js');
  assert.deepEqual(crearPlanDeEntrenamiento(1, ' PLAN DE FUERZA ', ' Salud\ny bienestar '), { alumnoId: 1, nombre: 'PLAN DE FUERZA', objetivo: 'Salud\ny bienestar' });
  for (const [nombre, objetivo, campo] of [[' ', 'Salud', 'nombre'], ['x'.repeat(201), 'Salud', 'nombre'], ['Plan', '', 'objetivo'], ['Plan', 'x'.repeat(5001), 'objetivo']]) {
    assert.throws(() => crearPlanDeEntrenamiento(1, nombre, objetivo), (error) => error instanceof DatosDePlanInvalidosError && Boolean(error.erroresDeCampo[campo]));
  }
  assert.equal([...crearPlanDeEntrenamiento(1, '\u{10400}'.repeat(200), 'x'.repeat(5000)).nombre].length, 200);
});

test('los casos de uso autorizan antes de consultar o guardar y devuelven solo datos del plan', async () => {
  const { GestionarPlanes, AccesoAPlanDenegadoError } = await import('../dist/planes/aplicacion/gestionar-planes.js');
  const { PlanYaExisteError } = await import('../dist/planes/dominio/plan-de-entrenamiento.js');
  let vinculacion = { alumnoId: 2, entrenadorId: 1 }, lecturas = 0, escrituras = 0;
  const guardado = { id: 3, alumnoId: 2, nombre: 'Plan', objetivo: 'Salud' };
  const servicio = new GestionarPlanes({
    guardar: async (entrada) => { escrituras++; assert.deepEqual(entrada, { alumnoId: 2, nombre: 'Plan', objetivo: 'Salud' }); return { ...guardado, privado: 'no devolver' }; },
    buscarPorAlumno: async (id) => { lecturas++; assert.equal(id, 2); return escrituras ? [{ ...guardado, privado: 'no devolver' }] : []; },
  }, { buscarVinculacion: async (id) => { assert.equal(id, 2); return vinculacion; } });
  assert.deepEqual(await servicio.crear(1, 2, { nombre: ' Plan ', objetivo: ' Salud ' }), guardado);
  assert.deepEqual(await servicio.listar(1, 2), [guardado]);
  await assert.rejects(servicio.crear(1, 2, { nombre: 'Otro', objetivo: 'Otro' }), PlanYaExisteError);
  for (vinculacion of [null, { alumnoId: 2, entrenadorId: 9 }]) {
    await assert.rejects(servicio.listar(1, 2), AccesoAPlanDenegadoError);
    await assert.rejects(servicio.crear(1, 2, { nombre: 'Plan', objetivo: 'Salud' }), AccesoAPlanDenegadoError);
  }
  assert.equal(lecturas, 3); assert.equal(escrituras, 1);
});

test('editar y eliminar autorizan primero, conservan el identificador y distinguen planes no disponibles', async () => {
  const { GestionarPlanes, AccesoAPlanDenegadoError } = await import('../dist/planes/aplicacion/gestionar-planes.js');
  const { PlanNoEncontradoError, DatosDePlanInvalidosError } = await import('../dist/planes/dominio/plan-de-entrenamiento.js');
  let entrenadorId = 1, disponible = true;
  const llamadas = [];
  const servicio = new GestionarPlanes({
    modificar: async (...argumentos) => { llamadas.push(['modificar', ...argumentos]); return disponible ? { id: 3, alumnoId: 2, ...argumentos[2], fechaBaja: null } : null; },
    eliminar: async (...argumentos) => { llamadas.push(['eliminar', ...argumentos]); return disponible; },
  }, { buscarVinculacion: async () => ({ alumnoId: 2, entrenadorId }) });
  assert.deepEqual(await servicio.modificar(1, 2, 3, { nombre: ' Plan editado ', objetivo: ' Salud ' }), { id: 3, alumnoId: 2, nombre: 'Plan editado', objetivo: 'Salud' });
  await servicio.eliminar(1, 2, 3);
  assert.deepEqual(llamadas, [['modificar', 3, 2, { nombre: 'Plan editado', objetivo: 'Salud' }], ['eliminar', 3, 2]]);
  entrenadorId = 9;
  await assert.rejects(servicio.modificar(1, 2, 3, { nombre: 'Plan', objetivo: 'Salud' }), AccesoAPlanDenegadoError);
  await assert.rejects(servicio.eliminar(1, 2, 3), AccesoAPlanDenegadoError);
  assert.equal(llamadas.length, 2);
  entrenadorId = 1;
  await assert.rejects(servicio.modificar(1, 2, 3, { nombre: ' ', objetivo: 'Salud' }), DatosDePlanInvalidosError);
  assert.equal(llamadas.length, 2);
  disponible = false;
  await assert.rejects(servicio.modificar(1, 2, 3, { nombre: 'Plan', objetivo: 'Salud' }), PlanNoEncontradoError);
  await assert.rejects(servicio.eliminar(1, 2, 3), PlanNoEncontradoError);
});

test('el controlador valida formato, ignora identidades externas y no expone errores internos', async () => {
  const { PlanesController } = await import('../dist/planes/presentacion/planes.controller.js');
  const { DatosDePlanInvalidosError, PlanYaExisteError, PlanNoEncontradoError } = await import('../dist/planes/dominio/plan-de-entrenamiento.js');
  const { AccesoAPlanDenegadoError } = await import('../dist/planes/aplicacion/gestionar-planes.js');
  const llamadas = [];
  const controlador = new PlanesController({
    crear: async (...argumentos) => { llamadas.push(argumentos); },
    modificar: async (...argumentos) => { llamadas.push(argumentos); },
    eliminar: async (...argumentos) => { llamadas.push(argumentos); },
    listar: async () => { throw new Error('SQL y credenciales'); },
  });
  const peticion = { session: { usuarioId: 4 }, query: { entrenadorId: 9 } };
  for (const id of ['x', '-1', '0', '1.2', '4294967296']) assert.throws(() => controlador.listar(id, peticion), (error) => error.getStatus() === 400);
  for (const cuerpo of [null, [], {}, { nombre: 2, objetivo: 'Salud' }, { nombre: 'Plan', objetivo: null }, { nombre: 'Plan', objetivo: 'Salud', entrenadorId: 9 }]) {
    assert.throws(() => controlador.crear('2', cuerpo, peticion), (error) => error.getStatus() === 400);
  }
  await controlador.crear('2', { nombre: 'Plan', objetivo: 'Salud' }, peticion);
  await controlador.modificar('2', '3', { nombre: 'Plan', objetivo: 'Salud' }, peticion);
  await controlador.eliminar('2', '3', peticion);
  assert.deepEqual(llamadas, [[4, 2, { nombre: 'Plan', objetivo: 'Salud' }], [4, 2, 3, { nombre: 'Plan', objetivo: 'Salud' }], [4, 2, 3]]);
  assert.throws(() => controlador.modificar('2', 'x', { nombre: 'Plan', objetivo: 'Salud' }, peticion), (error) => error.getStatus() === 400);
  assert.throws(() => controlador.eliminar('0', '3', peticion), (error) => error.getStatus() === 400);
  await assert.rejects(controlador.listar('2', peticion), (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
  for (const [falla, codigo] of [[new AccesoAPlanDenegadoError('Sin permiso'), 403], [new DatosDePlanInvalidosError({ nombre: 'Inválido' }), 400], [new PlanYaExisteError(), 409], [new PlanNoEncontradoError(), 404]]) {
    await assert.rejects(new PlanesController({ listar: async () => { throw falla; } }).listar('2', peticion), (error) => error.getStatus() === codigo);
  }
});

test('HTTP y MySQL crean, editan y eliminan planes, restringen el acceso y permiten reemplazar sin reactivar', { timeout: 40000 }, async (t) => {
  const entorno = await prepararEntorno(t);
  const { EsquemaDePlan } = await import('../dist/planes/infraestructura/repositorio-de-planes-typeorm.js');
  const planes = entorno.db.getRepository(EsquemaDePlan);
  const [entrenador, otroEntrenador, alumno, otroAlumno, administrador] = await Promise.all(['entrenador', 'entrenador', 'alumno', 'alumno', 'administrador'].map((rol) => entorno.crearCuenta(rol)));
  await entorno.vinculaciones.insert([{ alumnoId: alumno.id, entrenadorId: entrenador.id }, { alumnoId: otroAlumno.id, entrenadorId: otroEntrenador.id }]);
  const cookies = [];
  for (const cuenta of [entrenador, otroEntrenador, alumno, administrador]) cookies.push(await entorno.iniciarSesion(cuenta));
  const [cookieEntrenador, cookieOtroEntrenador, cookieAlumno, cookieAdministrador] = cookies;
  const llamar = entorno.llamar;
  const ruta = `alumnos/${alumno.id}/planes`, entrada = { nombre: ' PLAN DE FUERZA ', objetivo: ' Salud y bienestar ' };

  for (const metodo of ['GET', 'POST']) {
    const cuerpo = metodo === 'POST' ? entrada : undefined;
    assert.equal((await llamar(ruta, metodo, null, cuerpo)).status, 401);
    for (const cookie of [cookieOtroEntrenador, cookieAlumno, cookieAdministrador]) assert.equal((await llamar(ruta, metodo, cookie, cuerpo)).status, 403);
  }
  assert.equal((await llamar(ruta, 'POST', cookieEntrenador, entrada, 'http://otro.example')).status, 403);
  assert.equal((await llamar('alumnos/4294967295/planes', 'GET', cookieEntrenador)).status, 403);
  for (const cuerpo of [{ ...entrada, alumnoId: otroAlumno.id }, { ...entrada, rutinas: [] }, { nombre: ' ', objetivo: 'Salud' }, { nombre: 'x'.repeat(201), objetivo: 'Salud' }, { nombre: 'Plan', objetivo: 'x'.repeat(5001) }]) {
    assert.equal((await llamar(ruta, 'POST', cookieEntrenador, cuerpo)).status, 400);
  }
  assert.equal(await planes.countBy({ alumnoId: alumno.id }), 0);
  let respuesta = await llamar(ruta, 'GET', cookieEntrenador);
  assert.equal(respuesta.status, 200); assert.equal(respuesta.headers.get('cache-control'), 'no-store'); assert.deepEqual(await respuesta.json(), []);
  respuesta = await llamar(ruta, 'POST', cookieEntrenador, entrada);
  assert.equal(respuesta.status, 201);
  const guardado = await respuesta.json();
  assert.deepEqual(guardado, { id: guardado.id, alumnoId: alumno.id, nombre: 'PLAN DE FUERZA', objetivo: 'Salud y bienestar' });
  assert.equal((await llamar(ruta, 'POST', cookieEntrenador, { nombre: 'No reemplazar', objetivo: 'Otro objetivo' })).status, 409);

  const destino = `${ruta}/${guardado.id}`;
  for (const metodo of ['PUT', 'DELETE']) {
    const cuerpo = metodo === 'PUT' ? { nombre: 'Plan', objetivo: 'Salud' } : undefined;
    assert.equal((await llamar(destino, metodo, null, cuerpo)).status, 401);
    for (const cookie of [cookieOtroEntrenador, cookieAlumno, cookieAdministrador]) assert.equal((await llamar(destino, metodo, cookie, cuerpo)).status, 403);
    assert.equal((await llamar(`alumnos/${otroAlumno.id}/planes/${guardado.id}`, metodo, cookieOtroEntrenador, cuerpo)).status, 404);
  }
  assert.equal((await llamar(destino, 'PUT', cookieEntrenador, { nombre: ' ', objetivo: 'Salud' })).status, 400);
  assert.equal((await llamar(destino, 'PUT', cookieEntrenador, { nombre: 'Plan', objetivo: 'Salud', alumnoId: otroAlumno.id })).status, 400);
  const editado = { ...guardado, nombre: 'Plan editado', objetivo: 'Objetivo editado' };
  respuesta = await llamar(destino, 'PUT', cookieEntrenador, { nombre: ' Plan editado ', objetivo: ' Objetivo editado ' });
  assert.equal(respuesta.status, 200); assert.deepEqual(await respuesta.json(), editado);
  assert.deepEqual(await (await llamar(ruta, 'GET', cookieEntrenador)).json(), [editado]);

  assert.equal((await llamar(destino, 'DELETE', cookieEntrenador)).status, 204);
  assert.deepEqual(await (await llamar(ruta, 'GET', cookieEntrenador)).json(), []);
  const archivado = await planes.createQueryBuilder('plan').withDeleted().addSelect('plan.fechaBaja').where('plan.id = :id', { id: guardado.id }).getOneOrFail();
  assert.equal(archivado.nombre, editado.nombre); assert.ok(archivado.fechaBaja instanceof Date);
  const reemplazos = await Promise.all([llamar(ruta, 'POST', cookieEntrenador, entrada), llamar(ruta, 'POST', cookieEntrenador, entrada)]);
  assert.deepEqual(reemplazos.map((r) => r.status).sort(), [201, 409]);
  const reemplazo = await reemplazos.find((r) => r.status === 201).json();
  assert.notEqual(reemplazo.id, guardado.id);
  assert.equal((await llamar(destino, 'PUT', cookieEntrenador, { nombre: 'No reactivar', objetivo: 'No reactivar' })).status, 404);
  assert.equal((await llamar(destino, 'DELETE', cookieEntrenador)).status, 404);
  assert.deepEqual(await (await llamar(ruta, 'GET', cookieEntrenador)).json(), [reemplazo]);
  await assert.rejects(entorno.db.query('INSERT INTO planes_de_entrenamiento (alumno_id, nombre, objetivo) VALUES (?, ?, ?)', [alumno.id, 'Duplicado', 'No guardar']),
    (error) => error.code === 'ER_DUP_ENTRY');

  await entorno.vinculaciones.delete({ alumnoId: alumno.id });
  assert.equal((await llamar(ruta, 'GET', cookieEntrenador)).status, 403);
  assert.equal((await llamar(ruta, 'POST', cookieEntrenador, entrada)).status, 403);
  assert.equal(await planes.countBy({ alumnoId: alumno.id }), 1);
});
