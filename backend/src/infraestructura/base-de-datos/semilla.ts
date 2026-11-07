import 'reflect-metadata';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Repository } from 'typeorm';
import { DatosDeUsuarioInvalidosError, normalizarDatosDeUsuario, type Usuario } from '../../usuarios/dominio/usuario.js';
import { hashearContrasena } from '../../usuarios/infraestructura/hash-de-contrasena.js';
import { EsquemaDeUsuario } from '../../usuarios/infraestructura/repositorio-de-usuarios-typeorm.js';

interface CredencialesDelAdministradorInicial {
  correo?: string;
  contrasena?: string;
}

class ErrorDeSemilla extends Error {}

export async function sembrarAdministradorInicial(
  usuarios: Pick<Repository<Usuario>, 'findOneBy' | 'save'>,
  credenciales: CredencialesDelAdministradorInicial,
): Promise<boolean> {
  // Las credenciales de preparación nunca restablecen una cuenta existente.
  if (await usuarios.findOneBy({ rol: 'administrador' })) {
    return false;
  }

  const { correo, contrasena } = credenciales;

  if (typeof correo !== 'string' || !correo.trim() ||
    typeof contrasena !== 'string' || !contrasena
  ) {
    throw new ErrorDeSemilla('Completá ADMIN_INICIAL_CORREO y ADMIN_INICIAL_CONTRASENA en el archivo .env.');
  }

  if ([...contrasena].length < 8 || [...contrasena].length > 128 || /\s/u.test(contrasena)) {
    throw new ErrorDeSemilla('ADMIN_INICIAL_CONTRASENA debe tener entre 8 y 128 caracteres, sin espacios.');
  }

  const datos = normalizarDatosDeUsuario({
    nombre: 'Administrador',
    apellido: 'Local',
    correo,
  });

  const hashDeContrasena = await hashearContrasena(contrasena);
  await usuarios.save({ ...datos, rol: 'administrador', hashDeContrasena, horario: null });

  return true;
}

async function principal(): Promise<void> {
  const { NestFactory } = await import('@nestjs/core');
  const { ConfigService } = await import('@nestjs/config');
  const { DataSource } = await import('typeorm');
  const { BaseDeDatosModule } = await import('./base-de-datos.module.js');
  const aplicacion = await NestFactory.createApplicationContext(BaseDeDatosModule, {
    logger: ['error'],
    abortOnError: false,
  });

  try {
    const config = aplicacion.get(ConfigService);
    const creado = await sembrarAdministradorInicial(aplicacion.get(DataSource).getRepository(EsquemaDeUsuario), {
      correo: config.get<string>('ADMIN_INICIAL_CORREO'),
      contrasena: config.get<string>('ADMIN_INICIAL_CONTRASENA'),
    });

    console.log(creado
      ? 'Administrador inicial creado. Iniciá sesión con las credenciales del archivo .env.'
      : 'Ya existe un administrador. Se conservó su cuenta y contraseña.');
  } finally {
    await aplicacion.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  principal().catch((error: unknown) => {
    const mensaje = error instanceof ErrorDeSemilla
      ? error.message
      : error instanceof DatosDeUsuarioInvalidosError
        ? 'Revisá ADMIN_INICIAL_CORREO: debe ser un correo electrónico válido.'
        : 'No se pudo ejecutar la semilla. Revisá MySQL y el archivo .env y ejecutá bd:migrar antes.';

    console.error(mensaje);
    process.exitCode = 1;
  });
}
