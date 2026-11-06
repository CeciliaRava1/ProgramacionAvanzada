const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID, scrypt: deriveKey, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const validInput = {
  firstName: ' Nombre ', lastName: ' Apellido ',
  email: ' ALUMNO@example.test ', password: 'Clave123',
};

test('normaliza el alta y usa el rol del servidor sin devolver credenciales', async () => {
  const { RegisterUser } = await import('../dist/users/application/register-user.js');
  const stored = [];
  const register = new RegisterUser({
    findByEmail: async () => null,
    save: async (user) => { stored.push(user); return { ...user, id: 1 }; },
  }, async () => 'hash-de-prueba');

  for (const role of ['student', 'trainer']) {
    const result = await register.execute({ ...validInput, role: 'admin' }, role);
    assert.deepEqual(result, { id: 1, firstName: 'Nombre', lastName: 'Apellido', email: 'alumno@example.test', role });
    assert.deepEqual(stored.at(-1), { firstName: 'Nombre', lastName: 'Apellido', email: 'alumno@example.test', passwordHash: 'hash-de-prueba', role, ...(role === 'trainer' ? { availability: null } : {}) });
  }
});

test('rechaza nombres o correos inválidos antes de consultar o guardar', async () => {
  const { RegisterUser } = await import('../dist/users/application/register-user.js');
  const register = new RegisterUser({
    findByEmail: async () => assert.fail('No debe consultar con datos inválidos.'),
    save: async () => assert.fail('No debe guardar datos inválidos.'),
  }, async () => assert.fail('No debe calcular el hash con datos inválidos.'));

  for (const change of [{ firstName: ' ' }, { lastName: 'a'.repeat(101) }, { email: 'incorrecto' }, { email: 'a\0@example.test' }]) {
    await assert.rejects(register.execute({ ...validInput, ...change }, 'student'), { name: 'Error', message: 'Revisá los datos ingresados.' });
  }
});

test('un correo existente no cambia la cuenta ni calcula otra contraseña', async () => {
  const { RegisterUser } = await import('../dist/users/application/register-user.js');
  const existing = { id: 1, role: 'trainer', passwordHash: 'hash-existente' };
  const register = new RegisterUser({
    findByEmail: async (email) => { assert.equal(email, 'alumno@example.test'); return existing; },
    save: async () => assert.fail('No debe modificar la cuenta.'),
  }, async () => assert.fail('No debe calcular otro hash.'));

  await assert.rejects(register.execute(validInput, 'trainer'), /Ya existe una cuenta/);
  assert.equal(existing.role, 'trainer');
  assert.equal(existing.passwordHash, 'hash-existente');
});

test('la entrada HTTP exige texto, limita la contraseña y rechaza campos adicionales', async () => {
  const { parseRegisterUserRequest } = await import('../dist/users/presentation/register-user.request.js');
  assert.deepEqual(parseRegisterUserRequest(validInput), validInput);
  for (const input of [null, [], 'texto', {}, { ...validInput, email: 123 },
    { ...validInput, password: 'a'.repeat(7) }, { ...validInput, password: 'a'.repeat(129) },
    ...[' Clave123', 'Clave123 ', 'Clave 123', 'Clave\t123', 'Clave\n123', 'Clave\u00a0123'].map((password) => ({ ...validInput, password })),
    { ...validInput, role: 'admin' }, { ...validInput, passwordHash: 'hash' }]) {
    assert.throws(() => parseRegisterUserRequest(input), (error) => error.getStatus() === 400);
  }
  // Los límites cuentan caracteres Unicode; la entrada válida no se modifica.
  for (const password of ['Clave123', 'ñ'.repeat(8), 'a'.repeat(128)]) {
    assert.equal(parseRegisterUserRequest({ ...validInput, password }).password, password);
  }
});

test('el horario es opcional, libre y limitado; solo se acepta en altas de entrenadores', async () => {
  const { normalizeTrainerAvailability } = await import('../dist/users/domain/user.js');
  const { parseRegisterUserRequest } = await import('../dist/users/presentation/register-user.request.js');
  const { RegisterUser } = await import('../dist/users/application/register-user.js');
  for (const value of [undefined, null, '', '   ']) assert.equal(normalizeTrainerAvailability(value), null);
  assert.equal(normalizeTrainerAvailability('  Mediodía y algunos sábados  '), 'Mediodía y algunos sábados');
  assert.equal(normalizeTrainerAvailability('ñ'.repeat(255)), 'ñ'.repeat(255));
  assert.throws(() => normalizeTrainerAvailability('a'.repeat(256)), (error) => Boolean(error.fieldErrors.availability));
  for (const value of [null, '', 'Tarde']) {
    assert.equal(parseRegisterUserRequest({ ...validInput, availability: value }, 'trainer').availability, value);
  }
  for (const value of [123, [], {}]) {
    assert.throws(() => parseRegisterUserRequest({ ...validInput, availability: value }, 'trainer'), (error) => error.getStatus() === 400);
  }
  assert.throws(() => parseRegisterUserRequest({ ...validInput, availability: 'Tarde' }, 'student'), (error) => error.getStatus() === 400);
  const stored = [];
  const register = new RegisterUser({ findByEmail: async () => null, save: async (user) => { stored.push(user); return { ...user, id: 1 }; } }, async () => 'hash');
  await register.execute({ ...validInput, availability: '  Tarde  ' }, 'trainer');
  assert.equal(stored[0].availability, 'Tarde');
});

test('scrypt genera sales diferentes y permite comprobar la contraseña original', { timeout: 15000 }, async () => {
  const { hashPassword } = await import('../dist/users/infrastructure/hash-password.js');
  const first = await hashPassword(validInput.password);
  const second = await hashPassword(validInput.password);
  assert.notEqual(first, second);
  assert.ok(first.length <= 255);
  const [algorithm, cost, blockSize, parallelism, salt, hash] = first.split('$');
  assert.equal(algorithm, 'scrypt');
  const key = await promisify(deriveKey)(validInput.password, salt, 64, {
    N: Number(cost), r: Number(blockSize), p: Number(parallelism), maxmem: 192 * 1024 * 1024,
  });
  assert.ok(timingSafeEqual(key, Buffer.from(hash, 'hex')));
  assert.ok(!first.includes(validInput.password));
});

test('oculta un fallo de persistencia en la respuesta HTTP', async () => {
  const { UsersController } = await import('../dist/users/presentation/users.controller.js');
  const controller = new UsersController({ execute: async () => { throw new Error('SQL y datos internos'); } });
  await assert.rejects(controller.register(validInput), (error) => {
    assert.equal(error.getStatus(), 500);
    assert.ok(!JSON.stringify(error.getResponse()).includes('SQL'));
    return true;
  });
});

test('HTTP y MySQL conservan cuentas, rechazan duplicados y protegen altas simultáneas', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { UserSchema } = await import('../dist/users/infrastructure/typeorm-user.repository.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const dataSource = app.get(DataSource);
  const emails = [0, 1, 2, 3].map(() => `test-${randomUUID()}@example.test`);
  t.after(async () => {
    // Solo se eliminan los registros creados por esta prueba, nunca otras cuentas.
    try {
      await dataSource.getRepository(UserSchema).delete(emails.map((email) => ({ email })));
    } finally {
      await app.close();
    }
  });
  assert.equal(await dataSource.showMigrations(), false, 'Ejecutar npm.cmd run db:migrate antes de las pruebas.');
  assert.deepEqual(await dataSource.runMigrations({ transaction: 'each' }), []);
  const post = (body) => fetch(`${baseUrl}/users/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const baseUrl = await app.getUrl();

  const created = await post({ ...validInput, email: ` ${emails[0].toUpperCase()} ` });
  assert.equal(created.status, 201);
  const result = await created.json();
  assert.deepEqual(Object.keys(result).sort(), ['email', 'firstName', 'id', 'lastName', 'role']);
  assert.equal(result.email, emails[0]);
  assert.equal(result.role, 'student');
  const original = await dataSource.getRepository(UserSchema).findOneByOrFail({ email: emails[0] });
  assert.ok(original.passwordHash.startsWith('scrypt$'));
  assert.notEqual(original.passwordHash, validInput.password);

  const duplicate = await post({ ...validInput, email: emails[0] });
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await dataSource.getRepository(UserSchema).findOneByOrFail({ email: emails[0] }), original);

  const invalid = await post({ ...validInput, email: emails[1], firstName: ' ' });
  assert.equal(invalid.status, 400);
  assert.equal(await dataSource.getRepository(UserSchema).countBy({ email: emails[1] }), 0);
  for (const password of ['Clave12', 'Clave 123']) {
    assert.equal((await post({ ...validInput, email: emails[1], password })).status, 400);
    assert.equal(await dataSource.getRepository(UserSchema).countBy({ email: emails[1] }), 0);
  }
  const privileged = await post({ ...validInput, email: emails[1], role: 'admin' });
  assert.equal(privileged.status, 400);
  assert.equal(await dataSource.getRepository(UserSchema).countBy({ email: emails[1] }), 0);

  const trainer = await dataSource.getRepository(UserSchema).save({
    firstName: 'Entrenador', lastName: 'Prueba', email: emails[2], passwordHash: 'hash-solo-de-prueba', role: 'trainer',
  });
  assert.equal((await post({ ...validInput, email: emails[2] })).status, 409);
  assert.deepEqual(await dataSource.getRepository(UserSchema).findOneByOrFail({ email: emails[2] }), trainer);

  const concurrent = await Promise.all([
    post({ ...validInput, email: emails[3] }), post({ ...validInput, email: emails[3] }),
  ]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
  assert.equal(await dataSource.getRepository(UserSchema).countBy({ email: emails[3] }), 1);
});

test('solo una sesión administradora puede crear entrenadores, sin alterar cuentas existentes', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { UserSchema } = await import('../dist/users/infrastructure/typeorm-user.repository.js');
  const { hashPassword, verifyPassword } = await import('../dist/users/infrastructure/hash-password.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const db = app.get(DataSource);
  const users = db.getRepository(UserSchema);
  const emails = Array.from({ length: 6 }, () => `trainer-test-${randomUUID()}@example.test`);
  t.after(async () => {
    try {
      const created = await users.find({ where: emails.map((email) => ({ email })), select: { id: true } });
      for (const user of created) {
        await db.query("DELETE FROM sessions WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) = ?", [String(user.id)]);
        await users.delete({ id: user.id });
      }
    } finally { await app.close(); }
  });
  const passwordHash = await hashPassword(validInput.password);
  const accounts = [];
  for (const [index, role] of ['admin', 'student', 'trainer'].entries()) {
    accounts.push(await users.save({ firstName: 'Cuenta', lastName: 'Prueba', email: emails[index], passwordHash, role }));
  }
  const baseUrl = await app.getUrl();
  const call = (path, method, cookie, body, origin = 'http://127.0.0.1:5173') => fetch(baseUrl + path, {
    method, headers: { ...(origin ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const login = async (email) => {
    const response = await call('/users/session', 'POST', null, { email, password: validInput.password });
    assert.equal(response.status, 200);
    return response.headers.getSetCookie().find((header) => /Path=\/users;/i.test(header)).split(';')[0];
  };
  const cookies = [];
  for (const account of accounts) cookies.push(await login(account.email));
  const input = { ...validInput, email: emails[3] };
  const post = (cookie, body = input, origin) => call('/users/trainers', 'POST', cookie, body, origin);
  assert.equal((await post()).status, 401);
  assert.equal((await post(cookies[0], input, '')).status, 403);
  assert.equal((await post(cookies[0], input, 'http://otro.example')).status, 403);
  assert.equal((await post(cookies[0] + 'x')).status, 401);
  for (const cookie of cookies.slice(1)) assert.equal((await post(cookie)).status, 403);
  assert.equal(await users.countBy({ email: emails[3] }), 0);

  const response = await post(cookies[0]);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json();
  assert.deepEqual(Object.keys(result).sort(), ['email', 'firstName', 'id', 'lastName', 'role']);
  assert.equal(result.role, 'trainer');
  assert.equal(result.email, emails[3]);
  const trainer = await users.findOneByOrFail({ email: emails[3] });
  assert.equal(await verifyPassword(validInput.password, trainer.passwordHash), true);
  const current = await call('/users/session', 'GET', cookies[0]);
  assert.equal((await current.json()).id, accounts[0].id);
  const trainerCookie = await login(emails[3]);
  assert.equal((await post(trainerCookie, { ...input, email: emails[4] })).status, 403);

  for (const changes of [{ firstName: ' ' }, { password: 'corta' }, { password: 'Clave 123' }, { role: 'admin' }]) {
    assert.equal((await post(cookies[0], { ...input, email: emails[4], ...changes })).status, 400);
  }
  assert.equal(await users.countBy({ email: emails[4] }), 0);
  for (const account of [...accounts, trainer]) {
    assert.equal((await post(cookies[0], { ...input, email: account.email })).status, 409);
    assert.deepEqual(await users.findOneByOrFail({ id: account.id }), account);
  }
  const concurrent = await Promise.all([post(cookies[0], { ...input, email: emails[5] }), post(cookies[0], { ...input, email: emails[5] })]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
  assert.equal(await users.countBy({ email: emails[5] }), 1);

  await users.update({ id: accounts[0].id }, { role: 'student' });
  assert.equal((await post(cookies[0], { ...input, email: emails[4] })).status, 403);
  assert.equal((await call('/users/session', 'DELETE', cookies[0])).status, 204);
  assert.equal((await post(cookies[0], { ...input, email: emails[4] })).status, 401);
  assert.equal(await users.countBy({ email: emails[4] }), 0);
});
