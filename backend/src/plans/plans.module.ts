import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { UsersModule } from '../users/users.module.js';
import { TrainerRequestRepository } from '../users/domain/trainer-request.repository.js';
import { createSessionMiddleware } from '../users/presentation/session.middleware.js';
import { TrainingPlans } from './application/training-plans.js';
import { TrainingPlanRepository } from './domain/training-plan.repository.js';
import { TypeOrmTrainingPlanRepository } from './infrastructure/typeorm-training-plan.repository.js';
import { PlansController } from './presentation/plans.controller.js';
import { TrainingPrograms } from './application/training-programs.js';
import { TrainingProgramRepository } from './domain/training-program.repository.js';
import { TypeOrmTrainingProgramRepository } from './infrastructure/typeorm-training-program.repository.js';
import { TrainingProgramsController } from './presentation/training-programs.controller.js';
import { TrainingRoutines } from './application/training-routines.js';
import { TrainingRoutineRepository } from './domain/training-routine.repository.js';
import { TypeOrmTrainingRoutineRepository } from './infrastructure/typeorm-training-routine.repository.js';
import { TrainingRoutinesController } from './presentation/training-routines.controller.js';
import { ExerciseRepository } from './domain/exercise.repository.js';
import { RoutineExerciseRepository } from './domain/routine-exercise.repository.js';
import { TypeOrmExerciseRepository } from './infrastructure/typeorm-exercise.repository.js';
import { TypeOrmRoutineExerciseRepository } from './infrastructure/typeorm-routine-exercise.repository.js';
import { ExerciseCatalog } from './application/exercise-catalog.js';
import { RoutineExercises } from './application/routine-exercises.js';
import { ExercisesController } from './presentation/exercises.controller.js';
import { RoutineExercisesController } from './presentation/routine-exercises.controller.js';
import { StudentPlanning } from './application/student-planning.js';
import { StudentPlanningController } from './presentation/student-planning.controller.js';

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [PlansController, TrainingProgramsController, TrainingRoutinesController, ExercisesController, RoutineExercisesController, StudentPlanningController],
  providers: [
    { provide: StudentPlanning, inject: [TrainingPlanRepository, TrainingProgramRepository, TrainingRoutineRepository, RoutineExerciseRepository], useFactory: (plans: TrainingPlanRepository, programs: TrainingProgramRepository, routines: TrainingRoutineRepository, entries: RoutineExerciseRepository) => new StudentPlanning(plans, programs, routines, entries) },
    { provide: ExerciseRepository, inject: [DataSource], useFactory: (db: DataSource) => new TypeOrmExerciseRepository(db) },
    { provide: RoutineExerciseRepository, inject: [DataSource], useFactory: (db: DataSource) => new TypeOrmRoutineExerciseRepository(db) },
    { provide: ExerciseCatalog, inject: [ExerciseRepository], useFactory: (catalog: ExerciseRepository) => new ExerciseCatalog(catalog) },
    { provide: RoutineExercises, inject: [RoutineExerciseRepository, ExerciseRepository, TrainingRoutines], useFactory: (entries: RoutineExerciseRepository, catalog: ExerciseRepository, routines: TrainingRoutines) => new RoutineExercises(entries, catalog, routines) },
    { provide: TrainingPlanRepository, inject: [DataSource], useFactory: (dataSource: DataSource) => new TypeOrmTrainingPlanRepository(dataSource) },
    { provide: TrainingPlans, inject: [TrainingPlanRepository, TrainerRequestRepository], useFactory: (plans: TrainingPlanRepository, assignments: TrainerRequestRepository) => new TrainingPlans(plans, assignments) },
    { provide: TrainingProgramRepository, inject: [DataSource], useFactory: (dataSource: DataSource) => new TypeOrmTrainingProgramRepository(dataSource) },
    { provide: TrainingPrograms, inject: [TrainingProgramRepository, TrainingPlans], useFactory: (programs: TrainingProgramRepository, plans: TrainingPlans) => new TrainingPrograms(programs, plans) },
    { provide: TrainingRoutineRepository, inject: [DataSource], useFactory: (dataSource: DataSource) => new TypeOrmTrainingRoutineRepository(dataSource) },
    { provide: TrainingRoutines, inject: [TrainingRoutineRepository, TrainingPrograms], useFactory: (routines: TrainingRoutineRepository, programs: TrainingPrograms) => new TrainingRoutines(routines, programs) },
  ],
})
export class PlansModule implements NestModule {
  constructor(private readonly config: ConfigService, private readonly dataSource: DataSource) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(createSessionMiddleware(this.config, this.dataSource)).forRoutes(PlansController, TrainingProgramsController, TrainingRoutinesController, ExercisesController, RoutineExercisesController, StudentPlanningController);
  }
}
