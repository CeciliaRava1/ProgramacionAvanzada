const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('la rutina tiene nombre libre obligatorio y descripción opcional con límites Unicode', async () => {
  const { createTrainingRoutine, InvalidTrainingRoutineError } = await import('../dist/plans/domain/training-routine.js');
  for (const description of [undefined, null, '', '  \n ']) assert.deepEqual(createTrainingRoutine(2, { name: ' Push / libre ', description }), { programId: 2, name: 'Push / libre', description: null });
  assert.equal(createTrainingRoutine(2, { name: 'Rutina', description: ' Texto\nlibre ' }).description, 'Texto\nlibre');
  assert.equal([...createTrainingRoutine(2, { name: '\u{10400}'.repeat(200), description: '\u{10400}'.repeat(5000) }).description].length, 5000);
  for (const [name, description, field] of [[' ', null, 'name'], ['x'.repeat(201), null, 'name'], ['Rutina', 'x'.repeat(5001), 'description']]) assert.throws(() => createTrainingRoutine(2, { name, description }), (error) => error instanceof InvalidTrainingRoutineError && Boolean(error.fieldErrors[field]));
});

test('los casos de uso comprueban el programa autorizado antes de consultar o guardar y proyectan solo datos públicos', async () => {
  const { TrainingRoutines } = await import('../dist/plans/application/training-routines.js');
  const { PlanAccessError } = await import('../dist/plans/application/training-plans.js');
  const { TrainingProgramNotFoundError, InvalidTrainingRoutineError } = await import('../dist/plans/domain/training-routine.js');
  let allowed = true, exists = true, reads = 0, writes = 0;
  const saved = { id: 5, programId: 4, name: 'Push', description: null };
  const service = new TrainingRoutines({
    findByProgram: async (id) => { assert.equal(id, 4); reads++; return [{ ...saved, internal: true }]; },
    save: async (routine) => { assert.deepEqual(routine, { programId: 4, name: 'Push', description: null }); writes++; return { ...saved, internal: true }; },
  }, { list: async (...args) => { assert.deepEqual(args, [1, 2, 3]); if (!allowed) throw new PlanAccessError(); return exists ? [{ id: 4 }] : []; } });
  assert.deepEqual(await service.list(1, 2, 3, 4), [saved]);
  assert.deepEqual(await service.create(1, 2, 3, 4, { name: ' Push ' }), saved);
  allowed = false;
  await assert.rejects(service.list(1, 2, 3, 4), PlanAccessError);
  await assert.rejects(service.create(1, 2, 3, 4, { name: 'Push' }), PlanAccessError);
  allowed = true; exists = false;
  await assert.rejects(service.list(1, 2, 3, 4), TrainingProgramNotFoundError);
  await assert.rejects(service.create(1, 2, 3, 4, { name: 'Push' }), TrainingProgramNotFoundError);
  exists = true;
  await assert.rejects(service.create(1, 2, 3, 4, { name: '' }), InvalidTrainingRoutineError);
  assert.equal(reads, 1); assert.equal(writes, 1);
});

test('el controlador valida campos e identificadores, usa la sesión y oculta errores internos', async () => {
  const { TrainingRoutinesController } = await import('../dist/plans/presentation/training-routines.controller.js');
  const { PlanAccessError } = await import('../dist/plans/application/training-plans.js');
  const { TrainingPlanNotFoundError } = await import('../dist/plans/domain/training-plan.js');
  const { TrainingProgramNotFoundError, TrainingRoutineNotFoundError, InvalidTrainingRoutineError } = await import('../dist/plans/domain/training-routine.js');
  const calls = [], req = { session: { userId: 1 }, query: { trainerId: 99 } };
  const controller = new TrainingRoutinesController({ list: async (...args) => { calls.push(args); }, create: async (...args) => { calls.push(args); }, update: async (...args) => { calls.push(args); } });
  for (const id of ['x', '0', '-1', '1.2', '4294967296']) for (const ids of [[id, '3', '4'], ['2', id, '4'], ['2', '3', id]]) assert.throws(() => controller.list(...ids, req), (error) => error.getStatus() === 400);
  for (const body of [null, [], {}, { name: 1 }, { name: 'Push', description: 2 }, ...['trainerId', 'studentId', 'planId', 'programId', 'id', 'dayNumber', 'exercises'].map((field) => ({ name: 'Push', [field]: 1 }))]) assert.throws(() => controller.create('2', '3', '4', body, req), (error) => error.getStatus() === 400);
  await controller.list('2', '3', '4', req);
  await controller.create('2', '3', '4', { name: 'Push' }, req);
  await controller.update('2', '3', '4', '5', { name: 'Push' }, req);
  assert.deepEqual(calls, [[1, 2, 3, 4], [1, 2, 3, 4, { name: 'Push', description: undefined }], [1, 2, 3, 4, 5, { name: 'Push', description: undefined }]]);
  assert.throws(() => controller.update('2', '3', '4', 'x', { name: 'Push' }, req), (error) => error.getStatus() === 400);
  assert.throws(() => controller.update('2', '3', '4', '5', { name: 'Push', programId: 9 }, req), (error) => error.getStatus() === 400);
  for (const [error, status] of [[new PlanAccessError('Sin permiso'), 403], [new TrainingPlanNotFoundError(), 404], [new TrainingProgramNotFoundError(), 404], [new TrainingRoutineNotFoundError(), 404], [new InvalidTrainingRoutineError({ name: 'Inválido' }), 400], [new Error('SQL y credenciales'), 500]]) await assert.rejects(new TrainingRoutinesController({ list: async () => { throw error; } }).list('2', '3', '4', req), (failure) => failure.getStatus() === status && !JSON.stringify(failure.getResponse()).includes('SQL'));
});

test('editar autoriza primero, valida sin escribir y conserva la identidad de la rutina', async () => {
  const { TrainingRoutines } = await import('../dist/plans/application/training-routines.js');
  const { PlanAccessError } = await import('../dist/plans/application/training-plans.js');
  const { InvalidTrainingRoutineError, TrainingRoutineNotFoundError } = await import('../dist/plans/domain/training-routine.js');
  let allowed = true, found = true;
  const calls = [];
  const service = new TrainingRoutines({ update: async (...args) => { calls.push(args); return found ? { id: 5, programId: 4, ...args[2], internal: true } : null; } },
    { list: async (...args) => { assert.deepEqual(args, [1, 2, 3]); if (!allowed) throw new PlanAccessError(); return [{ id: 4 }]; } });
  assert.deepEqual(await service.update(1, 2, 3, 4, 5, { name: ' Push ', description: '  ' }), { id: 5, programId: 4, name: 'Push', description: null });
  assert.deepEqual(calls, [[5, 4, { name: 'Push', description: null }]]);
  allowed = false;
  await assert.rejects(service.update(1, 2, 3, 4, 5, { name: 'Push' }), PlanAccessError);
  allowed = true;
  await assert.rejects(service.update(1, 2, 3, 4, 5, { name: '' }), InvalidTrainingRoutineError);
  assert.equal(calls.length, 1);
  found = false;
  await assert.rejects(service.update(1, 2, 3, 4, 5, { name: 'Push' }), TrainingRoutineNotFoundError);
});

test('HTTP y MySQL guardan varias rutinas y protegen identidad, pertenencia, persistencia y retirada del plan', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { UserSchema } = await import('../dist/users/infrastructure/typeorm-user.repository.js');
  const { TrainerAssignmentSchema } = await import('../dist/users/infrastructure/typeorm-trainer-request.repository.js');
  const { TrainingPlanSchema } = await import('../dist/plans/infrastructure/typeorm-training-plan.repository.js');
  const { TrainingProgramSchema } = await import('../dist/plans/infrastructure/typeorm-training-program.repository.js');
  const { TrainingRoutineSchema, TypeOrmTrainingRoutineRepository } = await import('../dist/plans/infrastructure/typeorm-training-routine.repository.js');
  const { TrainingProgramNotFoundError } = await import('../dist/plans/domain/training-routine.js');
  const { hashPassword } = await import('../dist/users/infrastructure/hash-password.js');
  const start = async () => { const instance = await NestFactory.create(AppModule, { logger: false, abortOnError: false }); await instance.listen(0, '127.0.0.1'); return instance; };
  let app = await start(), db = app.get(DataSource);
  let users = db.getRepository(UserSchema), plans = db.getRepository(TrainingPlanSchema), programs = db.getRepository(TrainingProgramSchema), routines = db.getRepository(TrainingRoutineSchema);
  const accounts = [];
  t.after(async () => {
    try {
      for (const account of accounts.filter((user) => user.role === 'student')) {
        await db.query('DELETE FROM training_routines WHERE program_id IN (SELECT id FROM training_programs WHERE plan_id IN (SELECT id FROM training_plans WHERE student_id = ?))', [account.id]);
        await db.query('DELETE FROM training_programs WHERE plan_id IN (SELECT id FROM training_plans WHERE student_id = ?)', [account.id]);
        await plans.delete({ studentId: account.id }); await db.getRepository(TrainerAssignmentSchema).delete({ studentId: account.id });
      }
      for (const account of accounts) { await db.query("DELETE FROM sessions WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) = ?", [String(account.id)]); await users.delete({ id: account.id }); }
    } finally { await app.close(); }
  });
  const password = 'Clave123', passwordHash = await hashPassword(password);
  for (const role of ['trainer', 'trainer', 'student', 'student', 'admin']) accounts.push(await users.save({ firstName: 'Prueba', lastName: 'Rutinas', email: `training-routine-test-${randomUUID()}@example.test`, role, passwordHash }));
  const [trainer, otherTrainer, student, otherStudent, admin] = accounts;
  await db.getRepository(TrainerAssignmentSchema).insert([{ studentId: student.id, trainerId: trainer.id }, { studentId: otherStudent.id, trainerId: trainer.id }]);
  const [plan, otherPlan] = await plans.save([{ studentId: student.id, name: 'Plan prueba', objective: 'Objetivo' }, { studentId: otherStudent.id, name: 'Otro plan', objective: 'Objetivo' }]);
  const [program, otherProgram] = await programs.save([{ planId: plan.id, name: 'Programa', startDate: '2026-05-11', endDate: '2026-06-05' }, { planId: otherPlan.id, name: 'Otro programa', startDate: '2026-05-11', endDate: '2026-06-05' }]);
  const call = (route, method = 'GET', cookie, body, origin = 'http://127.0.0.1:5173') => fetch(`http://127.0.0.1:${app.getHttpServer().address().port}/users/${route}`, {
    method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const cookies = [];
  for (const account of [trainer, otherTrainer, student, admin]) {
    const response = await call('session', 'POST', null, { email: account.email, password });
    assert.equal(response.status, 200); await response.arrayBuffer(); cookies.push(response.headers.getSetCookie().find((header) => /Path=\/users;/i.test(header)).split(';')[0]);
  }
  const [trainerCookie, otherTrainerCookie, studentCookie, adminCookie] = cookies;
  const route = `students/${student.id}/plans/${plan.id}/programs/${program.id}/routines`;
  for (const method of ['GET', 'POST']) {
    const body = method === 'POST' ? { name: 'Push' } : undefined;
    assert.equal((await call(route, method, null, body)).status, 401);
    for (const cookie of [otherTrainerCookie, studentCookie, adminCookie]) assert.equal((await call(route, method, cookie, body)).status, 403);
    for (const wrongRoute of [`students/${otherStudent.id}/plans/${plan.id}/programs/${program.id}/routines`, `students/${student.id}/plans/${plan.id}/programs/${otherProgram.id}/routines`, `students/${student.id}/plans/${plan.id}/programs/4294967295/routines`]) assert.equal((await call(wrongRoute, method, trainerCookie, body)).status, 404);
  }
  assert.equal((await call(route, 'POST', trainerCookie, { name: 'Push' }, 'http://otro.example')).status, 403);
  for (const body of [{ name: '' }, { name: 'x'.repeat(201) }, { name: 'Push', description: 'x'.repeat(5001) }, { name: 'Push', description: 2 }, { name: 'Push', programId: otherProgram.id }]) assert.equal((await call(route, 'POST', trainerCookie, body)).status, 400);
  let response = await call(route, 'GET', trainerCookie);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(await response.json(), []);
  const expected = [];
  for (const body of [{ name: ' Push ' }, { name: 'Pull', description: ' Texto\nlibre ' }, { name: 'Piernas', description: '  ' }, { name: 'Full body', description: null }]) {
    response = await call(route, 'POST', trainerCookie, body); assert.equal(response.status, 201);
    const saved = await response.json();
    assert.deepEqual(saved, { id: saved.id, programId: program.id, name: body.name.trim(), description: body.description?.trim() || null });
    expected.push(saved);
  }
  const concurrent = await Promise.all([call(route, 'POST', trainerCookie, { name: 'Rutina A' }), call(route, 'POST', trainerCookie, { name: 'Rutina B' })]);
  for (const result of concurrent) { assert.equal(result.status, 201); expected.push(await result.json()); }
  expected.sort((a, b) => a.id - b.id);
  assert.equal(await routines.countBy({ programId: program.id }), 6);
  const target = route + '/' + expected[0].id;
  assert.equal((await call(target, 'PUT', null, { name: 'No guardar' })).status, 401);
  for (const cookie of [otherTrainerCookie, studentCookie, adminCookie]) assert.equal((await call(target, 'PUT', cookie, { name: 'No guardar' })).status, 403);
  assert.equal((await call(target, 'PUT', trainerCookie, { name: 'No guardar' }, 'http://otro.example')).status, 403);
  assert.equal((await call(`students/${otherStudent.id}/plans/${otherPlan.id}/programs/${otherProgram.id}/routines/${expected[0].id}`, 'PUT', trainerCookie, { name: 'No mover' })).status, 404);
  assert.equal((await call(route + '/4294967295', 'PUT', trainerCookie, { name: 'No insertar' })).status, 404);
  for (const body of [{ name: ' ' }, { name: 'Push', description: 'x'.repeat(5001) }, { name: 'Push', programId: otherProgram.id }, { name: 'Push', id: expected[1].id }]) assert.equal((await call(target, 'PUT', trainerCookie, body)).status, 400);
  const edited = { name: ' Push editado ', description: ' Descripción editada ' };
  response = await call(target, 'PUT', trainerCookie, edited); assert.equal(response.status, 200);
  expected[0] = { ...expected[0], name: 'Push editado', description: 'Descripción editada' };
  assert.deepEqual(await response.json(), expected[0]);
  assert.equal((await call(target, 'PUT', trainerCookie, edited)).status, 200);
  response = await call(target, 'PUT', trainerCookie, { name: 'Push editado' }); assert.equal(response.status, 200);
  expected[0].description = null; assert.deepEqual(await response.json(), expected[0]);
  assert.equal(await routines.countBy({ programId: program.id }), 6);
  await app.close(); app = await start(); db = app.get(DataSource);
  users = db.getRepository(UserSchema); plans = db.getRepository(TrainingPlanSchema); programs = db.getRepository(TrainingProgramSchema); routines = db.getRepository(TrainingRoutineSchema);
  response = await call(route, 'GET', trainerCookie); assert.equal(response.status, 200); assert.deepEqual(await response.json(), expected);
  assert.equal((await call(`students/${student.id}/plans/${plan.id}`, 'DELETE', trainerCookie)).status, 204);
  assert.deepEqual(await routines.find({ where: { programId: program.id }, order: { id: 'ASC' } }), expected);
  for (const method of ['GET', 'POST']) assert.equal((await call(route, method, trainerCookie, method === 'POST' ? { name: 'No guardar' } : undefined)).status, 404);
  assert.equal((await call(target, 'PUT', trainerCookie, { name: 'No guardar' })).status, 404);
  const repository = new TypeOrmTrainingRoutineRepository(db);
  assert.deepEqual(await repository.findByProgram(program.id), []);
  await assert.rejects(repository.save({ programId: program.id, name: 'No guardar', description: null }), TrainingProgramNotFoundError);
  await assert.rejects(repository.update(expected[0].id, program.id, { name: 'No guardar', description: null }), TrainingProgramNotFoundError);
  await assert.rejects(routines.insert({ programId: 4294967295, name: 'No guardar', description: null }), (error) => error.driverError?.code === 'ER_NO_REFERENCED_ROW_2');
  const protectedRoutine = await routines.save({ programId: otherProgram.id, name: 'Conservar', description: null });
  const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction();
  try {
    await runner.manager.getRepository(TrainingPlanSchema).softDelete({ id: otherPlan.id });
    const pendingWrite = assert.rejects(repository.save({ programId: otherProgram.id, name: 'No guardar', description: null }), TrainingProgramNotFoundError);
    const pendingUpdate = assert.rejects(repository.update(protectedRoutine.id, otherProgram.id, { name: 'No guardar', description: null }), TrainingProgramNotFoundError);
    await runner.commitTransaction(); await Promise.all([pendingWrite, pendingUpdate]);
    assert.deepEqual(await routines.findOneByOrFail({ id: protectedRoutine.id }), protectedRoutine);
  } finally { if (runner.isTransactionActive) await runner.rollbackTransaction(); await runner.release(); }
});
