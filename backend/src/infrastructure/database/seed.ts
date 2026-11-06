import 'reflect-metadata';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Repository } from 'typeorm';
import { InvalidUserDataError, normalizeUserDetails, type User } from '../../users/domain/user.js';
import { hashPassword } from '../../users/infrastructure/hash-password.js';
import { UserSchema } from '../../users/infrastructure/typeorm-user.repository.js';

interface InitialAdminCredentials {
  email?: string;
  password?: string;
}

class SeedError extends Error {}

export async function seedInitialAdmin(
  users: Pick<Repository<User>, 'findOneBy' | 'save'>,
  credentials: InitialAdminCredentials,
): Promise<boolean> {
  // Las credenciales de preparación nunca restablecen una cuenta existente.
  if (await users.findOneBy({ role: 'admin' })) {
    return false;
  }

  const { email, password } = credentials;

  if (typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' || !password
  ) {
    throw new SeedError('Completá INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD en backend/.env.');
  }

  if ([...password].length < 8 || [...password].length > 128 || /\s/u.test(password)) {
    throw new SeedError('INITIAL_ADMIN_PASSWORD debe tener entre 8 y 128 caracteres, sin espacios.');
  }

  const details = normalizeUserDetails({
    firstName: 'Administrador',
    lastName: 'Local',
    email,
  });

  if (await users.findOneBy({ email: details.email })) {
    throw new SeedError('El correo inicial ya pertenece a otra cuenta. Elegí otro INITIAL_ADMIN_EMAIL.');
  }

  const passwordHash = await hashPassword(password);
  await users.save({ ...details, role: 'admin', passwordHash, availability: null });

  return true;
}

async function main(): Promise<void> {
  const { NestFactory } = await import('@nestjs/core');
  const { ConfigService } = await import('@nestjs/config');
  const { DataSource } = await import('typeorm');
  const { DatabaseModule } = await import('./database.module.js');
  const app = await NestFactory.createApplicationContext(DatabaseModule, {
    logger: ['error'],
    abortOnError: false,
  });

  try {
    const config = app.get(ConfigService);
    const created = await seedInitialAdmin(app.get(DataSource).getRepository(UserSchema), {
      email: config.get<string>('INITIAL_ADMIN_EMAIL'),
      password: config.get<string>('INITIAL_ADMIN_PASSWORD'),
    });

    console.log(created
      ? 'Administrador inicial creado. Iniciá sesión con las credenciales de backend/.env.'
      : 'Ya existe un administrador. Se conservó su cuenta y contraseña.');
  } finally {
    await app.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    const message = error instanceof SeedError
      ? error.message
      : error instanceof InvalidUserDataError
        ? 'Revisá INITIAL_ADMIN_EMAIL: debe ser un correo electrónico válido.'
        : 'No se pudo ejecutar el seed. Revisá MySQL y backend/.env y ejecutá db:migrate antes.';

    console.error(message);
    process.exitCode = 1;
  });
}
