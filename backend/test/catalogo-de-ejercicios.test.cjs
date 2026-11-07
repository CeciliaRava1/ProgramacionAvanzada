const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

const archivoDeEjercicios = new URL('../datos/ejercicios.json', 'file:///' + __filename.replaceAll('\\', '/'));

test('el catálogo para sembrar tiene solo textos en español, identificadores estables y sin medios', async () => {
  const { validarCatalogoDeEjercicios } = await import('../dist/infraestructura/base-de-datos/sembrar-ejercicios.js');
  const filas = JSON.parse(await readFile(archivoDeEjercicios, 'utf8'));
  assert.ok(validarCatalogoDeEjercicios(filas).length >= 50);
  for (const fila of filas) assert.match(fila.identificador, /^[a-z0-9]+(-[a-z0-9]+)*$/u, fila.identificador);
  const fila = filas[0];
  assert.throws(() => validarCatalogoDeEjercicios([]));
  for (const invalido of [null, {}, [null], [{ ...fila, nombre: '' }], [{ ...fila, instrucciones: 'x'.repeat(65536) }], [{ ...fila, imagen: 'imagen.jpg' }], [fila, fila]]) {
    assert.throws(() => validarCatalogoDeEjercicios(invalido));
  }
});

test('el catálogo valida filtros y paginación y no devuelve errores internos', async () => {
  const { EjerciciosController } = await import('../dist/planes/presentacion/ejercicios.controller.js');
  const llamadas = [], pagina = { elementos: [], total: 0, partesDelCuerpo: [], equipamientos: [] };
  const controlador = new EjerciciosController({ buscar: async (consulta) => { llamadas.push(consulta); return pagina; } });
  assert.deepEqual(await controlador.buscar({ q: ' press ', desde: '20' }), pagina);
  assert.deepEqual(llamadas, [{ q: 'press', parteDelCuerpo: '', equipamiento: '', desde: 20 }]);
  for (const consulta of [{ q: ['press'] }, { q: 'x'.repeat(101) }, { parteDelCuerpo: {} }, { equipamiento: 1 }, { desde: '-1' }, { desde: '0.5' }, { desde: '4294967296' }, { desde: ['0'] }, { fuente: 'privada' }]) {
    await assert.rejects(controlador.buscar(consulta), (error) => error.getStatus() === 400);
  }
  await assert.rejects(new EjerciciosController({ buscar: async () => { throw new Error('SQL privado'); } }).buscar({}), (error) => error.getStatus() === 500 && !JSON.stringify(error.getResponse()).includes('SQL'));
});

test('MySQL encuentra palabras en cualquier orden, sin distinguir tildes, entre nombre, músculo y equipamiento', { timeout: 30000 }, async (t) => {
  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { BaseDeDatosModule } = await import('../dist/infraestructura/base-de-datos/base-de-datos.module.js');
  const { EsquemaDeEjercicio, RepositorioDeEjerciciosTypeOrm } = await import('../dist/planes/infraestructura/repositorio-de-ejercicios-typeorm.js');
  const app = await NestFactory.createApplicationContext(BaseDeDatosModule, { logger: false, abortOnError: false });
  const db = app.get(DataSource), marca = randomUUID(), filas = [];
  t.after(async () => { try { for (const fila of filas) await db.getRepository(EsquemaDeEjercicio).delete({ id: fila.id }); } finally { await app.close(); } });
  for (const [nombre, equipamiento, musculoObjetivo] of [['Press', 'Barra', 'Pectorales'], ['Remo', 'Mancuerna', 'Dorsales']]) {
    filas.push(await db.getRepository(EsquemaDeEjercicio).save({ identificador: `prueba-${randomUUID()}`, nombre: nombre + ' ' + marca, parteDelCuerpo: 'Pecho', equipamiento, musculoObjetivo, instrucciones: 'Instrucciones de prueba.' }));
  }
  const repositorio = new RepositorioDeEjerciciosTypeOrm(db), filtros = { parteDelCuerpo: '', equipamiento: '', desde: 0 };
  for (const q of [`${marca} press barra`, `BARRA   ${marca}  press`, `pectorales ${marca} pecho`, `${marca} pectoráles`]) {
    const resultado = await repositorio.buscar({ ...filtros, q });
    assert.equal(resultado.total, 1, q); assert.equal(resultado.elementos[0].id, filas[0].id);
  }
  for (const q of [`${marca} inexistente`, `${marca} %`, `${marca} ' OR 1=1`]) assert.equal((await repositorio.buscar({ ...filtros, q })).total, 0);
  assert.equal((await repositorio.buscar({ ...filtros, q: marca, equipamiento: 'Mancuerna' })).elementos[0].id, filas[1].id);
  assert.equal((await repositorio.buscar({ ...filtros, q: marca, desde: 1 })).elementos[0].id, filas[1].id);
});
