import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { BaseDeDatosModule } from './base-de-datos.module.js';
import { ExerciseSchema } from '../../plans/infrastructure/typeorm-exercise.repository.js';
import type { Exercise } from '../../plans/domain/exercise.js';

/** Valida todo el archivo antes de abrir una transacción; la fuente conserva la identidad al reimportar. */
export function parseExerciseCatalog(value: unknown): Omit<Exercise, 'id'>[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('El catálogo debe contener ejercicios.');
  const ids = new Set<string>();
  const fields = ['source', 'sourceId', 'name', 'bodyPart', 'equipment', 'target', 'instructions'];
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length !== fields.length || fields.some(field => typeof row[field] !== 'string' || !row[field].trim())) throw new Error('El catálogo contiene datos no válidos.');
    for (const field of fields) {
      const limit = field === 'name' ? 300 : field === 'instructions' ? 65535 : 100;
      if ((field === 'instructions' ? Buffer.byteLength(row[field], 'utf8') : [...row[field]].length) > limit) throw new Error('El catálogo supera los límites de almacenamiento.');
    }
    const key = JSON.stringify([row.source, row.sourceId]);
    if (ids.has(key)) throw new Error('El catálogo contiene identificadores repetidos.');
    ids.add(key);
  }
  return value;
}

async function main() {
  const entries = parseExerciseCatalog(JSON.parse(await readFile(new URL('../../../data/exercises.json', import.meta.url), 'utf8')));
  const app = await NestFactory.createApplicationContext(BaseDeDatosModule, { logger: ['error'], abortOnError: false });
  try {
    await app.get(DataSource).transaction(async manager => {
      for (let offset = 0; offset < entries.length; offset += 100) await manager.getRepository(ExerciseSchema).upsert(entries.slice(offset, offset + 100), ['source', 'sourceId']);
    });
    console.log(`Ejercicios importados o actualizados: ${entries.length}.`);
  } finally { await app.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('No se pudo importar el catálogo. Revisá MySQL, las migraciones y el archivo de datos.'); process.exitCode = 1; });
}
