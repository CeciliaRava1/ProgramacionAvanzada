const assert = require('node:assert/strict');
const { test } = require('node:test');

test('rechaza una configuración de base incompleta o un puerto inválido', async () => {
  const { validarEntornoDeBaseDeDatos } = await import(
    '../dist/infraestructura/base-de-datos/base-de-datos.module.js'
  );
  const entorno = {
    BD_HOST: '127.0.0.1',
    BD_PUERTO: '3306',
    MYSQL_DATABASE: 'test',
    MYSQL_USER: 'test',
    MYSQL_PASSWORD: 'test-only',
  };

  assert.equal(validarEntornoDeBaseDeDatos(entorno).BD_PUERTO, 3306);
  for (const clave of Object.keys(entorno)) {
    assert.throws(() => validarEntornoDeBaseDeDatos({ ...entorno, [clave]: '' }), {
      message: `Falta configurar ${clave} en el archivo .env`,
    });
  }
  for (const puerto of ['0', '65536', '3306.5', 'invalid']) {
    assert.throws(() => validarEntornoDeBaseDeDatos({ ...entorno, BD_PUERTO: puerto }), {
      message: 'BD_PUERTO debe ser un puerto entre 1 y 65535',
    });
  }
});

test('el backend consulta MySQL y responde a GET /health', { timeout: 15000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../dist/app.module.js');
  const aplicacion = await NestFactory.create(AppModule, { logger: false });
  t.after(() => aplicacion.close());
  await aplicacion.listen(0, '127.0.0.1');

  const filas = await aplicacion.get(DataSource).query('SELECT 1 AS valor');
  assert.equal(filas[0].valor, '1');

  const respuesta = await fetch(`${await aplicacion.getUrl()}/health`);

  assert.equal(respuesta.status, 200);
  assert.match(respuesta.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await respuesta.json(), { status: 'ok' });
});
