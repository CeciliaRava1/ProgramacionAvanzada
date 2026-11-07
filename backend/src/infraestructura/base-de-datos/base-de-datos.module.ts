import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { fileURLToPath } from 'node:url';
import { EsquemaDeUsuario } from '../../usuarios/infraestructura/repositorio-de-usuarios-typeorm.js';
import { CrearUsuarios1792713600000 } from './migraciones/1792713600000-crear-usuarios.js';
import { CrearSesiones1792713600001 } from './migraciones/1792713600001-crear-sesiones.js';
import { EsquemaDeSesion } from '../../usuarios/infraestructura/almacen-de-sesiones.js';
import { CrearSolicitudesYVinculaciones1792800000001 } from './migraciones/1792800000001-crear-solicitudes-y-vinculaciones.js';
import { EsquemaDeSolicitud, EsquemaDeVinculacion } from '../../usuarios/infraestructura/repositorio-de-solicitudes-typeorm.js';
import { EsquemaDePlan } from '../../planes/infraestructura/repositorio-de-planes-typeorm.js';
import { EsquemaDeRutina } from '../../planes/infraestructura/repositorio-de-rutinas-typeorm.js';
import { EsquemaDeEjercicio } from '../../planes/infraestructura/repositorio-de-ejercicios-typeorm.js';
import { EsquemaDeEjercicioDeRutina } from '../../planes/infraestructura/repositorio-de-ejercicios-de-rutina-typeorm.js';
import { CrearPlanesDeEntrenamiento1792800000002 } from './migraciones/1792800000002-crear-planes-de-entrenamiento.js';
import { CrearRutinas1792800000003 } from './migraciones/1792800000003-crear-rutinas.js';
import { CrearEjercicios1792800000004 } from './migraciones/1792800000004-crear-ejercicios.js';
import { CrearRecuperacionesDeContrasena1792900000000 } from './migraciones/1792900000000-crear-recuperaciones-de-contrasena.js';

export function validarEntornoDeBaseDeDatos(
  entorno: Record<string, unknown>,
): Record<string, unknown> {
  for (const clave of ['BD_HOST', 'BD_PUERTO', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD']) {
    const valor = entorno[clave];
    if (typeof valor !== 'string' || valor.trim() === '') {
      throw new Error(`Falta configurar ${clave} en el archivo .env`);
    }
  }

  const puerto = Number(entorno.BD_PUERTO);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error('BD_PUERTO debe ser un puerto entre 1 y 65535');
  }

  return { ...entorno, BD_PUERTO: puerto };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: fileURLToPath(new URL('../../../.env', import.meta.url)),
      validate: validarEntornoDeBaseDeDatos,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow<string>('BD_HOST'),
        port: config.getOrThrow<number>('BD_PUERTO'),
        database: config.getOrThrow<string>('MYSQL_DATABASE'),
        username: config.getOrThrow<string>('MYSQL_USER'),
        password: config.getOrThrow<string>('MYSQL_PASSWORD'),
        entities: [EsquemaDeUsuario, EsquemaDeSesion, EsquemaDeSolicitud, EsquemaDeVinculacion, EsquemaDePlan, EsquemaDeRutina, EsquemaDeEjercicio, EsquemaDeEjercicioDeRutina],
        migrations: [CrearUsuarios1792713600000, CrearSesiones1792713600001, CrearSolicitudesYVinculaciones1792800000001, CrearPlanesDeEntrenamiento1792800000002, CrearRutinas1792800000003, CrearEjercicios1792800000004, CrearRecuperacionesDeContrasena1792900000000],
        timezone: 'Z',
        // DATE representa un día de calendario; no debe convertirse a una hora local.
        dateStrings: ['DATE'],
        migrationsRun: false,
        synchronize: false,
        connectTimeout: 5000,
        retryAttempts: 1,
      }),
    }),
  ],
})
export class BaseDeDatosModule {}
