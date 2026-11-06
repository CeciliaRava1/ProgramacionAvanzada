const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID, createHash } = require('node:crypto');

test('el caso de uso normaliza el correo y solo devuelve datos públicos', async () => {
  const { SignIn } = await import('../dist/users/application/sign-in.js');
  const user = { id: 1, firstName: 'Nombre', lastName: 'Apellido', email: 'alumno@example.test', role: 'trainer', passwordHash: 'hash' };
  const signIn = new SignIn({ findByEmail: async (email) => { assert.equal(email, user.email); return user; } }, async (password, hash) => password === 'Clave123' && hash === 'hash');
  const result = await signIn.execute(' ALUMNO@example.test ', 'Clave123');
  assert.equal(result.role, 'trainer');
  assert.equal('passwordHash' in result, false);
  await assert.rejects(signIn.execute(user.email, 'incorrecta'), /Correo o contraseña incorrectos/);
  const missing = new SignIn({ findByEmail: async () => null }, async (_password, hash) => { assert.equal(hash, undefined); return false; });
  await assert.rejects(missing.execute(user.email, 'Clave123'), /Correo o contraseña incorrectos/);
});

test('verifica hashes existentes, conserva contraseñas antiguas con espacios y rechaza hashes malformados', { timeout: 15000 }, async () => {
  const { hashPassword, verifyPassword } = await import('../dist/users/infrastructure/hash-password.js');
  const password = ' una contraseña anterior ';
  const hash = await hashPassword(password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(password.trim(), hash), false);
  assert.equal(await verifyPassword(password, 'scrypt$999999999$8$1$sal$hash'), false);
  assert.equal(await verifyPassword(password), false);
});

test('no configura sesiones con un secreto ausente o débil', async () => {
  const { createSessionMiddleware } = await import('../dist/users/presentation/session.middleware.js');
  for (const secret of [undefined, '', 'corto']) {
    assert.throws(() => createSessionMiddleware({ get: () => secret }, {}), /SESSION_SECRET/);
  }
});

test('la sesión persiste, se renueva, rota, vence y se invalida al cerrar', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { UserSchema } = await import('../dist/users/infrastructure/typeorm-user.repository.js');
  const { SessionSchema, SESSION_TTL_MS } = await import('../dist/users/infrastructure/typeorm-session.store.js');
  const { hashPassword } = await import('../dist/users/infrastructure/hash-password.js');
  const start = async () => {
    const instance = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    await instance.listen(0, '127.0.0.1');
    return instance;
  };
  let app = await start();
  let user;
  t.after(async () => {
    try {
      if (user) {
        const db = app.get(DataSource);
        // Solo se limpian sesiones y cuenta de este caso de prueba.
        await db.query("DELETE FROM sessions WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) = ?", [String(user.id)]);
        await db.getRepository(UserSchema).delete({ id: user.id });
      }
    } finally { await app.close(); }
  });
  let db = app.get(DataSource);
  const email = 'session-test-' + randomUUID() + '@example.test';
  user = await db.getRepository(UserSchema).save({ firstName: 'Nombre', lastName: 'Prueba', email, role: 'student', passwordHash: await hashPassword('Clave123') });
  const call = async (method, cookie, body, origin = 'http://127.0.0.1:5173') => fetch((await app.getUrl()) + '/users/session', {
    method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const login = (cookie) => call('POST', cookie, { email, password: 'Clave123' });
  const cookieFrom = (response) => {
    const header = response.headers.getSetCookie().find((header) => /Path=\/users;/i.test(header));
    assert.ok(header);
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Strict/i);
    assert.match(header, /Path=\/users;/i);
    const expires = new Date(header.match(/Expires=([^;]+)/i)[1]).getTime();
    assert.ok(expires - Date.now() > SESSION_TTL_MS - 60000);
    return header.split(';')[0];
  };
  const idHash = (cookie) => {
    const signed = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));
    const id = signed.slice(2, signed.lastIndexOf('.'));
    return { id, hash: createHash('sha256').update(id).digest('hex') };
  };

  const anonymous = await call('GET');
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.headers.get('set-cookie'), null);
  assert.equal((await call('POST', null, { email, password: 'Clave123' }, 'http://otro.example')).status, 403);
  for (const body of [{ email, password: 'incorrecta' }, { email: 'missing-' + email, password: 'Clave123' }]) {
    const response = await call('POST', null, body);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).message, 'Correo o contraseña incorrectos');
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal((await call('POST', null, { email, password: 'Clave123', role: 'admin' })).status, 400);
  const response = await login();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const publicUser = await response.json();
  assert.deepEqual(Object.keys(publicUser).sort(), ['email', 'firstName', 'id', 'lastName', 'role']);
  const originalCookie = cookieFrom(response);
  const original = idHash(originalCookie);
  let record = await db.getRepository(SessionSchema).findOneByOrFail({ idHash: original.hash });
  assert.equal(record.data.userId, user.id);
  assert.ok(!JSON.stringify(record).includes(original.id));
  assert.ok(!JSON.stringify(record).includes(user.passwordHash));

  record.data.cookie.path = '/users/session';
  await db.getRepository(SessionSchema).update({ idHash: original.hash }, { data: record.data });
  const migrated = await call('GET', originalCookie);
  assert.equal(migrated.status, 200);
  assert.equal(cookieFrom(migrated), originalCookie);
  assert.ok(migrated.headers.getSetCookie().some((header) => /Path=\/users\/session;/i.test(header) && /Expires=Thu, 01 Jan 1970/i.test(header)));
  record = await db.getRepository(SessionSchema).findOneByOrFail({ idHash: original.hash });
  assert.equal(record.data.cookie.path, '/users');

  await db.getRepository(SessionSchema).update({ idHash: original.hash }, { expiresAt: new Date(Date.now() + 86400000) });
  const renewed = await call('GET', originalCookie);
  assert.equal(renewed.status, 200);
  assert.deepEqual(await renewed.json(), publicUser);
  cookieFrom(renewed);
  record = await db.getRepository(SessionSchema).findOneByOrFail({ idHash: original.hash });
  assert.ok(record.expiresAt.getTime() - Date.now() > SESSION_TTL_MS - 60000);
  const rotated = await login(originalCookie);
  assert.equal(rotated.status, 200);
  const cookie = cookieFrom(rotated);
  assert.notEqual(cookie, originalCookie);
  assert.equal(await db.getRepository(SessionSchema).countBy({ idHash: original.hash }), 0);
  assert.equal((await call('GET', originalCookie)).status, 401);
  assert.equal((await call('GET', cookie + 'x')).status, 401);

  await app.close();
  app = await start();
  db = app.get(DataSource);
  const restored = await call('GET', cookie);
  assert.equal(restored.status, 200);
  assert.deepEqual(await restored.json(), publicUser);
  assert.equal((await call('DELETE', cookie, undefined, 'http://otro.example')).status, 403);
  assert.equal((await call('GET', cookie)).status, 200);
  const closed = await call('DELETE', cookie);
  assert.equal(closed.status, 204);
  assert.match(closed.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
  assert.equal((await call('GET', cookie)).status, 401);
  assert.equal(await db.getRepository(SessionSchema).countBy({ idHash: idHash(cookie).hash }), 0);

  const expiringResponse = await login();
  // La renovación debe terminar antes de forzar el vencimiento en MySQL.
  await expiringResponse.arrayBuffer();
  const expiring = cookieFrom(expiringResponse);
  const expiredHash = idHash(expiring).hash;
  await db.getRepository(SessionSchema).update({ idHash: expiredHash }, { expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await call('GET', expiring)).status, 401);
  assert.equal(await db.getRepository(SessionSchema).countBy({ idHash: expiredHash }), 0);
});

test('el sexto intento de ingreso en un minuto se limita', { timeout: 15000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/app.module.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch((await app.getUrl()) + '/users/session', {
      method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(response.status, attempt < 5 ? 400 : 429);
  }
});
