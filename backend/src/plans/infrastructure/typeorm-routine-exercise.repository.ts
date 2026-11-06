import { DataSource, EntitySchema, type EntityManager } from 'typeorm';
import { RoutineExerciseRepository } from '../domain/routine-exercise.repository.js';
import type { RoutineExercise, RoutineExerciseDetails, RoutineExerciseInput } from '../domain/routine-exercise.js';
import { publicExercise, type Exercise } from '../domain/exercise.js';
import { TrainingRoutineNotFoundError } from '../domain/training-routine.js';
import { TrainingRoutineSchema } from './typeorm-training-routine.repository.js';
import { TrainingProgramSchema } from './typeorm-training-program.repository.js';
import { TrainingPlanSchema } from './typeorm-training-plan.repository.js';
import { ExerciseSchema } from './typeorm-exercise.repository.js';

export const RoutineExerciseSchema = new EntitySchema<RoutineExercise>({
  name: 'RoutineExercise', tableName: 'routine_exercises',
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    routineId: { name: 'routine_id', type: 'int', unsigned: true }, exerciseId: { name: 'exercise_id', type: 'int', unsigned: true },
    setCount: { name: 'set_count', type: 'smallint', unsigned: true }, recommendedRepetitions: { name: 'recommended_repetitions', type: 'smallint', unsigned: true },
    recommendedWeightKg: { name: 'recommended_weight_kg', type: 'decimal', precision: 8, scale: 2, nullable: true, transformer: { to: (value: number | null) => value, from: (value: string | null) => value === null ? null : Number(value) } },
    restSeconds: { name: 'rest_seconds', type: 'smallint', unsigned: true, nullable: true },
    recommendedRir: { name: 'recommended_rir', type: 'smallint', unsigned: true, nullable: true },
  },
});

export class TypeOrmRoutineExerciseRepository extends RoutineExerciseRepository {
  constructor(private readonly db: DataSource) { super(); }

  async list(routineId: number): Promise<RoutineExerciseDetails[]> {
    const entries = await this.query(this.db.manager, routineId).orderBy('entry.id', 'ASC').getMany() as RoutineExerciseDetails[];
    return entries.map(entry => ({ ...entry, exercise: publicExercise(entry.exercise as Exercise) }));
  }

  async save(routineId: number, exerciseId: number, input: RoutineExerciseInput) {
    return this.db.transaction(async manager => {
      await this.lockRoutine(manager, routineId);
      const saved = await manager.getRepository(RoutineExerciseSchema).save({ routineId, exerciseId, ...input });
      return this.details(manager, routineId, saved.id);
    });
  }

  async update(routineId: number, id: number, input: RoutineExerciseInput) {
    return this.db.transaction(async manager => {
      await this.lockRoutine(manager, routineId);
      const result = await manager.getRepository(RoutineExerciseSchema).update({ id, routineId }, input);
      return result.affected ? this.details(manager, routineId, id) : null;
    });
  }

  private query(manager: EntityManager, routineId: number) {
    return manager.getRepository(RoutineExerciseSchema).createQueryBuilder('entry')
      .innerJoin(TrainingRoutineSchema.options.name, 'routine', 'routine.id = entry.routineId')
      .innerJoin(TrainingProgramSchema.options.name, 'program', 'program.id = routine.programId')
      .innerJoin(TrainingPlanSchema.options.name, 'plan', 'plan.id = program.planId AND plan.deletedAt IS NULL')
      .innerJoinAndMapOne('entry.exercise', ExerciseSchema.options.name, 'exercise', 'exercise.id = entry.exerciseId')
      .where('entry.routineId = :routineId', { routineId });
  }

  private async details(manager: EntityManager, routineId: number, id: number): Promise<RoutineExerciseDetails> {
    const entry = await this.query(manager, routineId).andWhere('entry.id = :id', { id }).getOneOrFail() as RoutineExerciseDetails;
    return { ...entry, exercise: publicExercise(entry.exercise as Exercise) };
  }

  private async lockRoutine(manager: EntityManager, routineId: number) {
    const routine = await manager.getRepository(TrainingRoutineSchema).findOneBy({ id: routineId });
    if (!routine) throw new TrainingRoutineNotFoundError();
    // Mantiene el orden programa/plan → rutina que utiliza la edición de rutinas.
    const program = await manager.getRepository(TrainingProgramSchema).createQueryBuilder('program')
      .innerJoin(TrainingPlanSchema.options.name, 'plan', 'plan.id = program.planId AND plan.deletedAt IS NULL')
      .where('program.id = :programId', { programId: routine.programId }).setLock('pessimistic_write').getOne();
    if (!program || !await manager.getRepository(TrainingRoutineSchema).findOne({ where: { id: routineId, programId: program.id }, lock: { mode: 'pessimistic_write' } })) throw new TrainingRoutineNotFoundError();
  }
}
