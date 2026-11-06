import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { DatabaseModule } from './database.module.js';

/** Aplica solo las migraciones pendientes y siempre cierra la conexión. */
async function migrate(): Promise<void> {
  const app = await NestFactory.createApplicationContext(DatabaseModule, { logger: ['error'], abortOnError: false });
  try {
    const applied = await app.get(DataSource).runMigrations({ transaction: 'each' });
    console.log(`Migraciones aplicadas: ${applied.length}.`);
  } finally {
    await app.close();
  }
}

migrate().catch(() => {
  console.error('No se pudieron aplicar las migraciones. Revisá MySQL, la configuración y el esquema existente.');
  process.exitCode = 1;
});
