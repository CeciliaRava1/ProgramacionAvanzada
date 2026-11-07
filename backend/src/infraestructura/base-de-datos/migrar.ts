import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { BaseDeDatosModule } from './base-de-datos.module.js';

/** Aplica solo las migraciones pendientes y siempre cierra la conexión. */
async function migrar(): Promise<void> {
  const aplicacion = await NestFactory.createApplicationContext(BaseDeDatosModule, { logger: ['error'], abortOnError: false });
  try {
    const aplicadas = await aplicacion.get(DataSource).runMigrations({ transaction: 'each' });
    console.log(`Migraciones aplicadas: ${aplicadas.length}.`);
  } finally {
    await aplicacion.close();
  }
}

migrar().catch(() => {
  console.error('No se pudieron aplicar las migraciones. Revisá MySQL, la configuración y el esquema existente.');
  process.exitCode = 1;
});
