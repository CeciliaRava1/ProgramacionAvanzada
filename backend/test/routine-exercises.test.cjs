const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const valid = { setCount: 3, recommendedRepetitions: 8, recommendedWeightKg: 12.5, restSeconds: 90 };

test('valida una sola indicación por ejercicio, decimales y límites de almacenamiento', async () => {
  const { validateRoutineExercise, InvalidRoutineExerciseError } = await import('../dist/plans/domain/routine-exercise.js');
  assert.deepEqual(validateRoutineExercise(valid), valid);
  for (const weight of [0, 0.29, 12.34, 999999.99]) assert.equal(validateRoutineExercise({ ...valid, recommendedWeightKg: weight }).recommendedWeightKg, weight);
  for (const recommendedRir of [null, 0, 2, 65535]) assert.deepEqual(validateRoutineExercise({ ...valid, recommendedRir }), { ...valid, recommendedRir });
  for (const value of [null, 0, 15]) {
    const details = { ...valid, recommendedWeightKg: value, restSeconds: value };
    assert.deepEqual(validateRoutineExercise(details), details);
  }
  assert.throws(() => validateRoutineExercise({ ...valid, setCount: 0 }), error => error.fieldErrors.setCount === 'Ingresá una cantidad entera mayor que cero.');
  for (const [field, values] of [['setCount', [0, -1, 1.5, 65536, '3', NaN]], ['recommendedRepetitions', [0, 0.5]], ['recommendedWeightKg', [-1, 12.345, 0.000000001, Infinity, 1000000]], ['restSeconds', [-1, 1.5, 65536]], ['recommendedRir', [-1, 0.5, 65536, '2', NaN, Infinity]]]) {
    for (const value of values) assert.throws(() => validateRoutineExercise({ ...valid, [field]: value }), error => error instanceof InvalidRoutineExerciseError && Boolean(error.fieldErrors[field]));
  }
});

test('autoriza la rutina antes de leer, validar o escribir y no cambia el catálogo al editar', async () => {
  const { RoutineExercises } = await import('../dist/plans/application/routine-exercises.js');
  const { PlanAccessError } = await import('../dist/plans/application/training-plans.js');
  const { TrainingRoutineNotFoundError } = await import('../dist/plans/domain/training-routine.js');
  const { ExerciseNotFoundError } = await import('../dist/plans/domain/exercise.js');
  let allowed = true, exists = true, catalogExists = true, writes = 0;
  const entries = { list: async () => [], save: async (...args) => { writes++; return args; }, update: async (...args) => { writes++; return args; } };
  const service = new RoutineExercises(entries, { findById: async () => catalogExists ? { id: 6 } : null }, { list: async () => { if (!allowed) throw new PlanAccessError(); return exists ? [{ id: 5 }] : []; } });
  assert.deepEqual(await service.list(1, 2, 3, 4, 5), []);
  assert.deepEqual(await service.create(1, 2, 3, 4, 5, 6, valid), [5, 6, valid]);
  assert.deepEqual(await service.update(1, 2, 3, 4, 5, 7, valid), [5, 7, valid]);
  allowed = false; await assert.rejects(service.create(1, 2, 3, 4, 5, 6, {}), PlanAccessError);
  allowed = true; exists = false; await assert.rejects(service.list(1, 2, 3, 4, 5), TrainingRoutineNotFoundError);
  exists = true; catalogExists = false; await assert.rejects(service.create(1, 2, 3, 4, 5, 6, valid), ExerciseNotFoundError);
  assert.equal(writes, 2);
});

test('HTTP y MySQL conservan catálogo, permisos, pertenencia e indicaciones al retirar el plan', { timeout: 30000 }, async t => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { EsquemaDeVinculacion } = await import('../dist/usuarios/infraestructura/repositorio-de-solicitudes-typeorm.js');
  const { TrainingPlanSchema } = await import('../dist/plans/infrastructure/typeorm-training-plan.repository.js');
  const { TrainingProgramSchema } = await import('../dist/plans/infrastructure/typeorm-training-program.repository.js');
  const { TrainingRoutineSchema } = await import('../dist/plans/infrastructure/typeorm-training-routine.repository.js');
  const { ExerciseSchema } = await import('../dist/plans/infrastructure/typeorm-exercise.repository.js');
  const { RoutineExerciseSchema, TypeOrmRoutineExerciseRepository } = await import('../dist/plans/infrastructure/typeorm-routine-exercise.repository.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1'); const db = app.get(DataSource), accounts = [], plans = [], programs = [], routines = [];
  let exercise;
  t.after(async () => {
    try {
      for (const routine of routines) { await db.getRepository(RoutineExerciseSchema).delete({ routineId: routine.id }); await db.getRepository(TrainingRoutineSchema).delete({ id: routine.id }); }
      for (const program of programs) await db.getRepository(TrainingProgramSchema).delete({ id: program.id });
      for (const plan of plans) await db.getRepository(TrainingPlanSchema).delete({ id: plan.id });
      for (const account of accounts) { await db.getRepository(EsquemaDeVinculacion).delete({ alumnoId: account.id }); await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(account.id)]); }
      for (const account of accounts) await db.getRepository(EsquemaDeUsuario).delete({ id: account.id });
      if (exercise) await db.getRepository(ExerciseSchema).delete({ id: exercise.id });
    } finally { await app.close(); }
  });
  const password = 'Clave123', passwordHash = await hashearContrasena(password), marker = randomUUID();
  for (const role of ['entrenador', 'entrenador', 'alumno', 'administrador']) accounts.push(await db.getRepository(EsquemaDeUsuario).save({ nombre: 'Prueba', apellido: 'Ejercicios', correo: `routine-exercise-${randomUUID()}@example.test`, rol: role, hashDeContrasena: passwordHash }));
  const [trainer, otherTrainer, student] = accounts;
  await db.getRepository(EsquemaDeVinculacion).insert({ alumnoId: student.id, entrenadorId: trainer.id });
  plans.push(await db.getRepository(TrainingPlanSchema).save({ studentId: student.id, name: 'Plan prueba', objective: 'Prueba' }));
  programs.push(await db.getRepository(TrainingProgramSchema).save({ planId: plans[0].id, name: 'Programa', startDate: '2026-05-11', endDate: '2026-06-05' }));
  routines.push(...await db.getRepository(TrainingRoutineSchema).save([{ programId: programs[0].id, name: 'Rutina A', description: null }, { programId: programs[0].id, name: 'Rutina B', description: null }]));
  exercise = await db.getRepository(ExerciseSchema).save({ source: 'test', sourceId: marker, name: marker, bodyPart: 'test', equipment: 'test', target: 'test', instructions: 'Instrucción de prueba.' });
  const call = (path, method = 'GET', cookie, body, origin = 'http://127.0.0.1:5173') => fetch(`http://127.0.0.1:${app.getHttpServer().address().port}/${path === 'sesion' ? 'usuarios' : 'users'}/${path}`, { method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const cookies = [];
  for (const account of accounts) {
    const response = await call('sesion', 'POST', null, { correo: account.correo, contrasena: password, rol: account.rol }); assert.equal(response.status, 200); await response.arrayBuffer(); cookies.push(response.headers.getSetCookie().find(header => /Path=\/;/i.test(header)).split(';')[0]);
  }
  const [trainerCookie, otherCookie, studentCookie, adminCookie] = cookies;
  assert.equal((await call('exercises')).status, 401);
  for (const cookie of [studentCookie, adminCookie]) assert.equal((await call('exercises', 'GET', cookie)).status, 403);
  let response = await call('exercises?q=' + marker, 'GET', trainerCookie), page = await response.json();
  assert.equal(response.status, 200); assert.equal(page.total, 1); assert.equal(page.items[0].id, exercise.id); assert.equal('source' in page.items[0], false);
  assert.equal((await call('exercises?q=x&q=y', 'GET', trainerCookie)).status, 400);
  const route = `students/${student.id}/plans/${plans[0].id}/programs/${programs[0].id}/routines/${routines[0].id}/exercises`;
  const body = { exerciseId: exercise.id, ...valid };
  for (const method of ['GET', 'POST']) {
    assert.equal((await call(route, method, null, method === 'POST' ? body : undefined)).status, 401);
    for (const cookie of [otherCookie, studentCookie, adminCookie]) assert.equal((await call(route, method, cookie, method === 'POST' ? body : undefined)).status, 403);
  }
  for (const invalid of [{ ...body, setCount: 0 }, { ...body, recommendedRepetitions: '8' }, { ...body, recommendedWeightKg: 1.234 }, { ...body, restSeconds: -1 }, { ...body, recommendedRir: '2' }, { ...body, recommendedRir: -1 }, { ...body, recommendedRir: 0.5 }, { ...body, trainerId: trainer.id }, { ...body, exerciseId: 0 }]) assert.equal((await call(route, 'POST', trainerCookie, invalid)).status, 400);
  assert.equal((await call(route, 'POST', trainerCookie, body, 'http://otro.example')).status, 403);
  assert.equal((await call(route, 'POST', trainerCookie, { ...body, exerciseId: 4294967295 })).status, 404);
  assert.equal((await call(route.replace(`/routines/${routines[0].id}/`, '/routines/4294967295/'), 'POST', trainerCookie, body)).status, 404);
  response = await call(route, 'POST', trainerCookie, body); assert.equal(response.status, 201); const saved = await response.json();
  assert.deepEqual(Object.keys(saved).sort(), ['id', 'routineId', 'exerciseId', 'exercise', 'recommendedRir', ...Object.keys(valid)].sort());
  assert.equal(saved.recommendedRir, null);
  assert.equal(saved.recommendedWeightKg, 12.5); assert.equal('source' in saved.exercise, false);
  response = await call(route, 'GET', trainerCookie); assert.deepEqual(await response.json(), [saved]);
  const edited = { ...valid, setCount: 4, recommendedWeightKg: 0.29 };
  response = await call(route + '/' + saved.id, 'PUT', trainerCookie, edited); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...saved, ...edited });
  for (const recommendedRir of [0, 3]) {
    response = await call(route + '/' + saved.id, 'PUT', trainerCookie, { ...edited, recommendedRir });
    assert.equal(response.status, 200); assert.equal((await response.json()).recommendedRir, recommendedRir);
    response = await call(route, 'GET', trainerCookie); assert.equal((await response.json())[0].recommendedRir, recommendedRir);
  }
  response = await call(route + '/' + saved.id, 'PUT', trainerCookie, edited);
  assert.equal((await response.json()).recommendedRir, 3);
  response = await call(route + '/' + saved.id, 'PUT', trainerCookie, { ...edited, recommendedRir: null });
  assert.equal(response.status, 200); assert.equal((await response.json()).recommendedRir, null);
  response = await call(route, 'GET', trainerCookie); assert.equal((await response.json())[0].recommendedRir, null);
  assert.equal((await call(route + '/' + saved.id, 'PUT', trainerCookie, { ...edited, exerciseId: exercise.id })).status, 400);
  assert.equal((await call(route.replace(`/routines/${routines[0].id}/`, `/routines/${routines[1].id}/`) + '/' + saved.id, 'PUT', trainerCookie, edited)).status, 404);
  assert.deepEqual(await db.getRepository(ExerciseSchema).findOneByOrFail({ id: exercise.id }), exercise);
  assert.equal(await db.getRepository(RoutineExerciseSchema).countBy({ routineId: routines[0].id }), 1);
  for (const value of [null, 0, 15]) {
    const details = { ...edited, recommendedWeightKg: value, restSeconds: value, recommendedRir: value };
    response = await call(route + '/' + saved.id, 'PUT', trainerCookie, details);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ...saved, ...details });
    response = await call(route, 'GET', trainerCookie);
    assert.deepEqual(await response.json(), [{ ...saved, ...details }]);
  }
  response = await call(route, 'POST', trainerCookie, { exerciseId: exercise.id, setCount: 3, recommendedRepetitions: 12 });
  assert.equal(response.status, 201);
  const withoutDetails = await response.json();
  assert.equal(withoutDetails.recommendedWeightKg, null); assert.equal(withoutDetails.restSeconds, null); assert.equal(withoutDetails.recommendedRir, null);
  const repository = new TypeOrmRoutineExerciseRepository(db);
  await Promise.all([
    repository.update(routines[0].id, saved.id, edited),
    db.transaction(async manager => {
      await manager.getRepository(TrainingProgramSchema).createQueryBuilder('program').innerJoin(TrainingPlanSchema.options.name, 'plan', 'plan.id = program.planId').where('program.id = :id', { id: programs[0].id }).setLock('pessimistic_write').getOneOrFail();
      await manager.getRepository(TrainingRoutineSchema).update({ id: routines[0].id }, { description: 'Actualización simultánea' });
    }),
  ]);
  const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction();
  try {
    await runner.manager.getRepository(TrainingPlanSchema).softDelete({ id: plans[0].id });
    const pending = assert.rejects(repository.save(routines[0].id, exercise.id, valid));
    await runner.commitTransaction(); await pending;
  } finally { if (runner.isTransactionActive) await runner.rollbackTransaction(); await runner.release(); }
  for (const method of ['GET', 'POST', 'PUT']) assert.equal((await call(route + (method === 'PUT' ? '/' + saved.id : ''), method, trainerCookie, method === 'GET' ? undefined : method === 'POST' ? body : edited)).status, 404);
  assert.equal(await db.getRepository(RoutineExerciseSchema).countBy({ id: saved.id }), 1);
  assert.deepEqual(await repository.list(routines[0].id), []);
  await assert.rejects(repository.save(routines[0].id, exercise.id, valid));
  await assert.rejects(repository.update(routines[0].id, saved.id, valid));
});
