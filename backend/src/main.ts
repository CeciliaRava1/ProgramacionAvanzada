import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { origenDelFrontend } from './usuarios/presentacion/middleware-de-sesion.js';

async function iniciar(): Promise<void> {
  const aplicacion = await NestFactory.create(AppModule);
  const config = aplicacion.get(ConfigService);
  aplicacion.enableCors({ origin: origenDelFrontend(config), methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: true });
  // En Docker se escucha en 0.0.0.0 dentro del contenedor; compose publica el puerto solo en 127.0.0.1.
  await aplicacion.listen(Number(config.get<string>('PORT') ?? 3000), config.get<string>('HOST') ?? '127.0.0.1');
  console.log(`Backend disponible en ${await aplicacion.getUrl()}`);
}

iniciar().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
