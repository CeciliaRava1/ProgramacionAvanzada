const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID, scrypt: derivarClave, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const datosValidos = {
  nombre: ' Nombre ', apellido: ' Apellido ',
  correo: ' ALUMNO@example.test ', contrasena: 'Clave123',
};

test('normaliza el alta y usa el rol del servidor sin devolver credenciales', async () => {
  const { RegistrarUsuario } = await import('../dist/usuarios/aplicacion/registrar-usuario.js');
  const guardados = [];
  const registrar = new RegistrarUsuario({
    buscarPorCorreoYRol: async () => null,
    guardar: async (usuario) => { guardados.push(usuario); return { ...usuario, id: 1 }; },
  }, async () => 'hash-de-prueba');

  for (const rol of ['alumno', 'entrenador']) {
    const resultado = await registrar.ejecutar({ ...datosValidos, rol: 'administrador' }, rol);
    assert.deepEqual(resultado, { id: 1, nombre: 'Nombre', apellido: 'Apellido', correo: 'alumno@example.test', rol });
    assert.deepEqual(guardados.at(-1), { nombre: 'Nombre', apellido: 'Apellido', correo: 'alumno@example.test', hashDeContrasena: 'hash-de-prueba', rol, ...(rol === 'entrenador' ? { horario: null } : {}) });
  }
});

test('rechaza nombres o correos inválidos antes de consultar o guardar', async () => {
  const { RegistrarUsuario } = await import('../dist/usuarios/aplicacion/registrar-usuario.js');
  const registrar = new RegistrarUsuario({
    buscarPorCorreoYRol: async () => assert.fail('No debe consultar con datos inválidos.'),
    guardar: async () => assert.fail('No debe guardar datos inválidos.'),
  }, async () => assert.fail('No debe calcular el hash con datos inválidos.'));

  for (const cambio of [{ nombre: ' ' }, { apellido: 'a'.repeat(101) }, { correo: 'incorrecto' }, { correo: 'a\0@example.test' }]) {
    await assert.rejects(registrar.ejecutar({ ...datosValidos, ...cambio }, 'alumno'), { name: 'Error', message: 'Revisá los datos ingresados.' });
  }
});

test('un correo existente no cambia la cuenta ni calcula otra contraseña', async () => {
  const { RegistrarUsuario } = await import('../dist/usuarios/aplicacion/registrar-usuario.js');
  const existente = { id: 1, rol: 'entrenador', hashDeContrasena: 'hash-existente' };
  const registrar = new RegistrarUsuario({
    buscarPorCorreoYRol: async (correo, rol) => { assert.equal(correo, 'alumno@example.test'); assert.equal(rol, 'entrenador'); return existente; },
    guardar: async () => assert.fail('No debe modificar la cuenta.'),
  }, async () => assert.fail('No debe calcular otro hash.'));

  await assert.rejects(registrar.ejecutar(datosValidos, 'entrenador'), /Ya existe una cuenta/);
  assert.equal(existente.rol, 'entrenador');
  assert.equal(existente.hashDeContrasena, 'hash-existente');
});

test('la entrada HTTP exige texto, limita la contraseña y rechaza campos adicionales', async () => {
  const { parsearRegistroDeUsuario } = await import('../dist/usuarios/presentacion/registrar-usuario.request.js');
  assert.deepEqual(parsearRegistroDeUsuario(datosValidos), datosValidos);
  for (const entrada of [null, [], 'texto', {}, { ...datosValidos, correo: 123 },
    { ...datosValidos, contrasena: 'a'.repeat(7) }, { ...datosValidos, contrasena: 'a'.repeat(129) },
    ...[' Clave123', 'Clave123 ', 'Clave 123', 'Clave\t123', 'Clave\n123', 'Clave 123'].map((contrasena) => ({ ...datosValidos, contrasena })),
    { ...datosValidos, rol: 'administrador' }, { ...datosValidos, hashDeContrasena: 'hash' }]) {
    assert.throws(() => parsearRegistroDeUsuario(entrada), (error) => error.getStatus() === 400);
  }
  // Los límites cuentan caracteres Unicode; la entrada válida no se modifica.
  for (const contrasena of ['Clave123', 'ñ'.repeat(8), 'a'.repeat(128)]) {
    assert.equal(parsearRegistroDeUsuario({ ...datosValidos, contrasena }).contrasena, contrasena);
  }
});

test('el horario es opcional y se elige entre mañana, tarde y noche; solo se acepta en altas de entrenadores', async () => {
  const { normalizarHorarioDeEntrenador } = await import('../dist/usuarios/dominio/usuario.js');
  const { parsearRegistroDeUsuario } = await import('../dist/usuarios/presentacion/registrar-usuario.request.js');
  const { RegistrarUsuario } = await import('../dist/usuarios/aplicacion/registrar-usuario.js');
  for (const valor of [undefined, null, []]) assert.equal(normalizarHorarioDeEntrenador(valor), null);
  assert.deepEqual(normalizarHorarioDeEntrenador(['noche', 'manana']), ['manana', 'noche']);
  assert.deepEqual(normalizarHorarioDeEntrenador(['tarde', 'tarde']), ['tarde']);
  assert.deepEqual(normalizarHorarioDeEntrenador(['noche', 'tarde', 'manana']), ['manana', 'tarde', 'noche']);
  for (const valor of ['manana', 123, {}, ['atardecer'], ['Mañana'], [1], [null]]) {
    assert.throws(() => normalizarHorarioDeEntrenador(valor), (error) => Boolean(error.erroresDeCampo.horario));
  }
  for (const valor of [null, [], ['tarde'], ['atardecer']]) {
    assert.deepEqual(parsearRegistroDeUsuario({ ...datosValidos, horario: valor }, 'entrenador').horario, valor);
  }
  for (const valor of [123, 'manana', {}, [1], [['manana']]]) {
    assert.throws(() => parsearRegistroDeUsuario({ ...datosValidos, horario: valor }, 'entrenador'), (error) => error.getStatus() === 400);
  }
  assert.throws(() => parsearRegistroDeUsuario({ ...datosValidos, horario: ['tarde'] }, 'alumno'), (error) => error.getStatus() === 400);
  const guardados = [];
  const registrar = new RegistrarUsuario({ buscarPorCorreoYRol: async () => null, guardar: async (usuario) => { guardados.push(usuario); return { ...usuario, id: 1 }; } }, async () => 'hash');
  await registrar.ejecutar({ ...datosValidos, horario: ['noche', 'tarde'] }, 'entrenador');
  assert.deepEqual(guardados[0].horario, ['tarde', 'noche']);
  await assert.rejects(registrar.ejecutar({ ...datosValidos, horario: ['atardecer'] }, 'entrenador'), { message: 'Revisá los datos ingresados.' });
});

test('scrypt genera sales diferentes y permite comprobar la contraseña original', { timeout: 15000 }, async () => {
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const primero = await hashearContrasena(datosValidos.contrasena);
  const segundo = await hashearContrasena(datosValidos.contrasena);
  assert.notEqual(primero, segundo);
  assert.ok(primero.length <= 255);
  const [algoritmo, costo, tamanoDeBloque, paralelismo, sal, hash] = primero.split('$');
  assert.equal(algoritmo, 'scrypt');
  const clave = await promisify(derivarClave)(datosValidos.contrasena, sal, 64, {
    N: Number(costo), r: Number(tamanoDeBloque), p: Number(paralelismo), maxmem: 192 * 1024 * 1024,
  });
  assert.ok(timingSafeEqual(clave, Buffer.from(hash, 'hex')));
  assert.ok(!primero.includes(datosValidos.contrasena));
});

test('oculta un fallo de persistencia en la respuesta HTTP', async () => {
  const { UsuariosController } = await import('../dist/usuarios/presentacion/usuarios.controller.js');
  const controlador = new UsuariosController({ ejecutar: async () => { throw new Error('SQL y datos internos'); } });
  await assert.rejects(controlador.registrar(datosValidos), (error) => {
    assert.equal(error.getStatus(), 500);
    assert.ok(!JSON.stringify(error.getResponse()).includes('SQL'));
    return true;
  });
});

test('HTTP y MySQL conservan cuentas, rechazan duplicados y protegen altas simultáneas', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const dataSource = app.get(DataSource);
  // correos[4] es el administrador que da de alta a los alumnos: el alta ya no es pública.
  const correos = [0, 1, 2, 3, 4].map(() => `test-${randomUUID()}@example.test`);
  t.after(async () => {
    // Solo se eliminan los registros creados por esta prueba, nunca otras cuentas.
    try {
      const creadas = await dataSource.getRepository(EsquemaDeUsuario).find({ where: correos.map((correo) => ({ correo })), select: { id: true } });
      for (const { id } of creadas) await dataSource.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(id)]);
      await dataSource.getRepository(EsquemaDeUsuario).delete(correos.map((correo) => ({ correo })));
    } finally {
      await app.close();
    }
  });
  assert.equal(await dataSource.showMigrations(), false, 'Ejecutar npm run bd:migrar antes de las pruebas.');
  assert.deepEqual(await dataSource.runMigrations({ transaction: 'each' }), []);
  const urlBase = await app.getUrl();
  await dataSource.getRepository(EsquemaDeUsuario).save({
    nombre: 'Admin', apellido: 'Prueba', correo: correos[4], hashDeContrasena: await hashearContrasena(datosValidos.contrasena), rol: 'administrador',
  });
  const inicio = await fetch(`${urlBase}/usuarios/sesion`, {
    method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: correos[4], contrasena: datosValidos.contrasena, rol: 'administrador' }),
  });
  assert.equal(inicio.status, 200);
  const cookieAdministrador = inicio.headers.getSetCookie().find((cabecera) => /Path=\/;/i.test(cabecera)).split(';')[0];
  const enviar = (cuerpo) => fetch(`${urlBase}/usuarios/alumnos`, {
    method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', Cookie: cookieAdministrador, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  assert.equal((await fetch(`${urlBase}/usuarios/alumnos`, {
    method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' }, body: JSON.stringify({ ...datosValidos, correo: correos[0] }),
  })).status, 401, 'El alta pública de alumnos ya no existe.');
  assert.equal(await dataSource.getRepository(EsquemaDeUsuario).countBy({ correo: correos[0] }), 0);

  const creada = await enviar({ ...datosValidos, correo: ` ${correos[0].toUpperCase()} ` });
  assert.equal(creada.status, 201);
  const resultado = await creada.json();
  assert.deepEqual(Object.keys(resultado).sort(), ['apellido', 'correo', 'id', 'nombre', 'rol']);
  assert.equal(resultado.correo, correos[0]);
  assert.equal(resultado.rol, 'alumno');
  const original = await dataSource.getRepository(EsquemaDeUsuario).findOneByOrFail({ correo: correos[0] });
  assert.ok(original.hashDeContrasena.startsWith('scrypt$'));
  assert.notEqual(original.hashDeContrasena, datosValidos.contrasena);

  const duplicada = await enviar({ ...datosValidos, correo: correos[0] });
  assert.equal(duplicada.status, 409);
  assert.deepEqual(await dataSource.getRepository(EsquemaDeUsuario).findOneByOrFail({ correo: correos[0] }), original);

  const invalida = await enviar({ ...datosValidos, correo: correos[1], nombre: ' ' });
  assert.equal(invalida.status, 400);
  assert.equal(await dataSource.getRepository(EsquemaDeUsuario).countBy({ correo: correos[1] }), 0);
  for (const contrasena of ['Clave12', 'Clave 123']) {
    assert.equal((await enviar({ ...datosValidos, correo: correos[1], contrasena })).status, 400);
    assert.equal(await dataSource.getRepository(EsquemaDeUsuario).countBy({ correo: correos[1] }), 0);
  }
  const conPrivilegios = await enviar({ ...datosValidos, correo: correos[1], rol: 'administrador' });
  assert.equal(conPrivilegios.status, 400);
  assert.equal(await dataSource.getRepository(EsquemaDeUsuario).countBy({ correo: correos[1] }), 0);

  const entrenador = await dataSource.getRepository(EsquemaDeUsuario).save({
    nombre: 'Entrenador', apellido: 'Prueba', correo: correos[2], hashDeContrasena: 'hash-solo-de-prueba', rol: 'entrenador',
  });
  // Un correo ya usado por un entrenador sirve para crear un alumno; repetirlo con el mismo rol es conflicto.
  assert.equal((await enviar({ ...datosValidos, correo: correos[2] })).status, 201);
  assert.equal((await enviar({ ...datosValidos, correo: correos[2] })).status, 409);
  assert.deepEqual(await dataSource.getRepository(EsquemaDeUsuario).findOneByOrFail({ correo: correos[2], rol: 'entrenador' }), entrenador);

  const simultaneas = await Promise.all([
    enviar({ ...datosValidos, correo: correos[3] }), enviar({ ...datosValidos, correo: correos[3] }),
  ]);
  assert.deepEqual(simultaneas.map((respuesta) => respuesta.status).sort(), [201, 409]);
  assert.equal(await dataSource.getRepository(EsquemaDeUsuario).countBy({ correo: correos[3] }), 1);
});

test('solo una sesión administradora puede crear entrenadores, sin alterar cuentas existentes', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { hashearContrasena, verificarContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const db = app.get(DataSource);
  const usuarios = db.getRepository(EsquemaDeUsuario);
  const correos = Array.from({ length: 6 }, () => `entrenador-test-${randomUUID()}@example.test`);
  t.after(async () => {
    try {
      const creadas = await usuarios.find({ where: correos.map((correo) => ({ correo })), select: { id: true } });
      for (const usuario of creadas) {
        await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(usuario.id)]);
        await usuarios.delete({ id: usuario.id });
      }
    } finally { await app.close(); }
  });
  const hashDeContrasena = await hashearContrasena(datosValidos.contrasena);
  const cuentas = [];
  for (const [indice, rol] of ['administrador', 'alumno', 'entrenador'].entries()) {
    cuentas.push(await usuarios.save({ nombre: 'Cuenta', apellido: 'Prueba', correo: correos[indice], hashDeContrasena, rol }));
  }
  const urlBase = await app.getUrl();
  const llamar = (ruta, metodo, cookie, cuerpo, origen = 'http://127.0.0.1:5173') => fetch(urlBase + ruta, {
    method: metodo, headers: { ...(origen ? { Origin: origen } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const iniciarSesion = async (correo, rol) => {
    const respuesta = await llamar('/usuarios/sesion', 'POST', null, { correo, contrasena: datosValidos.contrasena, rol });
    assert.equal(respuesta.status, 200);
    return respuesta.headers.getSetCookie().find((cabecera) => /Path=\/;/i.test(cabecera)).split(';')[0];
  };
  const cookies = [];
  for (const cuenta of cuentas) cookies.push(await iniciarSesion(cuenta.correo, cuenta.rol));
  const entrada = { ...datosValidos, correo: correos[3] };
  const enviar = (cookie, cuerpo = entrada, origen) => llamar('/usuarios/entrenadores', 'POST', cookie, cuerpo, origen);
  assert.equal((await enviar()).status, 401);
  assert.equal((await enviar(cookies[0], entrada, '')).status, 403);
  assert.equal((await enviar(cookies[0], entrada, 'http://otro.example')).status, 403);
  assert.equal((await enviar(cookies[0] + 'x')).status, 401);
  for (const cookie of cookies.slice(1)) assert.equal((await enviar(cookie)).status, 403);
  assert.equal(await usuarios.countBy({ correo: correos[3] }), 0);

  const respuesta = await enviar(cookies[0]);
  assert.equal(respuesta.status, 201);
  assert.equal(respuesta.headers.get('cache-control'), 'no-store');
  const resultado = await respuesta.json();
  assert.deepEqual(Object.keys(resultado).sort(), ['apellido', 'correo', 'id', 'nombre', 'rol']);
  assert.equal(resultado.rol, 'entrenador');
  assert.equal(resultado.correo, correos[3]);
  const entrenador = await usuarios.findOneByOrFail({ correo: correos[3] });
  assert.equal(await verificarContrasena(datosValidos.contrasena, entrenador.hashDeContrasena), true);
  const actual = await llamar('/usuarios/sesion', 'GET', cookies[0]);
  assert.equal((await actual.json()).id, cuentas[0].id);
  // Este es el cuarto inicio de sesión del proceso: sigue dentro del límite de intentos.
  const cookieEntrenador = await iniciarSesion(correos[3], 'entrenador');
  assert.equal((await enviar(cookieEntrenador, { ...entrada, correo: correos[4] })).status, 403);

  for (const cambios of [{ nombre: ' ' }, { contrasena: 'corta' }, { contrasena: 'Clave 123' }, { rol: 'administrador' }]) {
    assert.equal((await enviar(cookies[0], { ...entrada, correo: correos[4], ...cambios })).status, 400);
  }
  assert.equal(await usuarios.countBy({ correo: correos[4] }), 0);
  for (const cuenta of [...cuentas, entrenador]) {
    // Solo choca con otra cuenta de entrenador; con un alumno o el administrador comparte correo sin problema.
    assert.equal((await enviar(cookies[0], { ...entrada, correo: cuenta.correo })).status, cuenta.rol === 'entrenador' ? 409 : 201);
    assert.deepEqual(await usuarios.findOneByOrFail({ id: cuenta.id }), cuenta);
  }
  const simultaneas = await Promise.all([enviar(cookies[0], { ...entrada, correo: correos[5] }), enviar(cookies[0], { ...entrada, correo: correos[5] })]);
  assert.deepEqual(simultaneas.map((respuesta) => respuesta.status).sort(), [201, 409]);
  assert.equal(await usuarios.countBy({ correo: correos[5] }), 1);

  await usuarios.update({ id: cuentas[0].id }, { rol: 'alumno' });
  assert.equal((await enviar(cookies[0], { ...entrada, correo: correos[4] })).status, 403);
  assert.equal((await llamar('/usuarios/sesion', 'DELETE', cookies[0])).status, 204);
  assert.equal((await enviar(cookies[0], { ...entrada, correo: correos[4] })).status, 401);
  assert.equal(await usuarios.countBy({ correo: correos[4] }), 0);
});
