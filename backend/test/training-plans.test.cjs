const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('el plan normaliza nombre y objetivo y valida sus límites sin categorías cerradas', async () => {
  const { createTrainingPlan, InvalidTrainingPlanError } = await import('../dist/plans/domain/training-plan.js');
  assert.deepEqual(createTrainingPlan(1, ' PLAN DE FUERZA ', ' Salud\ny bienestar '), { studentId: 1, name: 'PLAN DE FUERZA', objective: 'Salud\ny bienestar' });
  for (const [name, objective, field] of [[' ', 'Salud', 'name'], ['x'.repeat(201), 'Salud', 'name'], ['Plan', '', 'objective'], ['Plan', 'x'.repeat(5001), 'objective']]) {
    assert.throws(() => createTrainingPlan(1, name, objective), (error) => error instanceof InvalidTrainingPlanError && Boolean(error.fieldErrors[field]));
  }
  assert.equal([...createTrainingPlan(1, '\u{10400}'.repeat(200), 'x'.repeat(5000)).name].length, 200);
});

test('los casos de uso autorizan antes de consultar o guardar y devuelven solo datos del plan', async () => {
  const { TrainingPlans, PlanAccessError } = await import('../dist/plans/application/training-plans.js');
  let assignment = { alumnoId: 2, entrenadorId: 1 }, reads = 0, writes = 0;
  const saved = { id: 3, studentId: 2, name: 'Plan', objective: 'Salud' };
  const service = new TrainingPlans({
    save: async (input) => { writes++; assert.deepEqual(input, { studentId: 2, name: 'Plan', objective: 'Salud' }); return { ...saved, private: 'no devolver' }; },
    findByStudent: async (id) => { reads++; assert.equal(id, 2); return writes ? [{ ...saved, private: 'no devolver' }] : []; },
  }, { buscarVinculacion: async (id) => { assert.equal(id, 2); return assignment; } });
  assert.deepEqual(await service.create(1, 2, { name: ' Plan ', objective: ' Salud ' }), saved);
  assert.deepEqual(await service.list(1, 2), [saved]);
  const { TrainingPlanAlreadyExistsError } = await import('../dist/plans/domain/training-plan.js');
  await assert.rejects(service.create(1, 2, { name: 'Otro', objective: 'Otro' }), TrainingPlanAlreadyExistsError);
  for (assignment of [null, { alumnoId: 2, entrenadorId: 9 }]) {
    await assert.rejects(service.list(1, 2), PlanAccessError);
    await assert.rejects(service.create(1, 2, { name: 'Plan', objective: 'Salud' }), PlanAccessError);
  }
  assert.equal(reads, 3); assert.equal(writes, 1);
});

test('el controlador valida formato, ignora identidades externas y no expone errores internos', async () => {
  const { PlansController } = await import('../dist/plans/presentation/plans.controller.js');
  const { InvalidTrainingPlanError, TrainingPlanAlreadyExistsError, TrainingPlanNotFoundError } = await import('../dist/plans/domain/training-plan.js');
  const { PlanAccessError } = await import('../dist/plans/application/training-plans.js');
  const calls = [];
  const controller = new PlansController({ create: async (...args) => { calls.push(args); }, update: async (...args) => { calls.push(args); }, remove: async (...args) => { calls.push(args); }, list: async () => { throw new Error('SQL y credenciales'); } });
  const req = { session: { usuarioId: 4 }, query: { trainerId: 9 } };
  for (const id of ['x', '-1', '0', '1.2', '4294967296']) assert.throws(() => controller.list(id, req), (error) => error.getStatus() === 400);
  for (const body of [null, [], {}, { name: 2, objective: 'Salud' }, { name: 'Plan', objective: null }, { name: 'Plan', objective: 'Salud', trainerId: 9 }]) {
    assert.throws(() => controller.create('2', body, req), (error) => error.getStatus() === 400);
  }
  await controller.create('2', { name: 'Plan', objective: 'Salud' }, req);
  await controller.update('2', '3', { name: 'Plan', objective: 'Salud' }, req);
  await controller.remove('2', '3', req);
  assert.deepEqual(calls, [[4, 2, { name: 'Plan', objective: 'Salud' }], [4, 2, 3, { name: 'Plan', objective: 'Salud' }], [4, 2, 3]]);
  assert.throws(() => controller.update('2', 'x', { name: 'Plan', objective: 'Salud' }, req), (error) => error.getStatus() === 400);
  assert.throws(() => controller.remove('0', '3', req), (error) => error.getStatus() === 400);
  assert.throws(() => controller.update('2', '3', { name: 'Plan', objective: 'Salud', deletedAt: null }, req), (error) => error.getStatus() === 400);
  await assert.rejects(controller.list('2', req), (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
  for (const [failure, code] of [[new PlanAccessError('Sin permiso'), 403], [new InvalidTrainingPlanError({ name: 'Inválido' }), 400], [new TrainingPlanAlreadyExistsError(), 409], [new TrainingPlanNotFoundError(), 404]]) {
    await assert.rejects(new PlansController({ list: async () => { throw failure; } }).list('2', req), (error) => error.getStatus() === code);
  }
});

test('editar y eliminar autorizan primero, conservan el identificador y distinguen planes no disponibles', async () => {
  const { TrainingPlans, PlanAccessError } = await import('../dist/plans/application/training-plans.js');
  const { TrainingPlanNotFoundError, InvalidTrainingPlanError } = await import('../dist/plans/domain/training-plan.js');
  let trainerId = 1, available = true;
  const calls = [];
  const service = new TrainingPlans({
    update: async (...args) => { calls.push(['update', ...args]); return available ? { id: 3, studentId: 2, ...args[2], deletedAt: null } : null; },
    remove: async (...args) => { calls.push(['remove', ...args]); return available; },
  }, { buscarVinculacion: async () => ({ alumnoId: 2, entrenadorId: trainerId }) });
  assert.deepEqual(await service.update(1, 2, 3, { name: ' Plan editado ', objective: ' Salud ' }), { id: 3, studentId: 2, name: 'Plan editado', objective: 'Salud' });
  await service.remove(1, 2, 3);
  assert.deepEqual(calls, [['update', 3, 2, { name: 'Plan editado', objective: 'Salud' }], ['remove', 3, 2]]);
  trainerId = 9;
  await assert.rejects(service.update(1, 2, 3, { name: 'Plan', objective: 'Salud' }), PlanAccessError);
  await assert.rejects(service.remove(1, 2, 3), PlanAccessError);
  assert.equal(calls.length, 2);
  trainerId = 1;
  await assert.rejects(service.update(1, 2, 3, { name: ' ', objective: 'Salud' }), InvalidTrainingPlanError);
  assert.equal(calls.length, 2);
  available = false;
  await assert.rejects(service.update(1, 2, 3, { name: 'Plan', objective: 'Salud' }), TrainingPlanNotFoundError);
  await assert.rejects(service.remove(1, 2, 3), TrainingPlanNotFoundError);
});

test('HTTP y MySQL editan, eliminan lógicamente y permiten reemplazar sin reactivar el plan anterior', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { EsquemaDeVinculacion } = await import('../dist/usuarios/infraestructura/repositorio-de-solicitudes-typeorm.js');
  const { TrainingPlanSchema } = await import('../dist/plans/infrastructure/typeorm-training-plan.repository.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const start = async () => { const instance = await NestFactory.create(AppModule, { logger: false, abortOnError: false }); await instance.listen(0, '127.0.0.1'); return instance; };
  let app = await start(), db = app.get(DataSource);
  let users = db.getRepository(EsquemaDeUsuario), plans = db.getRepository(TrainingPlanSchema), assignments = db.getRepository(EsquemaDeVinculacion);
  const accounts = [];
  t.after(async () => {
    try {
      for (const account of accounts.filter((user) => user.rol === 'alumno')) {
        await plans.delete({ studentId: account.id }); await assignments.delete({ alumnoId: account.id });
      }
      for (const account of accounts) {
        await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(account.id)]);
        await users.delete({ id: account.id });
      }
    } finally { await app.close(); }
  });
  const password = 'Clave123', passwordHash = await hashearContrasena(password);
  for (const role of ['entrenador', 'entrenador', 'alumno', 'alumno', 'administrador']) accounts.push(await users.save({ nombre: 'Prueba', apellido: 'EditarPlan', correo: `training-plan-test-${randomUUID()}@example.test`, rol: role, hashDeContrasena: passwordHash }));
  const [trainer, otherTrainer, student, otherStudent, admin] = accounts;
  await assignments.insert([{ alumnoId: student.id, entrenadorId: trainer.id }, { alumnoId: otherStudent.id, entrenadorId: trainer.id }]);
  const call = (path, method = 'GET', cookie, body, origin = 'http://127.0.0.1:5173') => fetch(`http://127.0.0.1:${app.getHttpServer().address().port}/${path === 'sesion' ? 'usuarios' : 'users'}/${path}`, {
    method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const cookies = [];
  for (const account of [trainer, otherTrainer, student, admin]) {
    const response = await call('sesion', 'POST', null, { correo: account.correo, contrasena: password });
    assert.equal(response.status, 200); await response.arrayBuffer();
    cookies.push(response.headers.getSetCookie().find((header) => /Path=\/;/i.test(header)).split(';')[0]);
  }
  const [trainerCookie, otherTrainerCookie, studentCookie, adminCookie] = cookies;
  const route = `students/${student.id}/plans`, input = { name: 'Plan original', objective: 'Objetivo original' };
  const saved = await (await call(route, 'POST', trainerCookie, input)).json(), target = `${route}/${saved.id}`;
  for (const method of ['PUT', 'DELETE']) {
    const body = method === 'PUT' ? input : undefined;
    assert.equal((await call(target, method, null, body)).status, 401);
    for (const cookie of [otherTrainerCookie, studentCookie, adminCookie]) assert.equal((await call(target, method, cookie, body)).status, 403);
    assert.equal((await call(target, method, trainerCookie, body, 'http://otro.example')).status, 403);
    assert.equal((await call(`students/${otherStudent.id}/plans/${saved.id}`, method, trainerCookie, body)).status, 404);
  }
  assert.equal((await call(target, 'PUT', trainerCookie, { ...input, studentId: otherStudent.id })).status, 400);
  assert.equal((await call(target, 'PUT', trainerCookie, { name: ' ', objective: 'Salud' })).status, 400);
  const updated = { ...saved, name: 'Plan editado', objective: 'Objetivo editado' };
  let response = await call(target, 'PUT', trainerCookie, { name: ' Plan editado ', objective: ' Objetivo editado ' });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), updated);
  assert.equal((await call(target, 'PUT', trainerCookie, updated)).status, 400);
  assert.equal((await call(target, 'PUT', trainerCookie, { name: updated.name, objective: updated.objective })).status, 200);
  assert.deepEqual(await (await call(route, 'GET', trainerCookie)).json(), [updated]);
  assert.equal((await call(target, 'DELETE', trainerCookie)).status, 204);
  assert.deepEqual(await (await call(route, 'GET', trainerCookie)).json(), []);
  assert.equal(await plans.findOneBy({ id: saved.id }), null);
  const archived = await plans.createQueryBuilder('plan').withDeleted().addSelect('plan.deletedAt').where('plan.id = :id', { id: saved.id }).getOneOrFail();
  assert.equal(archived.name, updated.name); assert.equal(archived.objective, updated.objective); assert.ok(archived.deletedAt instanceof Date);
  const replacements = await Promise.all([call(route, 'POST', trainerCookie, input), call(route, 'POST', trainerCookie, input)]);
  assert.deepEqual(replacements.map((r) => r.status).sort(), [201, 409]);
  const replacement = await replacements.find((r) => r.status === 201).json();
  assert.notEqual(replacement.id, saved.id);
  assert.equal((await call(target, 'PUT', trainerCookie, { name: 'No reactivar', objective: 'No reactivar' })).status, 404);
  assert.equal((await call(target, 'DELETE', trainerCookie)).status, 404);
  assert.deepEqual(await (await call(route, 'GET', trainerCookie)).json(), [replacement]);
  assert.equal(await plans.createQueryBuilder('plan').withDeleted().where('plan.studentId = :id', { id: student.id }).getCount(), 2);
  await app.close(); app = await start(); db = app.get(DataSource);
  users = db.getRepository(EsquemaDeUsuario); plans = db.getRepository(TrainingPlanSchema); assignments = db.getRepository(EsquemaDeVinculacion);
  assert.deepEqual(await (await call(route, 'GET', trainerCookie)).json(), [replacement]);
  assert.ok((await plans.createQueryBuilder('plan').withDeleted().addSelect('plan.deletedAt').where('plan.id = :id', { id: saved.id }).getOneOrFail()).deletedAt instanceof Date);
});

test('HTTP y MySQL crean planes vacíos, conservan datos y restringen acceso al entrenador asignado', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const { EsquemaDeUsuario } = await import('../dist/usuarios/infraestructura/repositorio-de-usuarios-typeorm.js');
  const { EsquemaDeVinculacion } = await import('../dist/usuarios/infraestructura/repositorio-de-solicitudes-typeorm.js');
  const { TrainingPlanSchema } = await import('../dist/plans/infrastructure/typeorm-training-plan.repository.js');
  const { hashearContrasena } = await import('../dist/usuarios/infraestructura/hash-de-contrasena.js');
  const start = async () => { const instance = await NestFactory.create(AppModule, { logger: false, abortOnError: false }); await instance.listen(0, '127.0.0.1'); return instance; };
  let app = await start(), db = app.get(DataSource);
  let users = db.getRepository(EsquemaDeUsuario), plans = db.getRepository(TrainingPlanSchema), assignments = db.getRepository(EsquemaDeVinculacion);
  const accounts = [];
  t.after(async () => {
    try {
      for (const account of accounts.filter((user) => user.rol === 'alumno')) {
        await plans.delete({ studentId: account.id });
        await assignments.delete({ alumnoId: account.id });
      }
      for (const account of accounts) {
        await db.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(account.id)]);
        await users.delete({ id: account.id });
      }
    } finally { await app.close(); }
  });
  const password = 'Clave123', passwordHash = await hashearContrasena(password);
  for (const role of ['entrenador', 'entrenador', 'alumno', 'alumno', 'administrador']) accounts.push(await users.save({ nombre: 'Prueba', apellido: 'Planes', correo: `training-plan-test-${randomUUID()}@example.test`, rol: role, hashDeContrasena: passwordHash }));
  const [trainer, otherTrainer, student, otherStudent, admin] = accounts;
  await assignments.insert([{ alumnoId: student.id, entrenadorId: trainer.id }, { alumnoId: otherStudent.id, entrenadorId: otherTrainer.id }]);
  const call = (path, method = 'GET', cookie, body, origin = 'http://127.0.0.1:5173') => fetch(`http://127.0.0.1:${app.getHttpServer().address().port}/${path === 'sesion' ? 'usuarios' : 'users'}/${path}`, {
    method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const cookies = [];
  for (const account of [trainer, otherTrainer, student, admin]) {
    const response = await call('sesion', 'POST', null, { correo: account.correo, contrasena: password });
    assert.equal(response.status, 200); await response.arrayBuffer();
    cookies.push(response.headers.getSetCookie().find((header) => /Path=\/;/i.test(header)).split(';')[0]);
  }
  const [trainerCookie, otherTrainerCookie, studentCookie, adminCookie] = cookies;
  const route = `students/${student.id}/plans`, input = { name: ' PLAN DE FUERZA ', objective: ' Salud y bienestar ' };
  for (const method of ['GET', 'POST']) {
    const body = method === 'POST' ? input : undefined;
    assert.equal((await call(route, method, null, body)).status, 401);
    for (const cookie of [otherTrainerCookie, studentCookie, adminCookie]) assert.equal((await call(route, method, cookie, body)).status, 403);
  }
  assert.equal((await call(route, 'POST', trainerCookie, input, 'http://otro.example')).status, 403);
  assert.equal((await call('students/4294967295/plans', 'GET', trainerCookie)).status, 403);
  for (const body of [{ ...input, studentId: otherStudent.id }, { ...input, programs: [] }, { name: ' ', objective: 'Salud' }, { name: 'x'.repeat(201), objective: 'Salud' }, { name: 'Plan', objective: 'x'.repeat(5001) }]) {
    assert.equal((await call(route, 'POST', trainerCookie, body)).status, 400);
  }
  assert.equal(await plans.countBy({ studentId: student.id }), 0);
  let response = await call(route, 'GET', trainerCookie);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(await response.json(), []);
  response = await call(route, 'POST', trainerCookie, input);
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.deepEqual(saved, { id: saved.id, studentId: student.id, name: 'PLAN DE FUERZA', objective: 'Salud y bienestar' });
  assert.deepEqual(await plans.findOneByOrFail({ id: saved.id }), saved);
  assert.equal((await call(route, 'POST', trainerCookie, { name: 'No reemplazar', objective: 'Otro objetivo' })).status, 409);
  assert.deepEqual(await plans.findOneByOrFail({ id: saved.id }), saved);
  const otherRoute = `students/${otherStudent.id}/plans`;
  const concurrent = await Promise.all([call(otherRoute, 'POST', otherTrainerCookie, input), call(otherRoute, 'POST', otherTrainerCookie, input)]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
  assert.equal(await plans.countBy({ studentId: otherStudent.id }), 1);
  await assert.rejects(plans.insert({ studentId: otherStudent.id, name: 'Duplicado', objective: 'No guardar' }),
    (error) => error.driverError?.code === 'ER_DUP_ENTRY');
  assert.equal((await call(route + `?trainerId=${trainer.id}`, 'GET', otherTrainerCookie)).status, 403);
  assert.equal((await (await call(otherRoute, 'GET', otherTrainerCookie)).json()).length, 1);
  await app.close(); app = await start(); db = app.get(DataSource);
  users = db.getRepository(EsquemaDeUsuario); plans = db.getRepository(TrainingPlanSchema); assignments = db.getRepository(EsquemaDeVinculacion);
  response = await call(route, 'GET', trainerCookie);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), [saved]);
  await assignments.delete({ alumnoId: student.id });
  assert.equal((await call(route, 'GET', trainerCookie)).status, 403);
  assert.equal((await call(route, 'POST', trainerCookie, input)).status, 403);
  assert.equal(await plans.countBy({ studentId: student.id }), 1);
});

test('la migración de unicidad se detiene ante duplicados sin borrar ni alterar datos', async () => {
  const { UniqueTrainingPlanStudent1792800000003 } = await import('../dist/infraestructura/base-de-datos/migraciones/1792800000003-unique-training-plan-student.js');
  const calls = [];
  await assert.rejects(new UniqueTrainingPlanStudent1792800000003().up({ query: async (sql) => { calls.push(sql); return [{ student_id: 1 }]; } }), /varios planes/);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith('SELECT'));
});
