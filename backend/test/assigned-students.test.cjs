const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('la consulta usa el entrenador recibido y devuelve solo la identidad pública del alumno', async () => {
  const { ListAssignedStudents } = await import('../dist/users/application/list-assigned-students.js');
  const calls = [];
  const list = new ListAssignedStudents({ findAssignedByTrainer: async (id) => {
    calls.push(id);
    return [{ id: 8, firstName: 'Alumno', lastName: 'Prueba', email: 'privado@example.test', passwordHash: 'no devolver' }];
  } });
  assert.deepEqual(await list.execute(4), [{ id: 8, firstName: 'Alumno', lastName: 'Prueba' }]);
  assert.deepEqual(calls, [4]);
  assert.deepEqual(await new ListAssignedStudents({ findAssignedByTrainer: async () => [] }).execute(4), []);
});

test('el controlador obtiene el entrenador de la sesión y oculta fallos internos', async () => {
  const { UsersController } = await import('../dist/users/presentation/users.controller.js');
  let trainerId;
  const controller = new UsersController({}, {}, { execute: async (id) => { trainerId = id; return []; } });
  assert.deepEqual(await controller.students({ session: { userId: 4 }, query: { trainerId: 9 } }), []);
  assert.equal(trainerId, 4);
  const failing = new UsersController({}, {}, { execute: async () => { throw new Error('SQL y credenciales'); } });
  await assert.rejects(failing.students({ session: { userId: 4 } }),
    (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
});

test('HTTP y MySQL muestran solo alumnos vinculados al entrenador de la sesión', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { TrainerRequests } = await import('../dist/users/application/trainer-requests.js');
  const { UserSchema } = await import('../dist/users/infrastructure/typeorm-user.repository.js');
  const { TrainerRequestSchema, TrainerAssignmentSchema } = await import('../dist/users/infrastructure/typeorm-trainer-request.repository.js');
  const { hashPassword } = await import('../dist/users/infrastructure/hash-password.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const db = app.get(DataSource), users = db.getRepository(UserSchema);
  const accounts = [];
  t.after(async () => {
    try {
      for (const account of accounts.filter((account) => account.role === 'student')) {
        await db.getRepository(TrainerAssignmentSchema).delete({ studentId: account.id });
        await db.getRepository(TrainerRequestSchema).delete({ studentId: account.id });
      }
      for (const account of accounts) {
        await db.query("DELETE FROM sessions WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) = ?", [String(account.id)]);
        await users.delete({ id: account.id });
      }
    } finally { await app.close(); }
  });
  const password = 'Clave123', passwordHash = await hashPassword(password);
  for (const [role, lastName] of [['trainer', 'Uno'], ['trainer', 'Dos'], ['student', 'Zeta'], ['student', 'Alfa'], ['student', 'Ajeno'], ['student', 'Pendiente'], ['admin', 'Admin']]) {
    accounts.push(await users.save({ firstName: 'Prueba', lastName, email: `assigned-students-test-${randomUUID()}@example.test`, role, passwordHash }));
  }
  const [trainer, otherTrainer, student, secondStudent, otherStudent, pendingStudent, admin] = accounts;
  const call = (path, cookie, method = 'GET', body) => fetch(`http://127.0.0.1:${app.getHttpServer().address().port}/users/${path}`, {
    method, headers: { Origin: 'http://127.0.0.1:5173', ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const cookies = [];
  for (const account of [trainer, otherTrainer, student, admin]) {
    const response = await call('session', null, 'POST', { email: account.email, password });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
    cookies.push(response.headers.getSetCookie().find((header) => /Path=\/users;/i.test(header)).split(';')[0]);
  }
  const [trainerCookie, otherTrainerCookie, studentCookie, adminCookie] = cookies;
  assert.equal((await call('students')).status, 401);
  for (const cookie of [studentCookie, adminCookie]) assert.equal((await call('students', cookie)).status, 403);
  let response = await call('students', trainerCookie);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), []);

  response = await call('trainer-requests', studentCookie, 'POST', { trainerId: trainer.id });
  assert.equal(response.status, 201);
  const firstRequest = await response.json();
  assert.deepEqual(await (await call('students', trainerCookie)).json(), []);
  assert.equal((await call(`trainer-requests/${firstRequest.id}/accept`, trainerCookie, 'POST')).status, 204);
  const publicStudent = (account) => ({ id: account.id, firstName: account.firstName, lastName: account.lastName });
  assert.deepEqual(await (await call('students', trainerCookie)).json(), [publicStudent(student)]);

  const requests = app.get(TrainerRequests);
  for (const [account, recipient, cookie] of [[secondStudent, trainer, trainerCookie], [otherStudent, otherTrainer, otherTrainerCookie]]) {
    const request = await requests.send(account.id, recipient.id);
    assert.equal((await call(`trainer-requests/${request.id}/accept`, cookie, 'POST')).status, 204);
  }
  for (const action of ['reject', 'cancel']) {
    const request = await requests.send(pendingStudent.id, trainer.id);
    assert.equal((await call(`trainer-requests/${request.id}${action === 'cancel' ? '' : '/' + action}`, trainerCookie, action === 'cancel' ? 'DELETE' : 'POST')).status, 204);
  }
  await requests.send(pendingStudent.id, trainer.id);
  const expected = [publicStudent(secondStudent), publicStudent(student)];
  assert.deepEqual(await (await call('students', trainerCookie)).json(), expected);
  assert.deepEqual(await (await call(`students?trainerId=${otherTrainer.id}`, trainerCookie)).json(), expected);
  assert.deepEqual(await (await call('students', otherTrainerCookie)).json(), [publicStudent(otherStudent)]);
});
