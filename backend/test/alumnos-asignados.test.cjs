const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('la consulta usa el entrenador recibido y devuelve solo la identidad pública del alumno', async () => {
  const { ListarAlumnosAsignados } = await import('../dist/usuarios/aplicacion/listar-alumnos-asignados.js');
  const llamadas = [];
  const listar = new ListarAlumnosAsignados({ buscarAlumnosAsignados: async (id) => {
    llamadas.push(id);
    return [{ id: 8, nombre: 'Alumno', apellido: 'Prueba', correo: 'privado@example.test', hashDeContrasena: 'no devolver' }];
  } });
  assert.deepEqual(await listar.ejecutar(4), [{ id: 8, nombre: 'Alumno', apellido: 'Prueba' }]);
  assert.deepEqual(llamadas, [4]);
  assert.deepEqual(await new ListarAlumnosAsignados({ buscarAlumnosAsignados: async () => [] }).ejecutar(4), []);
});

test('el controlador obtiene el entrenador de la sesión y oculta fallos internos', async () => {
  const { UsuariosController } = await import('../dist/usuarios/presentacion/usuarios.controller.js');
  let entrenadorId;
  const controlador = new UsuariosController({}, {}, { ejecutar: async (id) => { entrenadorId = id; return []; } });
  assert.deepEqual(await controlador.alumnos({ session: { usuarioId: 4 }, query: { entrenadorId: 9 } }), []);
  assert.equal(entrenadorId, 4);
  const fallido = new UsuariosController({}, {}, { ejecutar: async () => { throw new Error('SQL y credenciales'); } });
  await assert.rejects(fallido.alumnos({ session: { usuarioId: 4 } }),
    (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
});

test('HTTP y MySQL muestran solo alumnos vinculados al entrenador de la sesión', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { SolicitudesDeEntrenador } = await import('../dist/usuarios/aplicacion/solicitudes-de-entrenador.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { EsquemaDeSolicitud, EsquemaDeVinculacion } = await import('../dist/usuarios/infraestructura/repositorio-de-solicitudes-typeorm.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const db = app.get(DataSource), usuarios = db.getRepository(EsquemaDeUsuario);
  const cuentas = [];
  t.after(async () => {
    try {
      for (const cuenta of cuentas.filter((cuenta) => cuenta.rol === 'alumno')) {
        await db.getRepository(EsquemaDeVinculacion).delete({ alumnoId: cuenta.id });
        await db.getRepository(EsquemaDeSolicitud).delete({ alumnoId: cuenta.id });
      }
      for (const cuenta of cuentas) {
        await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(cuenta.id)]);
        await usuarios.delete({ id: cuenta.id });
      }
    } finally { await app.close(); }
  });
  const contrasena = 'Clave123', hashDeContrasena = await hashearContrasena(contrasena);
  for (const [rol, apellido] of [['entrenador', 'Uno'], ['entrenador', 'Dos'], ['alumno', 'Zeta'], ['alumno', 'Alfa'], ['alumno', 'Ajeno'], ['alumno', 'Pendiente'], ['administrador', 'Admin']]) {
    cuentas.push(await usuarios.save({ nombre: 'Prueba', apellido, correo: `alumnos-asignados-test-${randomUUID()}@example.test`, rol, hashDeContrasena }));
  }
  const [entrenador, otroEntrenador, alumno, segundoAlumno, otroAlumno, alumnoPendiente, administrador] = cuentas;
  const llamar = (ruta, cookie, metodo = 'GET', cuerpo) => fetch(`http://127.0.0.1:${app.getHttpServer().address().port}/usuarios/${ruta}`, {
    method: metodo, headers: { Origin: 'http://127.0.0.1:5173', ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  const cookies = [];
  for (const cuenta of [entrenador, otroEntrenador, alumno, administrador]) {
    const respuesta = await llamar('sesion', null, 'POST', { correo: cuenta.correo, contrasena, rol: cuenta.rol });
    assert.equal(respuesta.status, 200);
    await respuesta.arrayBuffer();
    cookies.push(respuesta.headers.getSetCookie().find((cabecera) => /Path=\/;/i.test(cabecera)).split(';')[0]);
  }
  const [cookieEntrenador, cookieOtroEntrenador, cookieAlumno, cookieAdministrador] = cookies;
  assert.equal((await llamar('alumnos')).status, 401);
  for (const cookie of [cookieAlumno, cookieAdministrador]) assert.equal((await llamar('alumnos', cookie)).status, 403);
  let respuesta = await llamar('alumnos', cookieEntrenador);
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await respuesta.json(), []);

  respuesta = await llamar('solicitudes-de-entrenador', cookieAlumno, 'POST', { entrenadorId: entrenador.id });
  assert.equal(respuesta.status, 201);
  const primeraSolicitud = await respuesta.json();
  assert.deepEqual(await (await llamar('alumnos', cookieEntrenador)).json(), []);
  assert.equal((await llamar(`solicitudes-de-entrenador/${primeraSolicitud.id}/aceptar`, cookieEntrenador, 'POST')).status, 204);
  const alumnoPublico = (cuenta) => ({ id: cuenta.id, nombre: cuenta.nombre, apellido: cuenta.apellido });
  assert.deepEqual(await (await llamar('alumnos', cookieEntrenador)).json(), [alumnoPublico(alumno)]);

  const solicitudes = app.get(SolicitudesDeEntrenador);
  for (const [cuenta, destinatario, cookie] of [[segundoAlumno, entrenador, cookieEntrenador], [otroAlumno, otroEntrenador, cookieOtroEntrenador]]) {
    const solicitud = await solicitudes.enviar(cuenta.id, destinatario.id);
    assert.equal((await llamar(`solicitudes-de-entrenador/${solicitud.id}/aceptar`, cookie, 'POST')).status, 204);
  }
  for (const accion of ['rechazar', 'cancelar']) {
    const solicitud = await solicitudes.enviar(alumnoPendiente.id, entrenador.id);
    assert.equal((await llamar(`solicitudes-de-entrenador/${solicitud.id}${accion === 'cancelar' ? '' : '/' + accion}`, cookieEntrenador, accion === 'cancelar' ? 'DELETE' : 'POST')).status, 204);
  }
  await solicitudes.enviar(alumnoPendiente.id, entrenador.id);
  const esperados = [alumnoPublico(segundoAlumno), alumnoPublico(alumno)];
  assert.deepEqual(await (await llamar('alumnos', cookieEntrenador)).json(), esperados);
  assert.deepEqual(await (await llamar(`alumnos?entrenadorId=${otroEntrenador.id}`, cookieEntrenador)).json(), esperados);
  assert.deepEqual(await (await llamar('alumnos', cookieOtroEntrenador)).json(), [alumnoPublico(otroAlumno)]);
});
