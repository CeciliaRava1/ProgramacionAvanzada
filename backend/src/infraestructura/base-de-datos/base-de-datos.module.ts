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
import { TrainingPlanSchema } from '../../plans/infrastructure/typeorm-training-plan.repository.js';
import { CreateTrainingPlans1792800000002 } from './migraciones/1792800000002-create-training-plans.js';
import { UniqueTrainingPlanStudent1792800000003 } from './migraciones/1792800000003-unique-training-plan-student.js';
import { SoftDeleteTrainingPlans1792800000004 } from './migraciones/1792800000004-soft-delete-training-plans.js';
import { TrainingProgramSchema } from '../../plans/infrastructure/typeorm-training-program.repository.js';
import { CreateTrainingPrograms1792800000005 } from './migraciones/1792800000005-create-training-programs.js';
import { TrainingRoutineSchema } from '../../plans/infrastructure/typeorm-training-routine.repository.js';
import { CreateTrainingRoutines1792800000006 } from './migraciones/1792800000006-create-training-routines.js';
import { ExerciseSchema } from '../../plans/infrastructure/typeorm-exercise.repository.js';
import { RoutineExerciseSchema } from '../../plans/infrastructure/typeorm-routine-exercise.repository.js';
import { CreateExercises1792800000007 } from './migraciones/1792800000007-create-exercises.js';
import { AddRecommendedRir1792800000009 } from './migraciones/1792800000009-add-recommended-rir.js';
import { AllowEmptyExerciseDetails1792800000010 } from './migraciones/1792800000010-allow-empty-exercise-details.js';
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
        entities: [EsquemaDeUsuario, EsquemaDeSesion, EsquemaDeSolicitud, EsquemaDeVinculacion, TrainingPlanSchema, TrainingProgramSchema, TrainingRoutineSchema, ExerciseSchema, RoutineExerciseSchema],
        migrations: [CrearUsuarios1792713600000, CrearSesiones1792713600001, CrearSolicitudesYVinculaciones1792800000001, CreateTrainingPlans1792800000002, UniqueTrainingPlanStudent1792800000003, SoftDeleteTrainingPlans1792800000004, CreateTrainingPrograms1792800000005, CreateTrainingRoutines1792800000006, CreateExercises1792800000007, AddRecommendedRir1792800000009, AllowEmptyExerciseDetails1792800000010, CrearRecuperacionesDeContrasena1792900000000],
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
