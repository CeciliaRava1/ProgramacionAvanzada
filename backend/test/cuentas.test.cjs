const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

const datosValidos = { nombre: ' Nombre ', apellido: ' Apellido ', correo: ' NUEVO@example.test ' };

test('el servicio entrega solo datos públicos de la cuenta e identifica la baja', async () => {
  const { GestionarCuentas } = await import('../dist/usuarios/aplicacion/gestionar-cuentas.js');
  const base = { nombre: 'Ana', apellido: 'Paz', correo: 'ana@example.test', hashDeContrasena: 'secreto' };
  const cuentas = new GestionarCuentas({
    buscarPorRol: async (rol) => rol === 'entrenador'
      ? [{ ...base, id: 1, rol: rol, horario: ['manana'] }, { ...base, id: 2, rol: rol, horario: null, fechaBaja: new Date() }]
      : [{ ...base, id: 3, rol: rol, horario: undefined }],
  });
  assert.deepEqual(await cuentas.listar('entrenador'), [
    { id: 1, nombre: 'Ana', apellido: 'Paz', correo: 'ana@example.test', activa: true, horario: ['manana'] },
    { id: 2, nombre: 'Ana', apellido: 'Paz', correo: 'ana@example.test', activa: false, horario: [] },
  ]);
  // Los alumnos no tienen horario y nunca se expone el hash.
  assert.deepEqual(await cuentas.listar('alumno'), [{ id: 3, nombre: 'Ana', apellido: 'Paz', correo: 'ana@example.test', activa: true }]);
});

test('modificar valida antes de consultar, normaliza y distingue cuentas inexistentes o dadas de baja', async () => {
  const { GestionarCuentas, CuentaNoEncontradaError, CuentaDadaDeBajaError } = await import('../dist/usuarios/aplicacion/gestionar-cuentas.js');
  let actual = { id: 5, rol: 'entrenador', nombre: 'A', apellido: 'B', correo: 'a@example.test', hashDeContrasena: 'x' };
  const llamadas = [];
  const repositorio = {
    buscarPorId: async () => actual,
    modificar: async (id, rol, cambios) => { llamadas.push([id, rol, cambios]); return { ...actual, ...cambios, id }; },
  };
  const cuentas = new GestionarCuentas(repositorio);

  const guardada = await cuentas.modificar('entrenador', 5, { ...datosValidos, horario: ['noche', 'manana'] });
  assert.deepEqual(llamadas[0], [5, 'entrenador', { nombre: 'Nombre', apellido: 'Apellido', correo: 'nuevo@example.test', horario: ['manana', 'noche'] }]);
  assert.deepEqual(guardada, { id: 5, nombre: 'Nombre', apellido: 'Apellido', correo: 'nuevo@example.test', activa: true, horario: ['manana', 'noche'] });
  // Reemplazo: omitir el horario lo deja sin turnos.
  await cuentas.modificar('entrenador', 5, datosValidos);
  assert.equal(llamadas[1][2].horario, null);

  // Un alumno nunca recibe horario aunque llegue en la entrada.
  actual = { ...actual, rol: 'alumno' };
  await cuentas.modificar('alumno', 5, { ...datosValidos, horario: ['manana'] });
  assert.equal('horario' in llamadas[2][2], false);

  const estricto = new GestionarCuentas({ buscarPorId: async () => assert.fail('No debe consultar con datos inválidos.') });
  for (const cambio of [{ nombre: ' ' }, { correo: 'incorrecto' }, { horario: ['atardecer'] }]) {
    await assert.rejects(estricto.modificar('entrenador', 5, { ...datosValidos, ...cambio }), { message: 'Revisá los datos ingresados.' });
  }

  for (const usuario of [null, { id: 5, rol: 'administrador' }, { id: 5, rol: 'alumno' }]) {
    await assert.rejects(new GestionarCuentas({ buscarPorId: async () => usuario }).modificar('entrenador', 5, datosValidos), CuentaNoEncontradaError);
  }
  const dadaDeBaja = new GestionarCuentas({
    buscarPorId: async () => ({ ...actual, rol: 'entrenador', fechaBaja: new Date() }),
    modificar: async () => assert.fail('No debe modificar una baja.'),
  });
  await assert.rejects(dadaDeBaja.modificar('entrenador', 5, datosValidos), CuentaDadaDeBajaError);
  const concurrente = new GestionarCuentas({ buscarPorId: async () => ({ ...actual, rol: 'entrenador' }), modificar: async () => null });
  await assert.rejects(concurrente.modificar('entrenador', 5, datosValidos), CuentaDadaDeBajaError);
});

test('dar de baja informa si la cuenta no existe', async () => {
  const { GestionarCuentas, CuentaNoEncontradaError } = await import('../dist/usuarios/aplicacion/gestionar-cuentas.js');
  const vistas = [];
  const cuentas = new GestionarCuentas({ darDeBaja: async (id, rol) => { vistas.push([id, rol]); return id === 1; } });
  await cuentas.darDeBaja('alumno', 1);
  assert.deepEqual(vistas, [[1, 'alumno']]);
  await assert.rejects(cuentas.darDeBaja('entrenador', 2), CuentaNoEncontradaError);
});

test('la entrada HTTP de modificación acepta solo los campos permitidos para cada rol', async () => {
  const { parsearModificacionDeCuenta } = await import('../dist/usuarios/presentacion/modificar-cuenta.request.js');
  assert.deepEqual(parsearModificacionDeCuenta(datosValidos, 'alumno'), datosValidos);
  assert.deepEqual(parsearModificacionDeCuenta({ ...datosValidos, horario: ['manana'] }, 'entrenador'), { ...datosValidos, horario: ['manana'] });
  assert.equal(parsearModificacionDeCuenta({ ...datosValidos, horario: null }, 'entrenador').horario, null);
  for (const [entrada, rol] of [
    [null, 'alumno'], [[], 'alumno'], [{}, 'alumno'], [{ ...datosValidos, correo: 1 }, 'alumno'],
    [{ ...datosValidos, rol: 'administrador' }, 'alumno'], [{ ...datosValidos, contrasena: 'Clave123' }, 'entrenador'], [{ ...datosValidos, id: 4 }, 'entrenador'],
    [{ ...datosValidos, horario: ['manana'] }, 'alumno'], [{ ...datosValidos, horario: 'manana' }, 'entrenador'], [{ ...datosValidos, horario: [1] }, 'entrenador'],
  ]) {
    assert.throws(() => parsearModificacionDeCuenta(entrada, rol), (error) => error.getStatus() === 400);
  }
});

test('el controlador valida el tipo de cuenta y el identificador y oculta fallos internos', async () => {
  const { CuentasController } = await import('../dist/usuarios/presentacion/cuentas.controller.js');
  const fallo = async () => { throw new Error('SQL y credenciales'); };
  const controlador = new CuentasController({ listar: fallo, modificar: fallo, darDeBaja: fallo });
  await assert.rejects(controlador.listar('administradores'), (error) => error.getStatus() === 404);
  await assert.rejects(controlador.modificar('teachers', '1', datosValidos), (error) => error.getStatus() === 404);
  for (const id of ['x', '0', '-1', '1.5', '4294967296']) {
    await assert.rejects(controlador.darDeBaja('alumnos', id), (error) => error.getStatus() === 400);
  }
  for (const accion of [() => controlador.listar('alumnos'), () => controlador.modificar('alumnos', '1', datosValidos), () => controlador.darDeBaja('alumnos', '1')]) {
    await assert.rejects(accion(), (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
  }
});

test('HTTP y MySQL permiten al administrador consultar, modificar y dar de baja alumnos y entrenadores', { timeout: 90000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { EsquemaDeSolicitud, EsquemaDeVinculacion } = await import('../dist/usuarios/infraestructura/repositorio-de-solicitudes-typeorm.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const db = app.get(DataSource);
  const usuarios = db.getRepository(EsquemaDeUsuario), solicitudes = db.getRepository(EsquemaDeSolicitud), vinculaciones = db.getRepository(EsquemaDeVinculacion);
  const correos = Array.from({ length: 8 }, () => `cuentas-test-${randomUUID()}@example.test`);
  t.after(async () => {
    try {
      const creadas = await usuarios.find({ where: correos.map((correo) => ({ correo })), select: { id: true } });
      for (const { id } of creadas) {
        await vinculaciones.delete({ alumnoId: id }); await vinculaciones.delete({ entrenadorId: id });
        await solicitudes.delete({ alumnoId: id }); await solicitudes.delete({ entrenadorId: id });
        await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(id)]);
        await usuarios.delete({ id });
      }
    } finally { await app.close(); }
  });
  const contrasena = 'Clave123', hashDeContrasena = await hashearContrasena(contrasena);
  const cuentas = [];
  for (const [indice, rol] of ['administrador', 'alumno', 'alumno', 'entrenador', 'entrenador'].entries()) {
    cuentas.push(await usuarios.save({ nombre: 'Cuenta', apellido: 'Prueba', correo: correos[indice], rol: rol, hashDeContrasena: hashDeContrasena }));
  }
  const [administrador, alumno, otroAlumno, entrenador, otroEntrenador] = cuentas;
  const urlBase = await app.getUrl();
  const llamar = (ruta, metodo = 'GET', cookie, cuerpo, origen = 'http://127.0.0.1:5173') => fetch(urlBase + '/usuarios/' + ruta, {
    method: metodo, headers: { Origin: origen, ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  // El inicio de sesión admite 5 intentos por minuto: esta prueba usa 4 sesiones y 1 intento rechazado.
  const iniciarSesion = async (correo, rol) => {
    const respuesta = await llamar('sesion', 'POST', null, { correo, contrasena, rol });
    await respuesta.arrayBuffer();
    if (respuesta.status !== 200) return { estado: respuesta.status, cookie: null };
    return { estado: 200, cookie: respuesta.headers.getSetCookie().find((cabecera) => /Path=\/;/i.test(cabecera)).split(';')[0] };
  };
  const sesiones = await Promise.all(cuentas.slice(0, 4).map((cuenta) => iniciarSesion(cuenta.correo, cuenta.rol)));
  assert.deepEqual(sesiones.map((sesion) => sesion.estado), [200, 200, 200, 200]);
  const [cookieAdministrador, cookieAlumno, cookieOtroAlumno, cookieEntrenador] = sesiones.map((sesion) => sesion.cookie);

  // Solo el administrador entra, con sesión y origen válidos.
  for (const [ruta, metodo, cuerpo] of [['administrador/alumnos', 'GET'], ['administrador/entrenadores', 'GET'], [`administrador/alumnos/${alumno.id}`, 'PUT', datosValidos], [`administrador/entrenadores/${entrenador.id}`, 'DELETE']]) {
    assert.equal((await llamar(ruta, metodo, null, cuerpo)).status, 401, `${metodo} ${ruta} sin sesión`);
    for (const cookie of [cookieAlumno, cookieEntrenador]) assert.equal((await llamar(ruta, metodo, cookie, cuerpo)).status, 403, `${metodo} ${ruta} sin permiso`);
    if (metodo !== 'GET') assert.equal((await llamar(ruta, metodo, cookieAdministrador, cuerpo, 'http://otro.example')).status, 403, `${metodo} ${ruta} con otro origen`);
  }
  assert.equal((await llamar('administrador/profesores', 'GET', cookieAdministrador)).status, 404);

  // Consulta: contacto, estado y horario solo de entrenadores; nunca el hash.
  let respuesta = await llamar('administrador/alumnos', 'GET', cookieAdministrador);
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get('cache-control'), 'no-store');
  const alumnos = await respuesta.json();
  assert.deepEqual(alumnos.find((item) => item.id === alumno.id), { id: alumno.id, nombre: 'Cuenta', apellido: 'Prueba', correo: alumno.correo, activa: true });
  assert.ok(!alumnos.some((item) => [administrador.id, entrenador.id].includes(item.id)));
  const entrenadores = await (await llamar('administrador/entrenadores', 'GET', cookieAdministrador)).json();
  assert.deepEqual(entrenadores.find((item) => item.id === entrenador.id), { id: entrenador.id, nombre: 'Cuenta', apellido: 'Prueba', correo: entrenador.correo, activa: true, horario: [] });
  assert.ok(!JSON.stringify([...alumnos, ...entrenadores]).includes('hashDeContrasena'));

  // Modificación de un entrenador con varios turnos.
  const correoNuevo = `cuentas-test-${randomUUID()}@example.test`;
  correos.push(correoNuevo);
  respuesta = await llamar(`administrador/entrenadores/${entrenador.id}`, 'PUT', cookieAdministrador, { nombre: ' Laura ', apellido: 'Gómez', correo: correoNuevo.toUpperCase(), horario: ['noche', 'manana'] });
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { id: entrenador.id, nombre: 'Laura', apellido: 'Gómez', correo: correoNuevo, activa: true, horario: ['manana', 'noche'] });
  const guardado = await usuarios.findOneByOrFail({ id: entrenador.id });
  assert.deepEqual(guardado.horario, ['manana', 'noche']);
  assert.equal(guardado.hashDeContrasena, hashDeContrasena, 'La contraseña y el rol no cambian.');
  assert.equal(guardado.rol, 'entrenador');
  // Sin horario en la entrada, el horario queda vacío.
  respuesta = await llamar(`administrador/entrenadores/${entrenador.id}`, 'PUT', cookieAdministrador, { nombre: 'Laura', apellido: 'Gómez', correo: correoNuevo });
  assert.deepEqual((await respuesta.json()).horario, []);
  assert.equal((await usuarios.findOneByOrFail({ id: entrenador.id })).horario, null);
  // La sesión abierta del entrenador ya muestra el correo nuevo.
  assert.equal((await (await llamar('sesion', 'GET', cookieEntrenador)).json()).correo, correoNuevo);

  // Rechazos de la modificación.
  const modificar = (ruta, cuerpo) => llamar(ruta, 'PUT', cookieAdministrador, cuerpo);
  const antes = await usuarios.findOneByOrFail({ id: alumno.id });
  assert.equal((await modificar(`administrador/alumnos/${alumno.id}`, { ...datosValidos, correo: otroAlumno.correo })).status, 409);
  // El mismo correo puede tener una cuenta de cada rol: solo choca con una del mismo rol.
  assert.equal((await modificar(`administrador/entrenadores/${entrenador.id}`, { ...datosValidos, correo: otroEntrenador.correo })).status, 409);
  for (const cuerpo of [{ ...datosValidos, nombre: ' ' }, { ...datosValidos, correo: 'incorrecto' }, { ...datosValidos, rol: 'administrador' }, { ...datosValidos, contrasena: 'Clave123' }, { ...datosValidos, horario: ['manana'] }]) {
    assert.equal((await modificar(`administrador/alumnos/${alumno.id}`, cuerpo)).status, 400);
  }
  assert.equal((await modificar(`administrador/entrenadores/${entrenador.id}`, { ...datosValidos, horario: ['atardecer'] })).status, 400);
  assert.equal((await modificar(`administrador/entrenadores/${entrenador.id}`, { ...datosValidos, horario: 'manana' })).status, 400);
  assert.deepEqual(await usuarios.findOneByOrFail({ id: alumno.id }), antes, 'Un rechazo no cambia la cuenta.');
  assert.equal((await modificar('administrador/alumnos/4294967295', datosValidos)).status, 404);
  assert.equal((await modificar(`administrador/entrenadores/${alumno.id}`, datosValidos)).status, 404, 'No se modifica una cuenta de otro rol.');
  assert.equal((await modificar(`administrador/alumnos/${administrador.id}`, datosValidos)).status, 404, 'No se modifican administradores.');
  assert.equal((await llamar('administrador/alumnos/abc', 'DELETE', cookieAdministrador)).status, 400);
  assert.equal((await llamar(`administrador/alumnos/${administrador.id}`, 'DELETE', cookieAdministrador)).status, 404);

  // Alta de alumno solo por el administrador.
  const correoDelAlta = `cuentas-test-${randomUUID()}@example.test`;
  correos.push(correoDelAlta);
  const alumnoNuevo = { nombre: 'Nuevo', apellido: 'Alumno', correo: correoDelAlta, contrasena };
  assert.equal((await llamar('alumnos', 'POST', null, alumnoNuevo)).status, 401);
  for (const cookie of [cookieAlumno, cookieEntrenador]) assert.equal((await llamar('alumnos', 'POST', cookie, alumnoNuevo)).status, 403);
  assert.equal((await llamar('alumnos', 'POST', cookieAdministrador, alumnoNuevo)).status, 201);
  assert.equal(await usuarios.countBy({ correo: correoDelAlta }), 1);

  // Vinculaciones: alumno con entrenador (aceptada) y otroAlumno con otroEntrenador (pendiente).
  const solicitar = async (cookie, idEntrenador) => {
    const enviada = await llamar('solicitudes-de-entrenador', 'POST', cookie, { entrenadorId: idEntrenador });
    assert.equal(enviada.status, 201);
    return (await enviada.json()).id;
  };
  const aceptar = async (cookie, id) => assert.equal((await llamar(`solicitudes-de-entrenador/${id}/aceptar`, 'POST', cookie)).status, 204);
  await aceptar(cookieEntrenador, await solicitar(cookieAlumno, entrenador.id));
  const idPendiente = await solicitar(cookieOtroAlumno, otroEntrenador.id);
  assert.equal(await vinculaciones.countBy({ alumnoId: alumno.id }), 1);

  // Baja de un alumno vinculado: pierde el acceso y el entrenador deja de verlo.
  assert.ok((await (await llamar('alumnos', 'GET', cookieEntrenador)).json()).some((item) => item.id === alumno.id));
  assert.equal((await llamar(`administrador/alumnos/${alumno.id}`, 'DELETE', cookieAdministrador)).status, 204);
  const dadoDeBaja = await usuarios.findOneByOrFail({ id: alumno.id });
  assert.ok(dadoDeBaja.fechaBaja instanceof Date, 'La baja es lógica: la cuenta se conserva.');
  assert.equal(dadoDeBaja.nombre, 'Cuenta');
  assert.equal(await vinculaciones.countBy({ alumnoId: alumno.id }), 0);
  assert.equal((await llamar('sesion', 'GET', cookieAlumno)).status, 401, 'La sesión abierta deja de ser válida.');
  assert.equal((await iniciarSesion(alumno.correo, 'alumno')).estado, 401, 'No puede iniciar sesión.');
  assert.ok(!(await (await llamar('alumnos', 'GET', cookieEntrenador)).json()).some((item) => item.id === alumno.id));
  assert.equal((await modificar(`administrador/alumnos/${alumno.id}`, datosValidos)).status, 409, 'Una baja no se modifica.');
  assert.equal((await llamar(`administrador/alumnos/${alumno.id}`, 'DELETE', cookieAdministrador)).status, 204, 'Repetir la baja no falla.');
  assert.equal((await usuarios.findOneByOrFail({ id: alumno.id })).fechaBaja.getTime(), dadoDeBaja.fechaBaja.getTime());
  assert.equal((await (await llamar('administrador/alumnos', 'GET', cookieAdministrador)).json()).find((item) => item.id === alumno.id).activa, false);

  // Baja de un entrenador con una solicitud pendiente: la solicitud se cancela y deja de ofrecerse.
  assert.ok((await (await llamar('entrenadores', 'GET', cookieOtroAlumno)).json()).some((item) => item.id === otroEntrenador.id));
  assert.equal((await llamar(`administrador/entrenadores/${otroEntrenador.id}`, 'DELETE', cookieAdministrador)).status, 204);
  assert.equal((await solicitudes.findOneByOrFail({ id: idPendiente })).estado, 'cancelada');
  assert.ok(!(await (await llamar('entrenadores', 'GET', cookieOtroAlumno)).json()).some((item) => item.id === otroEntrenador.id));
  assert.deepEqual(await (await llamar('solicitudes-de-entrenador/actual', 'GET', cookieOtroAlumno)).json(), { estado: 'sin_asignar' });
  assert.equal((await llamar('solicitudes-de-entrenador', 'POST', cookieOtroAlumno, { entrenadorId: otroEntrenador.id })).status, 404, 'No se solicita a un entrenador dado de baja.');

  // Baja de un entrenador con un alumno vinculado: se finaliza la vinculación y el alumno conserva su cuenta.
  await aceptar(cookieEntrenador, await solicitar(cookieOtroAlumno, entrenador.id));
  assert.equal(await vinculaciones.countBy({ alumnoId: otroAlumno.id }), 1);
  assert.equal((await llamar(`administrador/entrenadores/${entrenador.id}`, 'DELETE', cookieAdministrador)).status, 204);
  assert.equal(await vinculaciones.countBy({ alumnoId: otroAlumno.id }), 0);
  assert.equal((await llamar('sesion', 'GET', cookieEntrenador)).status, 401, 'La sesión del entrenador dado de baja deja de ser válida.');
  assert.equal((await llamar('sesion', 'GET', cookieOtroAlumno)).status, 200);
  assert.deepEqual(await (await llamar('solicitudes-de-entrenador/actual', 'GET', cookieOtroAlumno)).json(), { estado: 'sin_asignar' });
  assert.equal((await usuarios.findOneByOrFail({ id: otroAlumno.id })).fechaBaja, null);
  assert.equal((await llamar('administrador/entrenadores/4294967295', 'DELETE', cookieAdministrador)).status, 404);
});
