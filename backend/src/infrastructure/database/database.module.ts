import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { fileURLToPath } from 'node:url';
import { UserSchema } from '../../users/infrastructure/typeorm-user.repository.js';
import { CreateUsers1792713600000 } from './migrations/1792713600000-create-users.js';
import { CreateSessions1792713600001 } from './migrations/1792713600001-create-sessions.js';
import { SessionSchema } from '../../users/infrastructure/typeorm-session.store.js';
import { AddTeacherAvailability1792800000000 } from './migrations/1792800000000-add-teacher-availability.js';
import { CreateTeacherRequests1792800000001 } from './migrations/1792800000001-create-teacher-requests.js';
import { TrainerAssignmentSchema, TrainerRequestSchema } from '../../users/infrastructure/typeorm-trainer-request.repository.js';
import { TrainingPlanSchema } from '../../plans/infrastructure/typeorm-training-plan.repository.js';
import { CreateTrainingPlans1792800000002 } from './migrations/1792800000002-create-training-plans.js';
import { UniqueTrainingPlanStudent1792800000003 } from './migrations/1792800000003-unique-training-plan-student.js';
import { SoftDeleteTrainingPlans1792800000004 } from './migrations/1792800000004-soft-delete-training-plans.js';
import { TrainingProgramSchema } from '../../plans/infrastructure/typeorm-training-program.repository.js';
import { CreateTrainingPrograms1792800000005 } from './migrations/1792800000005-create-training-programs.js';
import { TrainingRoutineSchema } from '../../plans/infrastructure/typeorm-training-routine.repository.js';
import { CreateTrainingRoutines1792800000006 } from './migrations/1792800000006-create-training-routines.js';
import { ExerciseSchema } from '../../plans/infrastructure/typeorm-exercise.repository.js';
import { RoutineExerciseSchema } from '../../plans/infrastructure/typeorm-routine-exercise.repository.js';
import { CreateExercises1792800000007 } from './migrations/1792800000007-create-exercises.js';
import { RenameTeachersToTrainers1792800000008 } from './migrations/1792800000008-rename-teachers-to-trainers.js';
import { AddRecommendedRir1792800000009 } from './migrations/1792800000009-add-recommended-rir.js';
import { AllowEmptyExerciseDetails1792800000010 } from './migrations/1792800000010-allow-empty-exercise-details.js';

export function validateDatabaseEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of ['DB_HOST', 'DB_PORT', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD']) {
    const value = environment[key];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Falta configurar ${key} en backend/.env`);
    }
  }

  const port = Number(environment.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT debe ser un puerto entre 1 y 65535');
  }

  return { ...environment, DB_PORT: port };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: fileURLToPath(new URL('../../../.env', import.meta.url)),
      validate: validateDatabaseEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        database: config.getOrThrow<string>('MYSQL_DATABASE'),
        username: config.getOrThrow<string>('MYSQL_USER'),
        password: config.getOrThrow<string>('MYSQL_PASSWORD'),
        entities: [UserSchema, SessionSchema, TrainerRequestSchema, TrainerAssignmentSchema, TrainingPlanSchema, TrainingProgramSchema, TrainingRoutineSchema, ExerciseSchema, RoutineExerciseSchema],
        migrations: [CreateUsers1792713600000, CreateSessions1792713600001, AddTeacherAvailability1792800000000, CreateTeacherRequests1792800000001, CreateTrainingPlans1792800000002, UniqueTrainingPlanStudent1792800000003, SoftDeleteTrainingPlans1792800000004, CreateTrainingPrograms1792800000005, CreateTrainingRoutines1792800000006, CreateExercises1792800000007, RenameTeachersToTrainers1792800000008, AddRecommendedRir1792800000009, AllowEmptyExerciseDetails1792800000010],
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
export class DatabaseModule {}
