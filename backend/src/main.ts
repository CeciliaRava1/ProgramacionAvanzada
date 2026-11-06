import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: 'http://127.0.0.1:5173', methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: true });
  await app.listen(3000, '127.0.0.1');
  console.log(`Backend disponible en ${await app.getUrl()}`);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
