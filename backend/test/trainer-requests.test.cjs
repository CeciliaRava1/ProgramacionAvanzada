const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('solo se crea una solicitud si el alumno no tiene una pendiente ni entrenador', async () => {
  const { createTrainerRequest, TrainerRequestConflictError } = await import('../dist/users/domain/trainer-request.js');
  assert.deepEqual(createTrainerRequest(1, 2, null, null), { studentId: 1, trainerId: 2, status: 'pending' });
  assert.throws(() => createTrainerRequest(1, 2, { studentId: 1, trainerId: 3 }, null), TrainerRequestConflictError);
  assert.throws(() => createTrainerRequest(1, 2, null, { studentId: 1, trainerId: 3, status: 'pending' }), TrainerRequestConflictError);
});

test('solo los participantes pueden responder y una solicitud resuelta no vuelve a cambiar', async () => {
  const { respondToTrainerRequest, TrainerRequestPermissionError, TrainerRequestConflictError } = await import('../dist/users/domain/trainer-request.js');
  const pending = { id: 1, studentId: 2, trainerId: 3, status: 'pending' };
  for (const status of ['accepted', 'rejected', 'cancelled']) {
    assert.equal(respondToTrainerRequest(pending, 3, status).status, status);
    assert.throws(() => respondToTrainerRequest(pending, 9, status), TrainerRequestPermissionError);
    assert.throws(() => respondToTrainerRequest({ ...pending, status: 'accepted' }, 3, status), TrainerRequestConflictError);
  }
  assert.equal(respondToTrainerRequest(pending, 2, 'cancelled').status, 'cancelled');
  for (const status of ['accepted', 'rejected']) assert.throws(() => respondToTrainerRequest(pending, 2, status), TrainerRequestPermissionError);
  assert.equal(pending.status, 'pending');
});

test('el estado y la bandeja entregan solo los datos públicos necesarios', async () => {
  const { TrainerRequests } = await import('../dist/users/application/trainer-requests.js');
  const user = { id: 7, firstName: 'Entrenador', lastName: 'Prueba', role: 'trainer', email: 'privado@example.test', passwordHash: 'hash', availability: null };
  let assignment = null, pending = null;
  const requests = new TrainerRequests({ findById: async () => user }, {
    withStudent: async (_id, action) => action({ findAssignment: async () => assignment, findPending: async () => pending }),
    findPendingByTrainer: async () => [{ id: 9, studentId: 1, trainerId: 7, firstName: 'Alumno', lastName: 'Prueba', passwordHash: 'no devolver' }],
  });
  assert.deepEqual(await requests.current(1), { status: 'unassigned' });
  pending = { id: 9, studentId: 1, trainerId: 7, status: 'pending' };
  const publicTrainer = { id: 7, firstName: 'Entrenador', lastName: 'Prueba', availability: null };
  assert.deepEqual(await requests.current(1), { status: 'pending', requestId: 9, trainer: publicTrainer });
  assignment = { studentId: 1, trainerId: 7 };
  assert.deepEqual(await requests.current(1), { status: 'assigned', trainer: publicTrainer });
  assert.deepEqual(await requests.received(7), [{ id: 9, student: { id: 1, firstName: 'Alumno', lastName: 'Prueba' } }]);
});

test('el controlador valida identificadores, toma el alumno de la sesión y oculta fallos internos', async () => {
  const { TrainerRequestsController } = await import('../dist/users/presentation/trainer-requests.controller.js');
  const calls = [];
  const controller = new TrainerRequestsController({ send: async (...args) => { calls.push(args); return {}; }, current: async () => { throw new Error('SQL y credenciales'); } });
  for (const body of [null, [], {}, { teacherId: 2 }, { trainerId: '1' }, { trainerId: 0 }, { trainerId: 1.2 }, { trainerId: 2, studentId: 8 }, { trainerId: 2, status: 'accepted' }]) {
    assert.throws(() => controller.send(body, { session: { userId: 1 } }), (error) => error.getStatus() === 400);
  }
  await controller.send({ trainerId: 2 }, { session: { userId: 1 } });
  assert.deepEqual(calls, [[1, 2]]);
  for (const id of ['x', '-1', '1.2', '4294967296']) assert.throws(() => controller.accept(id, { session: { userId: 2 } }), (error) => error.getStatus() === 400);
  await assert.rejects(controller.current({ session: { userId: 1 } }), (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
});

test('HTTP y MySQL protegen solicitudes, participación, concurrencia y persistencia del vínculo', { timeout: 45000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { UserSchema } = await import('../dist/users/infrastructure/typeorm-user.repository.js');
  const { TrainerRequestSchema, TrainerAssignmentSchema } = await import('../dist/users/infrastructure/typeorm-trainer-request.repository.js');
  const { TrainerRequestRepository } = await import('../dist/users/domain/trainer-request.repository.js');
  const { hashPassword } = await import('../dist/users/infrastructure/hash-password.js');
  const start = async () => { const instance = await NestFactory.create(AppModule, { logger: false, abortOnError: false }); await instance.listen(0, '127.0.0.1'); return instance; };
  let app = await start(), db = app.get(DataSource);
  let users = db.getRepository(UserSchema), requests = db.getRepository(TrainerRequestSchema), assignments = db.getRepository(TrainerAssignmentSchema);
  const accounts = [], emails = Array.from({ length: 5 }, () => `request-test-${randomUUID()}@example.test`);
  t.after(async () => {
    try {
      for (const account of accounts.filter((account) => account.role === 'student')) {
        await assignments.delete({ studentId: account.id });
        await requests.delete({ studentId: account.id });
      }
      for (const account of accounts) {
        await db.query("DELETE FROM sessions WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) = ?", [String(account.id)]);
        await users.delete({ id: account.id });
      }
    } finally { await app.close(); }
  });
  const password = 'Clave123', passwordHash = await hashPassword(password);
  for (const [index, role] of ['student', 'student', 'trainer', 'trainer', 'admin'].entries()) {
    accounts.push(await users.save({ firstName: 'Cuenta', lastName: 'Prueba', email: emails[index], role, passwordHash }));
  }
  const [student, otherStudent, trainer, otherTrainer] = accounts;
  const call = async (path, method = 'GET', cookie, body, origin = 'http://127.0.0.1:5173') => fetch((await app.getUrl()) + '/users/' + path, {
    method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const cookies = [];
  for (const account of accounts) {
    const response = await call('session', 'POST', null, { email: account.email, password });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
    cookies.push(response.headers.getSetCookie().find((header) => /Path=\/users;/i.test(header)).split(';')[0]);
  }
  const [studentCookie, otherStudentCookie, trainerCookie, otherTrainerCookie, adminCookie] = cookies;
  const root = 'trainer-requests';
  const state = async () => { const response = await call(root + '/current', 'GET', studentCookie); assert.equal(response.status, 200); return response.json(); };
  const send = (cookie = studentCookie, trainerId = trainer.id) => call(root, 'POST', cookie, { trainerId });
  const respond = (id, action, cookie) => call(root + '/' + id + (action === 'cancel' ? '' : '/' + action), action === 'cancel' ? 'DELETE' : 'POST', cookie);
  for (const [path, method, body] of [[root + '/current', 'GET'], [root, 'GET'], [root, 'POST', { trainerId: trainer.id }], [root + '/1/accept', 'POST'], [root + '/1/reject', 'POST'], [root + '/1', 'DELETE']]) {
    assert.equal((await call(path, method, null, body)).status, 401);
  }
  assert.equal((await call(root + '/current', 'GET', trainerCookie)).status, 403);
  assert.equal((await call(root, 'GET', studentCookie)).status, 403);
  assert.equal((await send(trainerCookie)).status, 403);
  assert.equal((await send(adminCookie)).status, 403);
  assert.equal((await call(root, 'POST', studentCookie, { trainerId: trainer.id }, 'http://otro.example')).status, 403);
  for (const body of [{ trainerId: '1' }, { trainerId: 0 }, { trainerId: trainer.id, studentId: otherStudent.id }]) assert.equal((await call(root, 'POST', studentCookie, body)).status, 400);
  assert.equal((await send(studentCookie, otherStudent.id)).status, 404);
  assert.deepEqual(await state(), { status: 'unassigned' });

  // Un error después de insertar el vínculo debe revertir también esa inserción.
  await assert.rejects(app.get(TrainerRequestRepository).withStudent(student.id, async (transaction) => {
    await transaction.saveAssignment({ studentId: student.id, trainerId: trainer.id });
    await transaction.saveRequest({ studentId: student.id, trainerId: trainer.id, status: 'invalid' });
  }));
  assert.equal(await assignments.countBy({ studentId: student.id }), 0);
  assert.equal(await requests.countBy({ studentId: student.id }), 0);

  let response = await send();
  assert.equal(response.status, 201);
  const first = await response.json();
  assert.deepEqual(Object.keys(first).sort(), ['id', 'status', 'trainerId']);
  assert.equal(first.status, 'pending');
  assert.equal((await state()).requestId, first.id);
  for (const target of [trainer.id, otherTrainer.id]) assert.equal((await send(studentCookie, target)).status, 409);
  for (const cookie of [otherStudentCookie, otherTrainerCookie]) assert.equal((await respond(first.id, 'cancel', cookie)).status, 403);
  assert.equal((await respond(first.id, 'accept', otherTrainerCookie)).status, 403);
  assert.equal((await respond(first.id, 'reject', otherTrainerCookie)).status, 403);
  assert.equal((await respond(first.id, 'accept', studentCookie)).status, 403);
  const received = await call(root, 'GET', trainerCookie);
  const ownRequest = (await received.json()).find((request) => request.id === first.id);
  assert.deepEqual(ownRequest, { id: first.id, student: { id: student.id, firstName: 'Cuenta', lastName: 'Prueba' } });
  assert.ok(!(await (await call(root, 'GET', otherTrainerCookie)).json()).some((request) => request.id === first.id));
  assert.equal((await respond(first.id, 'cancel', studentCookie)).status, 204);
  assert.equal((await requests.findOneByOrFail({ id: first.id })).status, 'cancelled');
  assert.deepEqual(await state(), { status: 'unassigned' });
  assert.equal((await respond(first.id, 'accept', trainerCookie)).status, 409);
  assert.equal((await respond(4_294_967_295, 'cancel', studentCookie)).status, 404);

  for (const action of ['cancel', 'reject']) {
    const request = await (await send()).json();
    assert.equal((await respond(request.id, action, trainerCookie)).status, 204);
    assert.equal((await requests.findOneByOrFail({ id: request.id })).status, action === 'cancel' ? 'cancelled' : 'rejected');
    assert.deepEqual(await state(), { status: 'unassigned' });
  }
  const concurrent = await Promise.all([send(studentCookie, trainer.id), send(studentCookie, otherTrainer.id)]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
  const onlyPending = await requests.find({ where: { studentId: student.id, status: 'pending' } });
  assert.equal(onlyPending.length, 1);
  assert.equal((await respond(onlyPending[0].id, 'cancel', studentCookie)).status, 204);

  const racing = await (await send()).json();
  const race = await Promise.all([respond(racing.id, 'accept', trainerCookie), respond(racing.id, 'cancel', studentCookie)]);
  assert.deepEqual(race.map((response) => response.status).sort(), [204, 409]);
  const raceRecord = await requests.findOneByOrFail({ id: racing.id });
  assert.equal(await assignments.countBy({ studentId: student.id }), raceRecord.status === 'accepted' ? 1 : 0);

  const final = await (await send(otherStudentCookie, otherTrainer.id)).json();
  const accepts = await Promise.all([respond(final.id, 'accept', otherTrainerCookie), respond(final.id, 'accept', otherTrainerCookie)]);
  assert.deepEqual(accepts.map((response) => response.status).sort(), [204, 409]);
  assert.equal(await assignments.countBy({ studentId: otherStudent.id }), 1);
  for (const cookie of [otherStudentCookie, otherTrainerCookie]) assert.equal((await respond(final.id, 'cancel', cookie)).status, 409);
  assert.equal((await send(otherStudentCookie, trainer.id)).status, 409);
  const assigned = await (await call(root + '/current', 'GET', otherStudentCookie)).json();
  assert.equal(assigned.status, 'assigned');
  assert.equal(assigned.trainer.id, otherTrainer.id);
  assert.deepEqual(Object.keys(assigned.trainer).sort(), ['availability', 'firstName', 'id', 'lastName']);

  await app.close();
  app = await start(); db = app.get(DataSource);
  users = db.getRepository(UserSchema); requests = db.getRepository(TrainerRequestSchema); assignments = db.getRepository(TrainerAssignmentSchema);
  const restored = await call(root + '/current', 'GET', otherStudentCookie);
  assert.equal(restored.status, 200);
  assert.deepEqual(await restored.json(), assigned);
});
