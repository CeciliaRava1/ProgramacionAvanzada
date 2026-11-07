const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('el listado entrega solo los datos públicos y contempla que no haya entrenadores', async () => {
  const { ListarEntrenadores } = await import('../dist/usuarios/aplicacion/listar-entrenadores.js');
  const entrada = { id: 1, nombre: 'Nombre', apellido: 'Apellido', rol: 'entrenador', correo: 'privado@example.test', hashDeContrasena: 'hash', horario: ['tarde'] };
  const listar = new ListarEntrenadores({ buscarEntrenadores: async () => [entrada, { ...entrada, id: 2, horario: undefined }, { ...entrada, id: 3, horario: null }] });
  assert.deepEqual(await listar.ejecutar(), [
    { id: 1, nombre: 'Nombre', apellido: 'Apellido', horario: ['tarde'] },
    { id: 2, nombre: 'Nombre', apellido: 'Apellido', horario: [] },
    { id: 3, nombre: 'Nombre', apellido: 'Apellido', horario: [] },
  ]);
  assert.deepEqual(await new ListarEntrenadores({ buscarEntrenadores: async () => [] }).ejecutar(), []);
});

test('la guardia consulta el rol actual y deniega rutas sin un rol declarado', async () => {
  const { Reflector } = await import('@nestjs/core');
  const { GuardiaDeRol, RequerirRol } = await import('../dist/usuarios/presentacion/guardia-de-rol.js');
  const manejador = () => {};
  Reflect.defineMetadata(RequerirRol.KEY, 'alumno', manejador);
  let usuario = { id: 1, rol: 'alumno' };
  const guardia = new GuardiaDeRol({ buscarPorId: async () => usuario }, new Reflector());
  const contexto = (usuarioId = 1, objetivo = manejador) => ({ switchToHttp: () => ({ getRequest: () => ({ session: { usuarioId } }) }), getHandler: () => objetivo });
  assert.equal(await guardia.canActivate(contexto()), true);
  for (const rol of ['entrenador', 'administrador']) {
    usuario = { id: 1, rol };
    await assert.rejects(guardia.canActivate(contexto()), (error) => error.getStatus() === 403);
  }
  usuario = { id: 1, rol: 'alumno' };
  await assert.rejects(guardia.canActivate(contexto(1, () => {})), (error) => error.getStatus() === 403);
  await assert.rejects(guardia.canActivate(contexto(0)), (error) => error.getStatus() === 401);
  usuario = null;
  await assert.rejects(guardia.canActivate(contexto()), (error) => error.getStatus() === 401);
  usuario = { id: 1, rol: 'alumno', fechaBaja: new Date() };
  await assert.rejects(guardia.canActivate(contexto()), (error) => error.getStatus() === 401);
});

test('un fallo al consultar entrenadores no devuelve detalles internos', async () => {
  const { UsuariosController } = await import('../dist/usuarios/presentacion/usuarios.controller.js');
  const controlador = new UsuariosController({}, { ejecutar: async () => { throw new Error('SQL y credenciales'); } });
  await assert.rejects(controlador.entrenadores(), (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
});

test('HTTP y MySQL permiten consultar entrenadores solo a alumnos y conservan el horario opcional', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const db = app.get(DataSource);
  const usuarios = db.getRepository(EsquemaDeUsuario);
  const correos = Array.from({ length: 8 }, () => `entrenadores-test-${randomUUID()}@example.test`);
  const cuentas = [];
  t.after(async () => {
    try {
      const creadas = await usuarios.find({ where: correos.map((correo) => ({ correo })), select: { id: true } });
      for (const id of new Set([...creadas, ...cuentas].map((usuario) => usuario.id))) {
        await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(id)]);
        await usuarios.delete({ id });
      }
    } finally { await app.close(); }
  });
  const contrasena = 'Clave123';
  const hashDeContrasena = await hashearContrasena(contrasena);
  for (const [indice, rol] of ['administrador', 'alumno', 'entrenador'].entries()) {
    cuentas.push(await usuarios.save({ nombre: 'Cuenta', apellido: 'Prueba', correo: correos[indice], rol, hashDeContrasena }));
  }
  await assert.rejects(usuarios.insert({ nombre: 'Cuenta', apellido: 'Rol anterior', correo: correos[7], rol: 'teacher', hashDeContrasena }), error => error.driverError?.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
  const urlBase = await app.getUrl();
  const llamar = (ruta, metodo, cookie, cuerpo) => fetch(urlBase + ruta, {
    method: metodo, headers: { Origin: 'http://127.0.0.1:5173', ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const cookies = [];
  for (const cuenta of cuentas) {
    const respuesta = await llamar('/usuarios/sesion', 'POST', null, { correo: cuenta.correo, contrasena });
    assert.equal(respuesta.status, 200);
    cookies.push(respuesta.headers.getSetCookie().find((cabecera) => /Path=\/;/i.test(cabecera)).split(';')[0]);
  }
  assert.equal((await llamar('/usuarios/entrenadores', 'GET')).status, 401);
  assert.equal((await llamar('/usuarios/profesores', 'GET', cookies[1])).status, 404);
  assert.equal((await llamar('/usuarios/entrenadores', 'GET', cookies[1] + 'x')).status, 401);
  for (const cookie of [cookies[0], cookies[2]]) assert.equal((await llamar('/usuarios/entrenadores', 'GET', cookie)).status, 403);
  // Los turnos se guardan sin repetidos y en el orden mañana, tarde, noche.
  const datosDelEntrenador = { nombre: 'Entrenador', apellido: 'Listado', correo: correos[3], contrasena, horario: ['noche', 'manana', 'manana'] };
  assert.equal((await llamar('/usuarios/entrenadores', 'POST', cookies[0], datosDelEntrenador)).status, 201);
  const entrenadorCreado = await usuarios.findOneByOrFail({ correo: correos[3] });
  assert.deepEqual(entrenadorCreado.horario, ['manana', 'noche']);
  for (const [desplazamiento, horario] of [undefined, [], null].entries()) {
    const entrada = { ...datosDelEntrenador, correo: correos[4 + desplazamiento] };
    if (horario === undefined) delete entrada.horario;
    else entrada.horario = horario;
    assert.equal((await llamar('/usuarios/entrenadores', 'POST', cookies[0], entrada)).status, 201);
    assert.equal((await usuarios.findOneByOrFail({ correo: entrada.correo })).horario, null);
  }
  for (const horario of [123, 'manana', [1], ['atardecer'], ['manana', 'Tarde']]) {
    const invalida = await llamar('/usuarios/entrenadores', 'POST', cookies[0], { ...datosDelEntrenador, correo: correos[7], horario });
    assert.equal(invalida.status, 400);
    assert.ok((await invalida.json()).erroresDeCampo.horario);
  }
  // El alta de alumnos es solo del administrador y no admite horario.
  assert.equal((await llamar('/usuarios/alumnos', 'POST', null, { ...datosDelEntrenador, correo: correos[7] })).status, 401);
  assert.equal((await llamar('/usuarios/alumnos', 'POST', cookies[0], { ...datosDelEntrenador, correo: correos[7] })).status, 400);
  assert.equal(await usuarios.countBy({ correo: correos[7] }), 0);

  const respuesta = await llamar('/usuarios/entrenadores', 'GET', cookies[1]);
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get('cache-control'), 'no-store');
  const lista = await respuesta.json();
  assert.ok(lista.some((entrenador) => entrenador.id === entrenadorCreado.id && JSON.stringify(entrenador.horario) === '["manana","noche"]'));
  assert.ok(lista.some((entrenador) => entrenador.id === cuentas[2].id && entrenador.horario.length === 0));
  const idsEsperados = (await usuarios.find({ where: correos.map((correo) => ({ correo, rol: 'entrenador' })), order: { apellido: 'ASC', nombre: 'ASC', id: 'ASC' } })).map((entrenador) => entrenador.id);
  assert.deepEqual(lista.filter((entrenador) => idsEsperados.includes(entrenador.id)).map((entrenador) => entrenador.id), idsEsperados);
  assert.ok(!lista.some((entrenador) => [cuentas[0].id, cuentas[1].id].includes(entrenador.id)));
  for (const entrenador of lista) assert.deepEqual(Object.keys(entrenador).sort(), ['apellido', 'horario', 'id', 'nombre']);
  await usuarios.update({ id: cuentas[1].id }, { rol: 'entrenador' });
  assert.equal((await llamar('/usuarios/entrenadores', 'GET', cookies[1])).status, 403);
  await usuarios.delete({ id: cuentas[1].id });
  assert.equal((await llamar('/usuarios/entrenadores', 'GET', cookies[1])).status, 401);
});
