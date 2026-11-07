const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID, createHash } = require('node:crypto');

const ahora = new Date('2026-11-06T12:00:00.000Z');

function repositoriosFalsos(usuario) {
  const creadas = [];
  const correos = [];
  return {
    creadas,
    correos,
    usuarios: { buscarPorCorreoYRol: async (correo, rol) => { creadas.push({ consulta: [correo, rol] }); return usuario; } },
    recuperaciones: { crear: async (...datos) => { creadas.push({ crear: datos }); } },
    enviador: { enviar: async (correo) => { correos.push(correo); } },
  };
}

test('solicitar: guarda solo el hash, vence en una hora y envía el enlace con el rol', async () => {
  const { SolicitarRecuperacion } = await import('../dist/usuarios/aplicacion/recuperar-contrasena.js');
  const usuario = { id: 7, nombre: 'Ana', apellido: 'Pérez', correo: 'ana@example.test', rol: 'entrenador' };
  const falsos = repositoriosFalsos(usuario);
  const solicitar = new SolicitarRecuperacion(falsos.usuarios, falsos.recuperaciones, falsos.enviador, 'http://127.0.0.1:5173', () => 'token-fijo', () => ahora);

  await solicitar.ejecutar(' ANA@example.test ', 'entrenador');

  assert.deepEqual(falsos.creadas[0].consulta, ['ana@example.test', 'entrenador']);
  const [usuarioId, hash, venceEn] = falsos.creadas[1].crear;
  assert.equal(usuarioId, 7);
  assert.equal(hash, createHash('sha256').update('token-fijo').digest('hex'));
  assert.equal(venceEn.getTime() - ahora.getTime(), 60 * 60 * 1000);
  assert.equal(falsos.correos.length, 1);
  assert.equal(falsos.correos[0].para, 'ana@example.test');
  assert.match(falsos.correos[0].texto, /http:\/\/127\.0\.0\.1:5173\/#\/restablecer\?token=token-fijo&rol=entrenador/);
  assert.ok(!falsos.correos[0].texto.includes(hash));
});

test('solicitar: sin cuenta o con cuenta dada de baja no crea enlaces ni envía correos', async () => {
  const { SolicitarRecuperacion } = await import('../dist/usuarios/aplicacion/recuperar-contrasena.js');
  for (const usuario of [null, { id: 1, nombre: 'Ana', correo: 'ana@example.test', rol: 'alumno', fechaBaja: new Date() }]) {
    const falsos = repositoriosFalsos(usuario);
    await new SolicitarRecuperacion(falsos.usuarios, falsos.recuperaciones, falsos.enviador, 'http://x').ejecutar('ana@example.test', 'alumno');
    assert.equal(falsos.correos.length, 0);
    assert.equal(falsos.creadas.filter((operacion) => operacion.crear).length, 0);
  }
});

test('restablecer: valida la contraseña antes de consumir el enlace y rechaza enlaces inválidos', async () => {
  const { RestablecerContrasena, ContrasenaNuevaInvalidaError } = await import('../dist/usuarios/aplicacion/recuperar-contrasena.js');
  const { EnlaceDeRecuperacionInvalidoError } = await import('../dist/usuarios/dominio/recuperacion-de-contrasena.js');
  let consumos = 0;
  const recuperaciones = { consumir: async (hash, momento, nuevoHash) => { consumos++; assert.equal(momento, ahora); assert.equal(nuevoHash, 'hash-nuevo'); return hash === createHash('sha256').update('bueno').digest('hex'); } };
  const restablecer = new RestablecerContrasena(recuperaciones, async () => 'hash-nuevo', () => ahora);

  for (const contrasena of ['corta', 'con espacio 1', 'a'.repeat(129)]) {
    await assert.rejects(restablecer.ejecutar('bueno', contrasena), ContrasenaNuevaInvalidaError);
  }
  assert.equal(consumos, 0);
  await assert.rejects(restablecer.ejecutar('malo', 'Clave12345'), EnlaceDeRecuperacionInvalidoError);
  await restablecer.ejecutar('bueno', 'Clave12345');
});

test('recuperación completa: mismo correo con dos roles, un solo uso, vencimiento y baja', { timeout: 60000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const { EnviadorDeCorreo } = await import('../dist/usuarios/dominio/recuperacion-de-contrasena.js');
  const { RepositorioDeRecuperacionesTypeOrm } = await import('../dist/usuarios/infraestructura/repositorio-de-recuperaciones-typeorm.js');

  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  const db = app.get(DataSource);
  const usuarios = db.getRepository(EsquemaDeUsuario);
  const creados = [];
  t.after(async () => {
    try {
      for (const { id } of creados) {
        await db.query('DELETE FROM recuperaciones_de_contrasena WHERE usuario_id = ?', [id]);
        await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(id)]);
        await usuarios.delete({ id });
      }
    } finally { await app.close(); }
  });
  await app.listen(0, '127.0.0.1');
  const urlBase = await app.getUrl();

  // Captura los correos que enviaría la aplicación, sin tocar el SMTP.
  const enviados = [];
  app.get(EnviadorDeCorreo).enviar = async (correo) => { enviados.push(correo); };
  const esperarCorreo = async (cantidad) => {
    for (let intento = 0; intento < 100 && enviados.length < cantidad; intento++) await new Promise((r) => setTimeout(r, 50));
    assert.equal(enviados.length, cantidad);
    return enviados[cantidad - 1];
  };
  const tokenDe = (correo) => new URL(correo.texto.match(/http\S+/)[0].replace('/#/', '/')).searchParams.get('token');

  const correo = `recuperacion-${randomUUID()}@example.test`;
  const contrasenaInicial = 'Clave123';
  const hashInicial = await hashearContrasena(contrasenaInicial);
  const alumno = await usuarios.save({ nombre: 'Alu', apellido: 'Mno', correo, rol: 'alumno', hashDeContrasena: hashInicial });
  const entrenador = await usuarios.save({ nombre: 'Entre', apellido: 'Nador', correo, rol: 'entrenador', hashDeContrasena: hashInicial });
  creados.push(alumno, entrenador);

  const llamar = (ruta, metodo, cuerpo, cookie) => fetch(urlBase + ruta, {
    method: metodo,
    headers: { Origin: 'http://127.0.0.1:5173', ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const pedir = (cuerpo) => llamar('/usuarios/recuperacion', 'POST', cuerpo);
  const restablecer = (token, contrasena) => llamar('/usuarios/recuperacion/restablecer', 'POST', { token, contrasena });
  const iniciar = (rol, contrasena) => llamar('/usuarios/sesion', 'POST', { correo, contrasena, rol });

  // El mismo correo entra con cada rol y cada cuenta es distinta.
  const entradaAlumno = await iniciar('alumno', contrasenaInicial);
  assert.equal(entradaAlumno.status, 200);
  const sesionDelEntrenador = await iniciar('entrenador', contrasenaInicial);
  assert.equal(sesionDelEntrenador.status, 200);
  assert.equal((await sesionDelEntrenador.json()).id, entrenador.id);
  const cookieDelEntrenador = sesionDelEntrenador.headers.getSetCookie().find((c) => /Path=\/;/i.test(c)).split(';')[0];

  // La respuesta es idéntica exista o no la cuenta.
  const existente = await pedir({ correo, rol: 'entrenador' });
  const inexistente = await pedir({ correo: 'nadie-' + correo, rol: 'entrenador' });
  assert.equal(existente.status, 202);
  assert.equal(inexistente.status, 202);
  assert.deepEqual(await existente.json(), await inexistente.json());
  const primerCorreo = await esperarCorreo(1);
  assert.equal(enviados.length, 1);
  assert.equal(primerCorreo.para, correo);
  assert.match(primerCorreo.texto, /rol=entrenador/);
  const token = tokenDe(primerCorreo);

  // Solo se guarda el hash del enlace.
  const [fila] = await db.query('SELECT hash_del_token, vence_en FROM recuperaciones_de_contrasena WHERE usuario_id = ?', [entrenador.id]);
  assert.equal(fila.hash_del_token, createHash('sha256').update(token).digest('hex'));
  assert.notEqual(fila.hash_del_token, token);
  const vigencia = new Date(fila.vence_en).getTime() - Date.now();
  assert.ok(vigencia > 59 * 60 * 1000 && vigencia <= 60 * 60 * 1000);

  // Contraseña inválida: 400 y el enlace sigue sirviendo.
  const corta = await restablecer(token, 'corta');
  assert.equal(corta.status, 400);
  assert.ok((await corta.json()).erroresDeCampo.contrasena);

  const cambio = await restablecer(token, 'NuevaClave456');
  assert.equal(cambio.status, 204);
  // Se cierran las sesiones del entrenador, no las del alumno.
  assert.equal((await llamar('/usuarios/sesion', 'GET', null, cookieDelEntrenador)).status, 401);
  assert.equal((await iniciar('entrenador', contrasenaInicial)).status, 401);
  assert.equal((await iniciar('entrenador', 'NuevaClave456')).status, 200);
  // La cuenta de alumno con el mismo correo conserva su contraseña.
  assert.equal((await iniciar('alumno', contrasenaInicial)).status, 200);

  // Un solo uso.
  assert.equal((await restablecer(token, 'OtraClave789')).status, 410);

  // Un pedido nuevo invalida el anterior pendiente.
  const repositorio = new RepositorioDeRecuperacionesTypeOrm(db);
  const hash = (valor) => createHash('sha256').update(valor).digest('hex');
  await repositorio.crear(alumno.id, hash('viejo'), new Date(Date.now() + 3600000));
  await repositorio.crear(alumno.id, hash('nuevo'), new Date(Date.now() + 3600000));
  assert.equal(await repositorio.consumir(hash('viejo'), new Date(), 'x'), false);

  // Vencido: no sirve; en el límite de la hora tampoco.
  await repositorio.crear(alumno.id, hash('vencido'), new Date(Date.now() - 1000));
  assert.equal(await repositorio.consumir(hash('vencido'), new Date(), 'x'), false);

  // Dos usos simultáneos del mismo enlace: solo uno cambia la contraseña.
  await repositorio.crear(alumno.id, hash('carrera'), new Date(Date.now() + 3600000));
  const resultados = await Promise.all([1, 2, 3].map((n) => repositorio.consumir(hash('carrera'), new Date(), `hash-${n}`)));
  assert.equal(resultados.filter(Boolean).length, 1);

  // Una cuenta dada de baja no recibe correo ni puede usar un enlace anterior.
  await repositorio.crear(alumno.id, hash('antes-de-la-baja'), new Date(Date.now() + 3600000));
  await db.query('UPDATE usuarios SET fecha_baja = UTC_TIMESTAMP(3) WHERE id = ?', [alumno.id]);
  assert.equal(await repositorio.consumir(hash('antes-de-la-baja'), new Date(), 'x'), false);
  assert.equal((await pedir({ correo, rol: 'alumno' })).status, 202);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(enviados.length, 1);
});

test('recuperación: valida el cuerpo y limita los intentos', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/app.module.js');
  const { EnviadorDeCorreo } = await import('../dist/usuarios/dominio/recuperacion-de-contrasena.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  app.get(EnviadorDeCorreo).enviar = async () => {};
  const llamar = (ruta, cuerpo, origen = 'http://127.0.0.1:5173') => fetch(ruta, {
    method: 'POST', headers: { Origin: origen, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  const base = await app.getUrl();
  const pedir = (cuerpo, origen) => llamar(base + '/usuarios/recuperacion', cuerpo, origen);

  assert.equal((await pedir({ correo: 'a@example.test', rol: 'alumno' }, 'http://otro.example')).status, 403);
  assert.equal((await pedir({ correo: 'a@example.test' })).status, 400);
  assert.equal((await pedir({ correo: 'a@example.test', rol: 'otro' })).status, 400);
  assert.equal((await pedir({ correo: 'a@example.test', rol: 'alumno', extra: 1 })).status, 400);
  assert.equal((await pedir({ correo: 'a@example.test', rol: 'alumno' })).status, 202);
  assert.equal((await pedir({ correo: 'a@example.test', rol: 'alumno' })).status, 202);
  assert.equal((await pedir({ correo: 'a@example.test', rol: 'alumno' })).status, 429);
  assert.equal((await llamar(base + '/usuarios/recuperacion/restablecer', { token: 'x' })).status, 400);
  assert.equal((await llamar(base + '/usuarios/recuperacion/restablecer', { token: 'inexistente', contrasena: 'Clave12345' })).status, 410);
});
