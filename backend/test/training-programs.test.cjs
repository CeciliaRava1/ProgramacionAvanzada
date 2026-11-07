const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

const input = { name: 'Programa 1', startDate: '2026-05-11', endDate: '2026-06-05' };

test('el programa valida nombre y fechas reales sin imponer duración ni activación por calendario', async () => {
  const { createTrainingProgram, InvalidTrainingProgramError } = await import('../dist/plans/domain/training-program.js');
  assert.deepEqual(createTrainingProgram(2, { ...input, name: ' Programa 1 ' }), { planId: 2, ...input });
  for (const [startDate, endDate] of [['2024-02-29', '2024-02-29'], ['1000-01-01', '9999-12-31']]) {
    assert.equal(createTrainingProgram(2, { ...input, startDate, endDate }).endDate, endDate);
  }
  assert.equal([...createTrainingProgram(2, { ...input, name: '\u{10400}'.repeat(200) }).name].length, 200);
  for (const [field, value] of [['name', ' '], ['name', 'x'.repeat(201)], ['startDate', '2026-02-29'], ['startDate', '2026-04-31'], ['startDate', '11/05/2026'], ['startDate', '2026-5-11'], ['startDate', '0000-01-01'], ['endDate', ''], ['endDate', '2026-05-10'], ['endDate', '2026-06-05T00:00:00Z']]) {
    assert.throws(() => createTrainingProgram(2, { ...input, [field]: value }), (error) => error instanceof InvalidTrainingProgramError && Boolean(error.fieldErrors[field]));
  }
});

test('los casos de uso reutilizan los permisos del plan antes de consultar o guardar y no exponen datos internos', async () => {
  const { TrainingPrograms } = await import('../dist/plans/application/training-programs.js');
  const { PlanAccessError } = await import('../dist/plans/application/training-plans.js');
  const { TrainingPlanNotFoundError } = await import('../dist/plans/domain/training-plan.js');
  const { TrainingProgramAlreadyExistsError, InvalidTrainingProgramError } = await import('../dist/plans/domain/training-program.js');
  let allowed = true, planExists = true, reads = 0, writes = 0;
  const saved = { id: 4, planId: 2, ...input };
  const service = new TrainingPrograms({
    findByPlan: async (id) => { assert.equal(id, 2); reads++; return writes ? [{ ...saved, internal: true }] : []; },
    save: async (program) => { assert.deepEqual(program, { planId: 2, ...input }); writes++; return { ...saved, internal: true }; },
  }, { list: async (trainerId, studentId) => { assert.equal(trainerId, 1); assert.equal(studentId, 3); if (!allowed) throw new PlanAccessError(); return planExists ? [{ id: 2 }] : []; } });
  assert.deepEqual(await service.list(1, 3, 2), []);
  allowed = false;
  await assert.rejects(service.create(1, 3, 2, input), PlanAccessError);
  await assert.rejects(service.list(1, 3, 2), PlanAccessError);
  allowed = true; planExists = false;
  await assert.rejects(service.create(1, 3, 2, input), TrainingPlanNotFoundError);
  await assert.rejects(service.list(1, 3, 2), TrainingPlanNotFoundError);
  planExists = true;
  await assert.rejects(service.create(1, 3, 2, { ...input, endDate: '' }), InvalidTrainingProgramError);
  assert.equal(reads, 1); assert.equal(writes, 0);
  assert.deepEqual(await service.create(1, 3, 2, { ...input, name: ' Programa 1 ' }), saved);
  assert.deepEqual(await service.list(1, 3, 2), [saved]);
  await assert.rejects(service.create(1, 3, 2, input), TrainingProgramAlreadyExistsError);
  assert.equal(writes, 1);
});

test('el controlador exige campos permitidos, toma el entrenador de la sesión y oculta errores internos', async () => {
  const { TrainingProgramsController } = await import('../dist/plans/presentation/training-programs.controller.js');
  const { PlanAccessError } = await import('../dist/plans/application/training-plans.js');
  const { TrainingPlanNotFoundError } = await import('../dist/plans/domain/training-plan.js');
  const { InvalidTrainingProgramError, TrainingProgramAlreadyExistsError } = await import('../dist/plans/domain/training-program.js');
  const calls = [], req = { session: { usuarioId: 7 }, query: { trainerId: 9 } };
  const controller = new TrainingProgramsController({ list: async (...args) => { calls.push(args); }, create: async (...args) => { calls.push(args); } });
  for (const id of ['x', '-1', '0', '1.2', '4294967296']) {
    assert.throws(() => controller.list(id, '2', req), (error) => error.getStatus() === 400);
    assert.throws(() => controller.create('3', id, input, req), (error) => error.getStatus() === 400);
  }
  for (const body of [null, [], {}, { ...input, name: 1 }, { ...input, startDate: null }, { ...input, endDate: [] }, ...['trainerId', 'studentId', 'planId', 'id', 'active', 'routines'].map((field) => ({ ...input, [field]: 1 }))]) {
    assert.throws(() => controller.create('3', '2', body, req), (error) => error.getStatus() === 400);
  }
  await controller.list('3', '2', req); await controller.create('3', '2', input, req);
  assert.deepEqual(calls, [[7, 3, 2], [7, 3, 2, input]]);
  for (const [error, status] of [[new PlanAccessError('Sin permiso'), 403], [new TrainingPlanNotFoundError(), 404], [new InvalidTrainingProgramError({ endDate: 'Inválida' }), 400], [new TrainingProgramAlreadyExistsError(), 409], [new Error('SQL y credenciales'), 500]]) {
    const failing = new TrainingProgramsController({ list: async () => { throw error; } });
    await assert.rejects(failing.list('3', '2', req), (failure) => failure.getStatus() === status && !JSON.stringify(failure.getResponse()).includes('SQL'));
  }
});

test('HTTP y MySQL protegen programas, creaciones simultáneas, persistencia y planes eliminados', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { EsquemaDeVinculacion } = await import('../dist/usuarios/infraestructura/repositorio-de-solicitudes-typeorm.js');
  const { TrainingPlanSchema } = await import('../dist/plans/infrastructure/typeorm-training-plan.repository.js');
  const { TrainingProgramSchema, TypeOrmTrainingProgramRepository } = await import('../dist/plans/infrastructure/typeorm-training-program.repository.js');
  const { TrainingPlanNotFoundError } = await import('../dist/plans/domain/training-plan.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const start = async () => { const instance = await NestFactory.create(AppModule, { logger: false, abortOnError: false }); await instance.listen(0, '127.0.0.1'); return instance; };
  let app = await start(), db = app.get(DataSource);
  let users = db.getRepository(EsquemaDeUsuario), plans = db.getRepository(TrainingPlanSchema), programs = db.getRepository(TrainingProgramSchema);
  const accounts = [];
  t.after(async () => {
    try {
      for (const account of accounts.filter((user) => user.rol === 'alumno')) {
        await db.query('DELETE FROM training_programs WHERE plan_id IN (SELECT id FROM training_plans WHERE student_id = ?)', [account.id]);
        await plans.delete({ studentId: account.id }); await db.getRepository(EsquemaDeVinculacion).delete({ alumnoId: account.id });
      }
      for (const account of accounts) {
        await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(account.id)]);
        await users.delete({ id: account.id });
      }
    } finally { await app.close(); }
  });
  const password = 'Clave123', passwordHash = await hashearContrasena(password);
  for (const role of ['entrenador', 'entrenador', 'alumno', 'alumno', 'administrador']) accounts.push(await users.save({ nombre: 'Prueba', apellido: 'Programas', correo: `training-program-test-${randomUUID()}@example.test`, rol: role, hashDeContrasena: passwordHash }));
  const [trainer, otherTrainer, student, otherStudent, admin] = accounts;
  await db.getRepository(EsquemaDeVinculacion).insert([{ alumnoId: student.id, entrenadorId: trainer.id }, { alumnoId: otherStudent.id, entrenadorId: trainer.id }]);
  const [plan, otherPlan] = await plans.save([{ studentId: student.id, name: 'Plan prueba', objective: 'Objetivo' }, { studentId: otherStudent.id, name: 'Otro plan', objective: 'Objetivo' }]);
  const call = (route, method = 'GET', cookie, body, origin = 'http://127.0.0.1:5173') => fetch(`http://127.0.0.1:${app.getHttpServer().address().port}/${route === 'sesion' ? 'usuarios' : 'users'}/${route}`, {
    method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const cookies = [];
  for (const account of [trainer, otherTrainer, student, admin]) {
    const response = await call('sesion', 'POST', null, { correo: account.correo, contrasena: password });
    assert.equal(response.status, 200); await response.arrayBuffer();
    cookies.push(response.headers.getSetCookie().find((header) => /Path=\/;/i.test(header)).split(';')[0]);
  }
  const [trainerCookie, otherTrainerCookie, studentCookie, adminCookie] = cookies;
  const route = `students/${student.id}/plans/${plan.id}/programs`;
  for (const method of ['GET', 'POST']) {
    const body = method === 'POST' ? input : undefined;
    assert.equal((await call(route, method, null, body)).status, 401);
    for (const cookie of [otherTrainerCookie, studentCookie, adminCookie]) assert.equal((await call(route, method, cookie, body)).status, 403);
    assert.equal((await call(`students/${otherStudent.id}/plans/${plan.id}/programs`, method, trainerCookie, body)).status, 404);
    assert.equal((await call(`students/${student.id}/plans/4294967295/programs`, method, trainerCookie, body)).status, 404);
  }
  assert.equal((await call(route, 'POST', trainerCookie, input, 'http://otro.example')).status, 403);
  for (const body of [{ ...input, planId: otherPlan.id }, { ...input, active: true }, { ...input, startDate: '2026-02-29' }, { ...input, endDate: '2026-05-10' }, { ...input, name: ' ' }]) {
    assert.equal((await call(route, 'POST', trainerCookie, body)).status, 400);
  }
  let response = await call(route, 'GET', trainerCookie);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(await response.json(), []);
  response = await call(route, 'POST', trainerCookie, { ...input, name: ' Programa 1 ' });
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.deepEqual(saved, { id: saved.id, planId: plan.id, ...input });
  assert.deepEqual(await programs.findOneByOrFail({ id: saved.id }), saved);
  assert.equal((await call(route, 'POST', trainerCookie, { ...input, name: 'No reemplazar' })).status, 409);
  assert.deepEqual(await programs.findOneByOrFail({ id: saved.id }), saved);
  await assert.rejects(programs.insert({ planId: plan.id, ...input }), (error) => error.driverError?.code === 'ER_DUP_ENTRY');
  const otherRoute = `students/${otherStudent.id}/plans/${otherPlan.id}/programs`;
  const simultaneous = await Promise.all([call(otherRoute, 'POST', trainerCookie, input), call(otherRoute, 'POST', trainerCookie, input)]);
  assert.deepEqual(simultaneous.map((result) => result.status).sort(), [201, 409]);
  assert.equal(await programs.countBy({ planId: otherPlan.id }), 1);
  await app.close(); app = await start(); db = app.get(DataSource);
  users = db.getRepository(EsquemaDeUsuario); plans = db.getRepository(TrainingPlanSchema); programs = db.getRepository(TrainingProgramSchema);
  response = await call(route, 'GET', trainerCookie);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), [saved]);
  assert.equal((await call(`students/${student.id}/plans/${plan.id}`, 'DELETE', trainerCookie)).status, 204);
  assert.deepEqual(await programs.findOneByOrFail({ id: saved.id }), saved);
  for (const method of ['GET', 'POST']) assert.equal((await call(route, method, trainerCookie, method === 'POST' ? input : undefined)).status, 404);
  const repository = new TypeOrmTrainingProgramRepository(db);
  assert.deepEqual(await repository.findByPlan(plan.id), []);
  await assert.rejects(repository.save({ planId: plan.id, ...input }), TrainingPlanNotFoundError);
  const replacement = await plans.save({ studentId: student.id, name: 'Plan nuevo', objective: 'Objetivo' });
  assert.deepEqual(await (await call(`students/${student.id}/plans/${replacement.id}/programs`, 'GET', trainerCookie)).json(), []);
  await assert.rejects(programs.insert({ planId: replacement.id, ...input, endDate: '2026-05-10' }), (error) => error.driverError?.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
  const runner = db.createQueryRunner();
  await runner.connect(); await runner.startTransaction();
  let pendingWrite;
  try {
    await runner.manager.getRepository(TrainingPlanSchema).softDelete({ id: replacement.id });
    pendingWrite = assert.rejects(repository.save({ planId: replacement.id, ...input }), TrainingPlanNotFoundError);
    await runner.commitTransaction(); await pendingWrite;
    assert.equal(await programs.countBy({ planId: replacement.id }), 0);
  } finally { if (runner.isTransactionActive) await runner.rollbackTransaction(); await runner.release(); }
});
