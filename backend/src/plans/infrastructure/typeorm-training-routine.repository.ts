import { DataSource, EntitySchema, type EntityManager } from 'typeorm';
import type { TrainingRoutine } from '../domain/training-routine.js';
import { TrainingProgramNotFoundError } from '../domain/training-routine.js';
import { TrainingRoutineRepository, type SavedTrainingRoutine } from '../domain/training-routine.repository.js';
import { TrainingPlanSchema } from './typeorm-training-plan.repository.js';
import { TrainingProgramSchema } from './typeorm-training-program.repository.js';

export const TrainingRoutineSchema = new EntitySchema<TrainingRoutine>({
  name: 'TrainingRoutine', tableName: 'training_routines',
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    programId: { name: 'program_id', type: 'int', unsigned: true },
    name: { type: 'varchar', length: 200 },
    description: { type: 'text', nullable: true },
  },
});

export class TypeOrmTrainingRoutineRepository extends TrainingRoutineRepository {
  constructor(private readonly dataSource: DataSource) { super(); }

  save(routine: TrainingRoutine): Promise<SavedTrainingRoutine> {
    return this.dataSource.transaction(async (manager) => {
      await this.lockProgram(manager, routine.programId);
      return await manager.getRepository(TrainingRoutineSchema).save(routine) as SavedTrainingRoutine;
    });
  }

  findByProgram(programId: number): Promise<SavedTrainingRoutine[]> {
    return this.dataSource.getRepository(TrainingRoutineSchema).createQueryBuilder('routine')
      .innerJoin(TrainingProgramSchema.options.name, 'program', 'program.id = routine.programId')
      .innerJoin(TrainingPlanSchema.options.name, 'plan', 'plan.id = program.planId AND plan.deletedAt IS NULL')
      .where('routine.programId = :programId', { programId }).orderBy('routine.id', 'ASC').getMany() as Promise<SavedTrainingRoutine[]>;
  }

  update(id: number, programId: number, details: Pick<TrainingRoutine, 'name' | 'description'>): Promise<SavedTrainingRoutine | null> {
    return this.dataSource.transaction(async (manager) => {
      await this.lockProgram(manager, programId);
      const result = await manager.getRepository(TrainingRoutineSchema).update({ id, programId }, details);
      return result.affected ? { id, programId, ...details } : null;
    });
  }

  private async lockProgram(manager: EntityManager, programId: number): Promise<void> {
    // El bloqueo coordina las escrituras con la eliminación lógica del plan que contiene al programa.
    const program = await manager.getRepository(TrainingProgramSchema).createQueryBuilder('program')
      .innerJoin(TrainingPlanSchema.options.name, 'plan', 'plan.id = program.planId AND plan.deletedAt IS NULL')
      .where('program.id = :programId', { programId }).setLock('pessimistic_write').getOne();
    if (!program) throw new TrainingProgramNotFoundError();
  }
}
