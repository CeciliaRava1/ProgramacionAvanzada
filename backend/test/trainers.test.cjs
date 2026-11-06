const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('el listado entrega solo los datos públicos y contempla que no haya entrenadores', async () => {
  const { ListTrainers } = await import('../dist/users/application/list-trainers.js');
  const input = { id: 1, firstName: 'Nombre', lastName: 'Apellido', role: 'trainer', email: 'privado@example.test', passwordHash: 'hash', availability: 'Tarde' };
  const list = new ListTrainers({ findTrainers: async () => [input, { ...input, id: 2, availability: undefined }] });
  assert.deepEqual(await list.execute(), [
    { id: 1, firstName: 'Nombre', lastName: 'Apellido', availability: 'Tarde' },
    { id: 2, firstName: 'Nombre', lastName: 'Apellido', availability: null },
  ]);
  assert.deepEqual(await new ListTrainers({ findTrainers: async () => [] }).execute(), []);
});

test('el guard consulta el rol actual y deniega rutas sin un rol declarado', async () => {
  const { Reflector } = await import('@nestjs/core');
  const { RoleGuard, RequireRole } = await import('../dist/users/presentation/role.guard.js');
  const handler = () => {};
  Reflect.defineMetadata(RequireRole.KEY, 'student', handler);
  let user = { id: 1, role: 'student' };
  const guard = new RoleGuard({ findById: async () => user }, new Reflector());
  const context = (userId = 1, target = handler) => ({ switchToHttp: () => ({ getRequest: () => ({ session: { userId } }) }), getHandler: () => target });
  assert.equal(await guard.canActivate(context()), true);
  for (const role of ['trainer', 'admin']) {
    user = { id: 1, role };
    await assert.rejects(guard.canActivate(context()), (error) => error.getStatus() === 403);
  }
  user = { id: 1, role: 'student' };
  await assert.rejects(guard.canActivate(context(1, () => {})), (error) => error.getStatus() === 403);
  await assert.rejects(guard.canActivate(context(0)), (error) => error.getStatus() === 401);
  user = null;
  await assert.rejects(guard.canActivate(context()), (error) => error.getStatus() === 401);
});

test('un fallo al consultar entrenadores no devuelve detalles internos', async () => {
  const { UsersController } = await import('../dist/users/presentation/users.controller.js');
  const controller = new UsersController({}, { execute: async () => { throw new Error('SQL y credenciales'); } });
  await assert.rejects(controller.trainers(), (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
});

test('HTTP y MySQL permiten consultar entrenadores solo a alumnos y conservan el horario opcional', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { UserSchema } = await import('../dist/users/infrastructure/typeorm-user.repository.js');
  const { hashPassword } = await import('../dist/users/infrastructure/hash-password.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const db = app.get(DataSource);
  const users = db.getRepository(UserSchema);
  const emails = Array.from({ length: 8 }, () => `trainer-list-test-${randomUUID()}@example.test`);
  const accounts = [];
  t.after(async () => {
    try {
      const created = await users.find({ where: emails.map((email) => ({ email })), select: { id: true } });
      for (const id of new Set([...created, ...accounts].map((user) => user.id))) {
        await db.query("DELETE FROM sessions WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) = ?", [String(id)]);
        await users.delete({ id });
      }
    } finally { await app.close(); }
  });
  const password = 'Clave123';
  const passwordHash = await hashPassword(password);
  for (const [index, role] of ['admin', 'student', 'trainer'].entries()) {
    accounts.push(await users.save({ firstName: 'Cuenta', lastName: 'Prueba', email: emails[index], role, passwordHash }));
  }
  await assert.rejects(users.insert({ firstName: 'Cuenta', lastName: 'Rol anterior', email: emails[7], role: 'teacher', passwordHash }), error => error.driverError?.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
  const baseUrl = await app.getUrl();
  const call = (path, method, cookie, body) => fetch(baseUrl + path, {
    method, headers: { Origin: 'http://127.0.0.1:5173', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const cookies = [];
  for (const account of accounts) {
    const response = await call('/users/session', 'POST', null, { email: account.email, password });
    assert.equal(response.status, 200);
    cookies.push(response.headers.getSetCookie().find((header) => /Path=\/users;/i.test(header)).split(';')[0]);
  }
  assert.equal((await call('/users/trainers', 'GET')).status, 401);
  assert.equal((await call('/users/teachers', 'GET', cookies[1])).status, 404);
  assert.equal((await call('/users/trainers', 'GET', cookies[1] + 'x')).status, 401);
  for (const cookie of [cookies[0], cookies[2]]) assert.equal((await call('/users/trainers', 'GET', cookie)).status, 403);
  const trainerInput = { firstName: 'Entrenador', lastName: 'Listado', email: emails[3], password, availability: '  Mañana y mediodía  ' };
  assert.equal((await call('/users/trainers', 'POST', cookies[0], trainerInput)).status, 201);
  const createdTrainer = await users.findOneByOrFail({ email: emails[3] });
  assert.equal(createdTrainer.availability, 'Mañana y mediodía');
  for (const [offset, availability] of [undefined, '', null].entries()) {
    const input = { ...trainerInput, email: emails[4 + offset] };
    if (availability === undefined) delete input.availability;
    else input.availability = availability;
    assert.equal((await call('/users/trainers', 'POST', cookies[0], input)).status, 201);
    assert.equal((await users.findOneByOrFail({ email: input.email })).availability, null);
  }
  for (const availability of [123, 'a'.repeat(256)]) {
    const invalid = await call('/users/trainers', 'POST', cookies[0], { ...trainerInput, email: emails[7], availability });
    assert.equal(invalid.status, 400);
    assert.ok((await invalid.json()).fieldErrors.availability);
  }
  assert.equal((await call('/users/students', 'POST', null, { ...trainerInput, email: emails[7] })).status, 400);
  assert.equal(await users.countBy({ email: emails[7] }), 0);

  const response = await call('/users/trainers', 'GET', cookies[1]);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const list = await response.json();
  assert.ok(list.some((trainer) => trainer.id === createdTrainer.id && trainer.availability === 'Mañana y mediodía'));
  assert.ok(list.some((trainer) => trainer.id === accounts[2].id && trainer.availability === null));
  const expectedIds = (await users.find({ where: emails.map((email) => ({ email, role: 'trainer' })), order: { lastName: 'ASC', firstName: 'ASC', id: 'ASC' } })).map((trainer) => trainer.id);
  assert.deepEqual(list.filter((trainer) => expectedIds.includes(trainer.id)).map((trainer) => trainer.id), expectedIds);
  assert.ok(!list.some((trainer) => [accounts[0].id, accounts[1].id].includes(trainer.id)));
  for (const trainer of list) assert.deepEqual(Object.keys(trainer).sort(), ['availability', 'firstName', 'id', 'lastName']);
  await users.update({ id: accounts[1].id }, { role: 'trainer' });
  assert.equal((await call('/users/trainers', 'GET', cookies[1])).status, 403);
  await users.delete({ id: accounts[1].id });
  assert.equal((await call('/users/trainers', 'GET', cookies[1])).status, 401);
});
