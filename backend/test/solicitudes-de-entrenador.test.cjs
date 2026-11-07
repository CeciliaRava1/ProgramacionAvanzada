const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('solo se crea una solicitud si el alumno no tiene una pendiente ni entrenador', async () => {
  const { crearSolicitudDeEntrenador, SolicitudEnConflictoError } = await import('../dist/usuarios/dominio/solicitud-de-entrenador.js');
  assert.deepEqual(crearSolicitudDeEntrenador(1, 2, null, null), { alumnoId: 1, entrenadorId: 2, estado: 'pendiente' });
  assert.throws(() => crearSolicitudDeEntrenador(1, 2, { alumnoId: 1, entrenadorId: 3 }, null), SolicitudEnConflictoError);
  assert.throws(() => crearSolicitudDeEntrenador(1, 2, null, { alumnoId: 1, entrenadorId: 3, estado: 'pendiente' }), SolicitudEnConflictoError);
});

test('solo los participantes pueden responder y una solicitud resuelta no vuelve a cambiar', async () => {
  const { responderSolicitudDeEntrenador, SolicitudSinPermisoError, SolicitudEnConflictoError } = await import('../dist/usuarios/dominio/solicitud-de-entrenador.js');
  const pendiente = { id: 1, alumnoId: 2, entrenadorId: 3, estado: 'pendiente' };
  for (const estado of ['aceptada', 'rechazada', 'cancelada']) {
    assert.equal(responderSolicitudDeEntrenador(pendiente, 3, estado).estado, estado);
    assert.throws(() => responderSolicitudDeEntrenador(pendiente, 9, estado), SolicitudSinPermisoError);
    assert.throws(() => responderSolicitudDeEntrenador({ ...pendiente, estado: 'aceptada' }, 3, estado), SolicitudEnConflictoError);
  }
  assert.equal(responderSolicitudDeEntrenador(pendiente, 2, 'cancelada').estado, 'cancelada');
  for (const estado of ['aceptada', 'rechazada']) assert.throws(() => responderSolicitudDeEntrenador(pendiente, 2, estado), SolicitudSinPermisoError);
  assert.equal(pendiente.estado, 'pendiente');
});

test('el estado y la bandeja entregan solo los datos públicos necesarios', async () => {
  const { SolicitudesDeEntrenador } = await import('../dist/usuarios/aplicacion/solicitudes-de-entrenador.js');
  const usuario = { id: 7, nombre: 'Entrenador', apellido: 'Prueba', rol: 'entrenador', correo: 'privado@example.test', hashDeContrasena: 'hash', horario: null };
  let vinculacion = null, pendiente = null;
  const solicitudes = new SolicitudesDeEntrenador({ buscarPorId: async () => usuario }, {
    conAlumno: async (_id, accion) => accion({ buscarVinculacion: async () => vinculacion, buscarPendiente: async () => pendiente }),
    buscarPendientesDelEntrenador: async () => [{ id: 9, alumnoId: 1, entrenadorId: 7, nombre: 'Alumno', apellido: 'Prueba', hashDeContrasena: 'no devolver' }],
  });
  assert.deepEqual(await solicitudes.actual(1), { estado: 'sin_asignar' });
  pendiente = { id: 9, alumnoId: 1, entrenadorId: 7, estado: 'pendiente' };
  const entrenadorPublico = { id: 7, nombre: 'Entrenador', apellido: 'Prueba', horario: [] };
  assert.deepEqual(await solicitudes.actual(1), { estado: 'pendiente', solicitudId: 9, entrenador: entrenadorPublico });
  vinculacion = { alumnoId: 1, entrenadorId: 7 };
  assert.deepEqual(await solicitudes.actual(1), { estado: 'asignado', entrenador: entrenadorPublico });
  assert.deepEqual(await solicitudes.recibidas(7), [{ id: 9, alumno: { id: 1, nombre: 'Alumno', apellido: 'Prueba' } }]);
  // Un entrenador dado de baja no se ofrece ni se muestra.
  const dadoDeBaja = new SolicitudesDeEntrenador({ buscarPorId: async () => ({ ...usuario, fechaBaja: new Date() }) }, {});
  await assert.rejects(dadoDeBaja.enviar(1, 7), /El entrenador no existe/);
});

test('el controlador valida identificadores, toma el alumno de la sesión y oculta fallos internos', async () => {
  const { SolicitudesDeEntrenadorController } = await import('../dist/usuarios/presentacion/solicitudes-de-entrenador.controller.js');
  const llamadas = [];
  const controlador = new SolicitudesDeEntrenadorController({ enviar: async (...argumentos) => { llamadas.push(argumentos); return {}; }, actual: async () => { throw new Error('SQL y credenciales'); } });
  for (const cuerpo of [null, [], {}, { profesorId: 2 }, { entrenadorId: '1' }, { entrenadorId: 0 }, { entrenadorId: 1.2 }, { entrenadorId: 2, alumnoId: 8 }, { entrenadorId: 2, estado: 'aceptada' }]) {
    assert.throws(() => controlador.enviar(cuerpo, { session: { usuarioId: 1 } }), (error) => error.getStatus() === 400);
  }
  await controlador.enviar({ entrenadorId: 2 }, { session: { usuarioId: 1 } });
  assert.deepEqual(llamadas, [[1, 2]]);
  for (const id of ['x', '-1', '1.2', '4294967296']) assert.throws(() => controlador.aceptar(id, { session: { usuarioId: 2 } }), (error) => error.getStatus() === 400);
  await assert.rejects(controlador.actual({ session: { usuarioId: 1 } }), (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
});

test('HTTP y MySQL protegen solicitudes, participación, concurrencia y persistencia del vínculo', { timeout: 45000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { EsquemaDeSolicitud, EsquemaDeVinculacion } = await import('../dist/usuarios/infraestructura/repositorio-de-solicitudes-typeorm.js');
  const { RepositorioDeSolicitudes } = await import('../dist/usuarios/dominio/repositorio-de-solicitudes.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const iniciar = async () => { const instancia = await NestFactory.create(AppModule, { logger: false, abortOnError: false }); await instancia.listen(0, '127.0.0.1'); return instancia; };
  let app = await iniciar(), db = app.get(DataSource);
  let usuarios = db.getRepository(EsquemaDeUsuario), solicitudes = db.getRepository(EsquemaDeSolicitud), vinculaciones = db.getRepository(EsquemaDeVinculacion);
  const cuentas = [], correos = Array.from({ length: 5 }, () => `solicitudes-test-${randomUUID()}@example.test`);
  t.after(async () => {
    try {
      for (const cuenta of cuentas.filter((cuenta) => cuenta.rol === 'alumno')) {
        await vinculaciones.delete({ alumnoId: cuenta.id });
        await solicitudes.delete({ alumnoId: cuenta.id });
      }
      for (const cuenta of cuentas) {
        await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(cuenta.id)]);
        await usuarios.delete({ id: cuenta.id });
      }
    } finally { await app.close(); }
  });
  const contrasena = 'Clave123', hashDeContrasena = await hashearContrasena(contrasena);
  for (const [indice, rol] of ['alumno', 'alumno', 'entrenador', 'entrenador', 'administrador'].entries()) {
    cuentas.push(await usuarios.save({ nombre: 'Cuenta', apellido: 'Prueba', correo: correos[indice], rol, hashDeContrasena }));
  }
  const [alumno, otroAlumno, entrenador, otroEntrenador] = cuentas;
  const llamar = async (ruta, metodo = 'GET', cookie, cuerpo, origen = 'http://127.0.0.1:5173') => fetch((await app.getUrl()) + '/usuarios/' + ruta, {
    method: metodo, headers: { Origin: origen, ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  const cookies = [];
  for (const cuenta of cuentas) {
    const respuesta = await llamar('sesion', 'POST', null, { correo: cuenta.correo, contrasena, rol: cuenta.rol });
    assert.equal(respuesta.status, 200);
    await respuesta.arrayBuffer();
    cookies.push(respuesta.headers.getSetCookie().find((cabecera) => /Path=\/;/i.test(cabecera)).split(';')[0]);
  }
  const [cookieAlumno, cookieOtroAlumno, cookieEntrenador, cookieOtroEntrenador, cookieAdministrador] = cookies;
  const raiz = 'solicitudes-de-entrenador';
  const estado = async () => { const respuesta = await llamar(raiz + '/actual', 'GET', cookieAlumno); assert.equal(respuesta.status, 200); return respuesta.json(); };
  const enviar = (cookie = cookieAlumno, entrenadorId = entrenador.id) => llamar(raiz, 'POST', cookie, { entrenadorId });
  const responder = (id, accion, cookie) => llamar(raiz + '/' + id + (accion === 'cancelar' ? '' : '/' + accion), accion === 'cancelar' ? 'DELETE' : 'POST', cookie);
  for (const [ruta, metodo, cuerpo] of [[raiz + '/actual', 'GET'], [raiz, 'GET'], [raiz, 'POST', { entrenadorId: entrenador.id }], [raiz + '/1/aceptar', 'POST'], [raiz + '/1/rechazar', 'POST'], [raiz + '/1', 'DELETE']]) {
    assert.equal((await llamar(ruta, metodo, null, cuerpo)).status, 401);
  }
  assert.equal((await llamar(raiz + '/actual', 'GET', cookieEntrenador)).status, 403);
  assert.equal((await llamar(raiz, 'GET', cookieAlumno)).status, 403);
  assert.equal((await enviar(cookieEntrenador)).status, 403);
  assert.equal((await enviar(cookieAdministrador)).status, 403);
  assert.equal((await llamar(raiz, 'POST', cookieAlumno, { entrenadorId: entrenador.id }, 'http://otro.example')).status, 403);
  for (const cuerpo of [{ entrenadorId: '1' }, { entrenadorId: 0 }, { entrenadorId: entrenador.id, alumnoId: otroAlumno.id }]) assert.equal((await llamar(raiz, 'POST', cookieAlumno, cuerpo)).status, 400);
  assert.equal((await enviar(cookieAlumno, otroAlumno.id)).status, 404);
  assert.deepEqual(await estado(), { estado: 'sin_asignar' });

  // Un error después de insertar el vínculo debe revertir también esa inserción.
  await assert.rejects(app.get(RepositorioDeSolicitudes).conAlumno(alumno.id, async (transaccion) => {
    await transaccion.guardarVinculacion({ alumnoId: alumno.id, entrenadorId: entrenador.id });
    await transaccion.guardarSolicitud({ alumnoId: alumno.id, entrenadorId: entrenador.id, estado: 'invalido' });
  }));
  assert.equal(await vinculaciones.countBy({ alumnoId: alumno.id }), 0);
  assert.equal(await solicitudes.countBy({ alumnoId: alumno.id }), 0);

  let respuesta = await enviar();
  assert.equal(respuesta.status, 201);
  const primera = await respuesta.json();
  assert.deepEqual(Object.keys(primera).sort(), ['entrenadorId', 'estado', 'id']);
  assert.equal(primera.estado, 'pendiente');
  assert.equal((await estado()).solicitudId, primera.id);
  for (const destino of [entrenador.id, otroEntrenador.id]) assert.equal((await enviar(cookieAlumno, destino)).status, 409);
  for (const cookie of [cookieOtroAlumno, cookieOtroEntrenador]) assert.equal((await responder(primera.id, 'cancelar', cookie)).status, 403);
  assert.equal((await responder(primera.id, 'aceptar', cookieOtroEntrenador)).status, 403);
  assert.equal((await responder(primera.id, 'rechazar', cookieOtroEntrenador)).status, 403);
  assert.equal((await responder(primera.id, 'aceptar', cookieAlumno)).status, 403);
  const recibidas = await llamar(raiz, 'GET', cookieEntrenador);
  const solicitudPropia = (await recibidas.json()).find((solicitud) => solicitud.id === primera.id);
  assert.deepEqual(solicitudPropia, { id: primera.id, alumno: { id: alumno.id, nombre: 'Cuenta', apellido: 'Prueba' } });
  assert.ok(!(await (await llamar(raiz, 'GET', cookieOtroEntrenador)).json()).some((solicitud) => solicitud.id === primera.id));
  assert.equal((await responder(primera.id, 'cancelar', cookieAlumno)).status, 204);
  assert.equal((await solicitudes.findOneByOrFail({ id: primera.id })).estado, 'cancelada');
  assert.deepEqual(await estado(), { estado: 'sin_asignar' });
  assert.equal((await responder(primera.id, 'aceptar', cookieEntrenador)).status, 409);
  assert.equal((await responder(4_294_967_295, 'cancelar', cookieAlumno)).status, 404);

  for (const accion of ['cancelar', 'rechazar']) {
    const solicitud = await (await enviar()).json();
    assert.equal((await responder(solicitud.id, accion, cookieEntrenador)).status, 204);
    assert.equal((await solicitudes.findOneByOrFail({ id: solicitud.id })).estado, accion === 'cancelar' ? 'cancelada' : 'rechazada');
    assert.deepEqual(await estado(), { estado: 'sin_asignar' });
  }
  const simultaneas = await Promise.all([enviar(cookieAlumno, entrenador.id), enviar(cookieAlumno, otroEntrenador.id)]);
  assert.deepEqual(simultaneas.map((respuesta) => respuesta.status).sort(), [201, 409]);
  const soloPendientes = await solicitudes.find({ where: { alumnoId: alumno.id, estado: 'pendiente' } });
  assert.equal(soloPendientes.length, 1);
  assert.equal((await responder(soloPendientes[0].id, 'cancelar', cookieAlumno)).status, 204);

  const enCarrera = await (await enviar()).json();
  const carrera = await Promise.all([responder(enCarrera.id, 'aceptar', cookieEntrenador), responder(enCarrera.id, 'cancelar', cookieAlumno)]);
  assert.deepEqual(carrera.map((respuesta) => respuesta.status).sort(), [204, 409]);
  const registroDeCarrera = await solicitudes.findOneByOrFail({ id: enCarrera.id });
  assert.equal(await vinculaciones.countBy({ alumnoId: alumno.id }), registroDeCarrera.estado === 'aceptada' ? 1 : 0);

  const final = await (await enviar(cookieOtroAlumno, otroEntrenador.id)).json();
  const aceptaciones = await Promise.all([responder(final.id, 'aceptar', cookieOtroEntrenador), responder(final.id, 'aceptar', cookieOtroEntrenador)]);
  assert.deepEqual(aceptaciones.map((respuesta) => respuesta.status).sort(), [204, 409]);
  assert.equal(await vinculaciones.countBy({ alumnoId: otroAlumno.id }), 1);
  for (const cookie of [cookieOtroAlumno, cookieOtroEntrenador]) assert.equal((await responder(final.id, 'cancelar', cookie)).status, 409);
  assert.equal((await enviar(cookieOtroAlumno, entrenador.id)).status, 409);
  const asignado = await (await llamar(raiz + '/actual', 'GET', cookieOtroAlumno)).json();
  assert.equal(asignado.estado, 'asignado');
  assert.equal(asignado.entrenador.id, otroEntrenador.id);
  assert.deepEqual(Object.keys(asignado.entrenador).sort(), ['apellido', 'horario', 'id', 'nombre']);

  await app.close();
  app = await iniciar(); db = app.get(DataSource);
  usuarios = db.getRepository(EsquemaDeUsuario); solicitudes = db.getRepository(EsquemaDeSolicitud); vinculaciones = db.getRepository(EsquemaDeVinculacion);
  const restaurado = await llamar(raiz + '/actual', 'GET', cookieOtroAlumno);
  assert.equal(restaurado.status, 200);
  assert.deepEqual(await restaurado.json(), asignado);
});
