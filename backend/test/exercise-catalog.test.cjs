const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

test('el catálogo importable contiene solo textos y referencias estables, sin medios', async () => {
  const { parseExerciseCatalog } = await import('../dist/infrastructure/database/import-exercises.js');
  const rows = JSON.parse(await readFile(new URL('../data/exercises.json', 'file:///' + __filename.replaceAll('\\', '/')), 'utf8'));
  assert.equal(parseExerciseCatalog(rows).length, 1324);
  const row = rows[0];
  assert.throws(() => parseExerciseCatalog([]));
  for (const invalid of [null, {}, [null], [{ ...row, name: '' }], [{ ...row, instructions: 'x'.repeat(65536) }], [{ ...row, image: 'image.jpg' }], [row, row]]) assert.throws(() => parseExerciseCatalog(invalid));
  const license = await readFile(new URL('../data/exercises.LICENSE', 'file:///' + __filename.replaceAll('\\', '/')), 'utf8');
  assert.match(license, /MIT License/); assert.match(license, /7455efae41b330c265e7cd4b78dfa848e7ce5ebd/);
});

test('el catálogo valida filtros y paginación y no devuelve errores internos', async () => {
  const { ExercisesController } = await import('../dist/plans/presentation/exercises.controller.js');
  const calls = [], page = { items: [], total: 0, bodyParts: [], equipment: [] };
  const controller = new ExercisesController({ search: async query => { calls.push(query); return page; } });
  assert.deepEqual(await controller.search({ q: ' press ', offset: '20' }), page);
  assert.deepEqual(calls, [{ q: 'press', bodyPart: '', equipment: '', offset: 20 }]);
  for (const query of [{ q: ['press'] }, { q: 'x'.repeat(101) }, { bodyPart: {} }, { equipment: 1 }, { offset: '-1' }, { offset: '0.5' }, { offset: '4294967296' }, { offset: ['0'] }, { source: 'private' }]) await assert.rejects(controller.search(query), error => error.getStatus() === 400);
  await assert.rejects(new ExercisesController({ search: async () => { throw new Error('SQL privado'); } }).search({}), error => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
});

test('MySQL encuentra palabras en cualquier orden y entre nombre, músculo y equipo', { timeout: 30000 }, async t => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { DatabaseModule } = await import('../dist/infrastructure/database/database.module.js');
  const { ExerciseSchema, TypeOrmExerciseRepository } = await import('../dist/plans/infrastructure/typeorm-exercise.repository.js');
  const app = await NestFactory.createApplicationContext(DatabaseModule, { logger: false, abortOnError: false });
  const db = app.get(DataSource), marker = randomUUID(), rows = [];
  t.after(async () => { try { for (const row of rows) await db.getRepository(ExerciseSchema).delete({ id: row.id }); } finally { await app.close(); } });
  for (const [name, equipment, target] of [['Press', 'barbell', 'pectorals'], ['Row', 'dumbbell', 'lats']]) rows.push(await db.getRepository(ExerciseSchema).save({ source: 'test', sourceId: randomUUID(), name: name + ' ' + marker, bodyPart: 'chest', equipment, target, instructions: 'Instrucciones de prueba.' }));
  const repository = new TypeOrmExerciseRepository(db), filters = { bodyPart: '', equipment: '', offset: 0 };
  for (const q of [`${marker} press barbell`, `BARBELL   ${marker}  press`, `pectorals ${marker} chest`]) {
    const result = await repository.search({ ...filters, q });
    assert.equal(result.total, 1); assert.equal(result.items[0].id, rows[0].id);
  }
  for (const q of [`${marker} missingword`, `${marker} %`, `${marker} ' OR 1=1`]) assert.equal((await repository.search({ ...filters, q })).total, 0);
  assert.equal((await repository.search({ ...filters, q: marker, equipment: 'dumbbell' })).items[0].id, rows[1].id);
  assert.equal((await repository.search({ ...filters, q: marker, offset: 1 })).items[0].id, rows[1].id);
});
