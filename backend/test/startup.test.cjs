const assert = require('node:assert/strict');
const { test } = require('node:test');

test('rechaza una configuración de base incompleta o un puerto inválido', async () => {
  const { validateDatabaseEnvironment } = await import(
    '../dist/infrastructure/database/database.module.js'
  );
  const environment = {
    DB_HOST: '127.0.0.1',
    DB_PORT: '3306',
    MYSQL_DATABASE: 'test',
    MYSQL_USER: 'test',
    MYSQL_PASSWORD: 'test-only',
  };

  assert.equal(validateDatabaseEnvironment(environment).DB_PORT, 3306);
  for (const key of Object.keys(environment)) {
    assert.throws(() => validateDatabaseEnvironment({ ...environment, [key]: '' }), {
      message: `Falta configurar ${key} en backend/.env`,
    });
  }
  for (const port of ['0', '65536', '3306.5', 'invalid']) {
    assert.throws(() => validateDatabaseEnvironment({ ...environment, DB_PORT: port }), {
      message: 'DB_PORT debe ser un puerto entre 1 y 65535',
    });
  }
});

test('el backend consulta MySQL y responde a GET /health', { timeout: 15000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const app = await NestFactory.create(AppModule, { logger: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');

  const rows = await app.get(DataSource).query('SELECT 1 AS value');
  assert.equal(rows[0].value, '1');

  const response = await fetch(`${await app.getUrl()}/health`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await response.json(), { status: 'ok' });
});
