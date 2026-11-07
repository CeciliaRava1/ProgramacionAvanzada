const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID, createHash } = require('node:crypto');

test('el caso de uso normaliza el correo y solo devuelve datos públicos', async () => {
  const { IniciarSesion } = await import('../dist/usuarios/aplicacion/iniciar-sesion.js');
  const usuario = { id: 1, nombre: 'Nombre', apellido: 'Apellido', correo: 'alumno@example.test', rol: 'entrenador', hashDeContrasena: 'hash' };
  const iniciarSesion = new IniciarSesion({ buscarPorCorreo: async (correo) => { assert.equal(correo, usuario.correo); return usuario; } }, async (contrasena, hash) => contrasena === 'Clave123' && hash === 'hash');
  const resultado = await iniciarSesion.ejecutar(' ALUMNO@example.test ', 'Clave123');
  assert.equal(resultado.rol, 'entrenador');
  assert.equal('hashDeContrasena' in resultado, false);
  await assert.rejects(iniciarSesion.ejecutar(usuario.correo, 'incorrecta'), /Correo o contraseña incorrectos/);
  const inexistente = new IniciarSesion({ buscarPorCorreo: async () => null }, async (_contrasena, hash) => { assert.equal(hash, undefined); return false; });
  await assert.rejects(inexistente.ejecutar(usuario.correo, 'Clave123'), /Correo o contraseña incorrectos/);
  const dadaDeBaja = new IniciarSesion({ buscarPorCorreo: async () => ({ ...usuario, fechaBaja: new Date() }) }, async () => true);
  await assert.rejects(dadaDeBaja.ejecutar(usuario.correo, 'Clave123'), /Correo o contraseña incorrectos/);
});

test('verifica hashes existentes, conserva contraseñas antiguas con espacios y rechaza hashes malformados', { timeout: 15000 }, async () => {
  const { hashearContrasena, verificarContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const contrasena = ' una contraseña anterior ';
  const hash = await hashearContrasena(contrasena);
  assert.equal(await verificarContrasena(contrasena, hash), true);
  assert.equal(await verificarContrasena(contrasena.trim(), hash), false);
  assert.equal(await verificarContrasena(contrasena, 'scrypt$999999999$8$1$sal$hash'), false);
  assert.equal(await verificarContrasena(contrasena), false);
});

test('no configura sesiones con un secreto ausente o débil', async () => {
  const { crearMiddlewareDeSesion } = await import('../dist/usuarios/presentacion/middleware-de-sesion.js');
  for (const secreto of [undefined, '', 'corto']) {
    assert.throws(() => crearMiddlewareDeSesion({ get: () => secreto }, {}), /SECRETO_DE_SESION/);
  }
});

test('la sesión persiste, se renueva, rota, vence y se invalida al cerrar', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { EsquemaDeSesion, DURACION_DE_SESION_MS } = await import('../dist/usuarios/infraestructura/almacen-de-sesiones.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const iniciar = async () => {
    const instancia = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    await instancia.listen(0, '127.0.0.1');
    return instancia;
  };
  let app = await iniciar();
  let usuario;
  t.after(async () => {
    try {
      if (usuario) {
        const db = app.get(DataSource);
        // Solo se limpian sesiones y cuenta de este caso de prueba.
        await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(usuario.id)]);
        await db.getRepository(EsquemaDeUsuario).delete({ id: usuario.id });
      }
    } finally { await app.close(); }
  });
  let db = app.get(DataSource);
  const correo = 'sesion-test-' + randomUUID() + '@example.test';
  usuario = await db.getRepository(EsquemaDeUsuario).save({ nombre: 'Nombre', apellido: 'Prueba', correo, rol: 'alumno', hashDeContrasena: await hashearContrasena('Clave123') });
  const llamar = async (metodo, cookie, cuerpo, origen = 'http://127.0.0.1:5173') => fetch((await app.getUrl()) + '/usuarios/sesion', {
    method: metodo, headers: { Origin: origen, ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const iniciarSesion = (cookie) => llamar('POST', cookie, { correo, contrasena: 'Clave123' });
  const cookieDe = (respuesta) => {
    const cabecera = respuesta.headers.getSetCookie().find((cabecera) => /Path=\/;/i.test(cabecera));
    assert.ok(cabecera);
    assert.match(cabecera, /HttpOnly/i);
    assert.match(cabecera, /SameSite=Strict/i);
    assert.match(cabecera, /Path=\/;/i);
    const vence = new Date(cabecera.match(/Expires=([^;]+)/i)[1]).getTime();
    assert.ok(vence - Date.now() > DURACION_DE_SESION_MS - 60000);
    return cabecera.split(';')[0];
  };
  const identificadorYHash = (cookie) => {
    const firmado = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));
    const id = firmado.slice(2, firmado.lastIndexOf('.'));
    return { id, hash: createHash('sha256').update(id).digest('hex') };
  };

  const anonima = await llamar('GET');
  assert.equal(anonima.status, 401);
  assert.equal(anonima.headers.get('set-cookie'), null);
  assert.equal((await llamar('POST', null, { correo, contrasena: 'Clave123' }, 'http://otro.example')).status, 403);
  for (const cuerpo of [{ correo, contrasena: 'incorrecta' }, { correo: 'inexistente-' + correo, contrasena: 'Clave123' }]) {
    const respuesta = await llamar('POST', null, cuerpo);
    assert.equal(respuesta.status, 401);
    assert.equal((await respuesta.json()).message, 'Correo o contraseña incorrectos');
    assert.equal(respuesta.headers.get('set-cookie'), null);
  }
  assert.equal((await llamar('POST', null, { correo, contrasena: 'Clave123', rol: 'administrador' })).status, 400);
  const respuesta = await iniciarSesion();
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get('cache-control'), 'no-store');
  const usuarioPublico = await respuesta.json();
  assert.deepEqual(Object.keys(usuarioPublico).sort(), ['apellido', 'correo', 'id', 'nombre', 'rol']);
  const cookieOriginal = cookieDe(respuesta);
  const original = identificadorYHash(cookieOriginal);
  let registro = await db.getRepository(EsquemaDeSesion).findOneByOrFail({ hashDeId: original.hash });
  assert.equal(registro.datos.usuarioId, usuario.id);
  assert.ok(!JSON.stringify(registro).includes(original.id));
  assert.ok(!JSON.stringify(registro).includes(usuario.hashDeContrasena));

  await db.getRepository(EsquemaDeSesion).update({ hashDeId: original.hash }, { venceEn: new Date(Date.now() + 86400000) });
  const renovada = await llamar('GET', cookieOriginal);
  assert.equal(renovada.status, 200);
  assert.deepEqual(await renovada.json(), usuarioPublico);
  cookieDe(renovada);
  registro = await db.getRepository(EsquemaDeSesion).findOneByOrFail({ hashDeId: original.hash });
  assert.ok(registro.venceEn.getTime() - Date.now() > DURACION_DE_SESION_MS - 60000);
  const rotada = await iniciarSesion(cookieOriginal);
  assert.equal(rotada.status, 200);
  const cookie = cookieDe(rotada);
  assert.notEqual(cookie, cookieOriginal);
  assert.equal(await db.getRepository(EsquemaDeSesion).countBy({ hashDeId: original.hash }), 0);
  assert.equal((await llamar('GET', cookieOriginal)).status, 401);
  assert.equal((await llamar('GET', cookie + 'x')).status, 401);

  await app.close();
  app = await iniciar();
  db = app.get(DataSource);
  const restaurada = await llamar('GET', cookie);
  assert.equal(restaurada.status, 200);
  assert.deepEqual(await restaurada.json(), usuarioPublico);
  assert.equal((await llamar('DELETE', cookie, undefined, 'http://otro.example')).status, 403);
  assert.equal((await llamar('GET', cookie)).status, 200);
  const cerrada = await llamar('DELETE', cookie);
  assert.equal(cerrada.status, 204);
  assert.match(cerrada.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
  assert.equal((await llamar('GET', cookie)).status, 401);
  assert.equal(await db.getRepository(EsquemaDeSesion).countBy({ hashDeId: identificadorYHash(cookie).hash }), 0);

  const respuestaQueVence = await iniciarSesion();
  // La renovación debe terminar antes de forzar el vencimiento en MySQL.
  await respuestaQueVence.arrayBuffer();
  const cookieQueVence = cookieDe(respuestaQueVence);
  const hashVencido = identificadorYHash(cookieQueVence).hash;
  await db.getRepository(EsquemaDeSesion).update({ hashDeId: hashVencido }, { venceEn: new Date(Date.now() - 1000) });
  assert.equal((await llamar('GET', cookieQueVence)).status, 401);
  assert.equal(await db.getRepository(EsquemaDeSesion).countBy({ hashDeId: hashVencido }), 0);
});

test('el sexto intento de ingreso en un minuto se limita', { timeout: 15000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/app.module.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  for (let intento = 0; intento < 6; intento++) {
    const respuesta = await fetch((await app.getUrl()) + '/usuarios/sesion', {
      method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(respuesta.status, intento < 5 ? 400 : 429);
  }
});
