const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('la consulta propia admite planificación incompleta y devuelve solo campos públicos', async () => {
  const { StudentPlanning } = await import('../dist/plans/application/student-planning.js');
  const plan = { id: 3, studentId: 2, name: 'Plan', objective: 'Objetivo' };
  const program = { id: 4, planId: 3, name: 'Programa', startDate: '2028-01-01', endDate: '2028-02-01' };
  const routine = { id: 5, programId: 4, name: 'Rutina', description: null };
  let hasPlan = false, hasProgram = false, hasRoutine = false;
  const service = new StudentPlanning(
    { findByStudent: async id => { assert.equal(id, 2); return hasPlan ? [{ ...plan, deletedAt: null, private: 'no devolver' }] : []; } },
    { findByPlan: async id => { assert.equal(id, 3); assert.ok(hasPlan); return hasProgram ? [{ ...program, private: 'no devolver' }] : []; } },
    { findByProgram: async id => { assert.equal(id, 4); assert.ok(hasProgram); return hasRoutine ? [{ ...routine, private: 'no devolver' }] : []; } },
    { list: async () => { assert.fail('El resumen no consulta ejercicios'); } },
  );
  assert.deepEqual(await service.get(2), { plan: null, program: null, routines: [] });
  hasPlan = true;
  assert.deepEqual(await service.get(2), { plan, program: null, routines: [] });
  hasProgram = true;
  assert.deepEqual(await service.get(2), { plan, program, routines: [] });
  hasRoutine = true;
  assert.deepEqual(await service.get(2), { plan, program, routines: [routine] });
});

test('comprueba pertenencia antes de consultar indicaciones y distingue null de cero', async () => {
  const { StudentPlanning } = await import('../dist/plans/application/student-planning.js');
  const { TrainingRoutineNotFoundError } = await import('../dist/plans/domain/training-routine.js');
  const routine = { id: 5, programId: 4, name: 'Rutina', description: 'Descripción' };
  const exercise = { id: 6, name: 'Press', bodyPart: 'chest', equipment: 'barbell', target: 'pectorals', instructions: 'Instrucciones' };
  const entry = { id: 7, routineId: 5, exerciseId: 6, setCount: 3, recommendedRepetitions: 8, recommendedWeightKg: null, restSeconds: 0, recommendedRir: null, exercise };
  let reads = 0, available = true, entries = [];
  const service = new StudentPlanning(
    { findByStudent: async () => available ? [{ id: 3, studentId: 2, name: 'Plan', objective: 'Objetivo' }] : [] },
    { findByPlan: async () => [{ id: 4, planId: 3, name: 'Programa', startDate: '2028-01-01', endDate: '2028-02-01' }] },
    { findByProgram: async () => [routine] },
    { list: async id => { assert.equal(id, 5); reads++; return entries; } },
  );
  await assert.rejects(service.getRoutine(2, 99), TrainingRoutineNotFoundError);
  assert.equal(reads, 0);
  assert.deepEqual(await service.getRoutine(2, 5), { routine, exercises: [] });
  entries = [{ ...entry, private: 'no devolver', exercise: { ...exercise, source: 'privado', sourceId: 'privado' } }];
  assert.deepEqual(await service.getRoutine(2, 5), { routine, exercises: [entry] });
  available = false;
  await assert.rejects(service.getRoutine(2, 5), TrainingRoutineNotFoundError);
  assert.equal(reads, 2);
});

test('presentación toma la identidad de la sesión, valida identificadores y oculta fallos internos', async () => {
  const { StudentPlanningController } = await import('../dist/plans/presentation/student-planning.controller.js');
  const { TrainingRoutineNotFoundError } = await import('../dist/plans/domain/training-routine.js');
  const calls = [];
  const controller = new StudentPlanningController({ get: async (...args) => calls.push(args), getRoutine: async (...args) => calls.push(args) });
  const request = { session: { usuarioId: 2 }, query: { studentId: 99, routineId: 99 } };
  await controller.get(request);
  await controller.getRoutine('5', request);
  assert.deepEqual(calls, [[2], [2, 5]]);
  for (const id of ['0', '-1', '1.5', 'x', '4294967296', '9007199254740993']) assert.throws(() => controller.getRoutine(id, request), error => error.getStatus() === 400);
  let failure = new TrainingRoutineNotFoundError();
  const broken = new StudentPlanningController({ get: async () => { throw failure; }, getRoutine: async () => { throw failure; } });
  await assert.rejects(broken.getRoutine('5', request), error => error.getStatus() === 404);
  failure = new Error('SQL y credenciales');
  for (const action of [() => broken.get(request), () => broken.getRoutine('5', request)]) {
    await assert.rejects(action(), error => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
  }
});

test('HTTP y MySQL permiten consultar solo la planificación propia sin conceder escrituras', { timeout: 30000 }, async t => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { TrainingPlanSchema } = await import('../dist/plans/infrastructure/typeorm-training-plan.repository.js');
  const { TrainingProgramSchema } = await import('../dist/plans/infrastructure/typeorm-training-program.repository.js');
  const { TrainingRoutineSchema } = await import('../dist/plans/infrastructure/typeorm-training-routine.repository.js');
  const { RoutineExerciseSchema } = await import('../dist/plans/infrastructure/typeorm-routine-exercise.repository.js');
  const { ExerciseSchema } = await import('../dist/plans/infrastructure/typeorm-exercise.repository.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const db = app.get(DataSource), accounts = [], plans = [], programs = [], routines = [];
  let exercise;
  t.after(async () => {
    try {
      for (const routine of routines) { await db.getRepository(RoutineExerciseSchema).delete({ routineId: routine.id }); await db.getRepository(TrainingRoutineSchema).delete({ id: routine.id }); }
      for (const program of programs) await db.getRepository(TrainingProgramSchema).delete({ id: program.id });
      for (const plan of plans) await db.getRepository(TrainingPlanSchema).delete({ id: plan.id });
      for (const account of accounts) {
        await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(account.id)]);
        await db.getRepository(EsquemaDeUsuario).delete({ id: account.id });
      }
      if (exercise) await db.getRepository(ExerciseSchema).delete({ id: exercise.id });
    } finally { await app.close(); }
  });
  const password = 'Clave123', passwordHash = await hashearContrasena(password);
  for (const role of ['alumno', 'alumno', 'entrenador', 'administrador']) accounts.push(await db.getRepository(EsquemaDeUsuario).save({ nombre: 'Prueba', apellido: 'Planificación', correo: `student-planning-${randomUUID()}@example.test`, rol: role, hashDeContrasena: passwordHash }));
  const [student, otherStudent] = accounts;
  const call = (path, cookie, method = 'GET', body) => fetch(`http://127.0.0.1:${app.getHttpServer().address().port}/${path === 'sesion' ? 'usuarios' : 'users'}/${path}`, {
    method, headers: { Origin: 'http://127.0.0.1:5173', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const cookies = [];
  for (const account of accounts) {
    const response = await call('sesion', null, 'POST', { correo: account.correo, contrasena: password, rol: account.rol });
    assert.equal(response.status, 200); await response.arrayBuffer();
    cookies.push(response.headers.getSetCookie().find(header => /Path=\/;/i.test(header)).split(';')[0]);
  }
  const [studentCookie, otherCookie, trainerCookie, adminCookie] = cookies;
  for (const path of ['me/planning', 'me/planning/routines/1']) {
    assert.equal((await call(path)).status, 401);
    for (const cookie of [trainerCookie, adminCookie]) assert.equal((await call(path, cookie)).status, 403);
  }
  let response = await call('me/planning', studentCookie);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { plan: null, program: null, routines: [] });
  assert.equal((await call('me/planning/routines/1', studentCookie)).status, 404);
  const { deletedAt, ...plan } = await db.getRepository(TrainingPlanSchema).save({ studentId: student.id, name: 'Plan prueba', objective: 'Objetivo' }); plans.push(plan);
  assert.deepEqual(await (await call('me/planning', studentCookie)).json(), { plan, program: null, routines: [] });
  const program = await db.getRepository(TrainingProgramSchema).save({ planId: plan.id, name: 'Programa futuro', startDate: '2028-01-01', endDate: '2028-02-01' }); programs.push(program);
  assert.deepEqual(await (await call('me/planning', studentCookie)).json(), { plan, program, routines: [] });
  routines.push(...await db.getRepository(TrainingRoutineSchema).save([{ programId: program.id, name: 'Rutina', description: 'Descripción' }, { programId: program.id, name: 'Rutina vacía', description: null }]));
  const [routine, emptyRoutine] = routines;
  assert.deepEqual(await (await call('me/planning', studentCookie)).json(), { plan, program, routines });
  assert.deepEqual(await (await call('me/planning/routines/' + emptyRoutine.id, studentCookie)).json(), { routine: emptyRoutine, exercises: [] });
  const marker = randomUUID();
  exercise = await db.getRepository(ExerciseSchema).save({ source: 'test', sourceId: marker, name: marker, bodyPart: 'chest', equipment: 'barbell', target: 'pectorals', instructions: 'Instrucciones de prueba' });
  const entries = await db.getRepository(RoutineExerciseSchema).save([
    { routineId: routine.id, exerciseId: exercise.id, setCount: 3, recommendedRepetitions: 8, recommendedWeightKg: null, restSeconds: null, recommendedRir: null },
    { routineId: routine.id, exerciseId: exercise.id, setCount: 2, recommendedRepetitions: 10, recommendedWeightKg: 0, restSeconds: 0, recommendedRir: 0 },
  ]);
  const { source, sourceId, ...publicExercise } = exercise;
  response = await call('me/planning/routines/' + routine.id, studentCookie);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { routine, exercises: entries.map(entry => ({ ...entry, exercise: publicExercise })) });
  assert.deepEqual(await (await call('me/planning?studentId=' + student.id, otherCookie)).json(), { plan: null, program: null, routines: [] });
  assert.equal((await call('me/planning/routines/' + routine.id + '?studentId=' + student.id, otherCookie)).status, 404);
  const otherPlan = await db.getRepository(TrainingPlanSchema).save({ studentId: otherStudent.id, name: 'Plan ajeno', objective: 'Objetivo' }); plans.push(otherPlan);
  const otherProgram = await db.getRepository(TrainingProgramSchema).save({ planId: otherPlan.id, name: 'Programa ajeno', startDate: '2026-01-01', endDate: '2026-02-01' }); programs.push(otherProgram);
  const otherRoutine = await db.getRepository(TrainingRoutineSchema).save({ programId: otherProgram.id, name: 'Rutina ajena', description: null }); routines.push(otherRoutine);
  assert.equal((await call('me/planning/routines/' + otherRoutine.id, studentCookie)).status, 404);
  for (const id of ['0', '-1', '1.5', 'texto', '4294967296']) assert.equal((await call('me/planning/routines/' + id, studentCookie)).status, 400);
  const trainerRoutes = [
    [`students/${student.id}/plans`, 'POST', { name: 'Otro', objective: 'Objetivo' }],
    [`students/${student.id}/plans/${plan.id}`, 'PUT', { name: 'Editar', objective: 'Objetivo' }],
    [`students/${student.id}/plans/${plan.id}`, 'DELETE'],
    [`students/${student.id}/plans/${plan.id}/programs`, 'POST', { name: 'Otro', startDate: '2026-01-01', endDate: '2026-02-01' }],
    [`students/${student.id}/plans/${plan.id}/programs/${program.id}/routines`, 'POST', { name: 'Otra' }],
    [`students/${student.id}/plans/${plan.id}/programs/${program.id}/routines/${routine.id}`, 'PUT', { name: 'Otra' }],
    [`students/${student.id}/plans/${plan.id}/programs/${program.id}/routines/${routine.id}/exercises`, 'POST', { exerciseId: exercise.id, setCount: 1, recommendedRepetitions: 1 }],
    [`students/${student.id}/plans/${plan.id}/programs/${program.id}/routines/${routine.id}/exercises/${entries[0].id}`, 'PUT', { setCount: 1, recommendedRepetitions: 1 }],
  ];
  for (const [path, method, body] of trainerRoutes) assert.equal((await call(path, studentCookie, method, body)).status, 403);
  await db.getRepository(TrainingPlanSchema).softDelete({ id: plan.id });
  assert.deepEqual(await (await call('me/planning', studentCookie)).json(), { plan: null, program: null, routines: [] });
  assert.equal((await call('me/planning/routines/' + routine.id, studentCookie)).status, 404);
  assert.equal(await db.getRepository(RoutineExerciseSchema).countBy({ routineId: routine.id }), 2);
});
