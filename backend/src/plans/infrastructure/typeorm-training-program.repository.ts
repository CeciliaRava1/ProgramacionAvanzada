import { DataSource, EntitySchema, QueryFailedError } from 'typeorm';
import type { TrainingProgram } from '../domain/training-program.js';
import { TrainingProgramAlreadyExistsError } from '../domain/training-program.js';
import { TrainingProgramRepository, type SavedTrainingProgram } from '../domain/training-program.repository.js';
import { TrainingPlanNotFoundError } from '../domain/training-plan.js';
import { TrainingPlanSchema } from './typeorm-training-plan.repository.js';

export const TrainingProgramSchema = new EntitySchema<TrainingProgram>({
  name: 'TrainingProgram', tableName: 'training_programs',
  uniques: [{ name: 'UQ_training_program_plan', columns: ['planId'] }],
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    planId: { name: 'plan_id', type: 'int', unsigned: true },
    name: { type: 'varchar', length: 200 },
    startDate: { name: 'start_date', type: 'date' },
    endDate: { name: 'end_date', type: 'date' },
  },
});

export class TypeOrmTrainingProgramRepository extends TrainingProgramRepository {
  constructor(private readonly dataSource: DataSource) { super(); }

  async save(program: TrainingProgram): Promise<SavedTrainingProgram> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Ordena la creación con la eliminación lógica del plan para no guardar bajo uno ya retirado.
        const plan = await manager.getRepository(TrainingPlanSchema).findOne({ where: { id: program.planId }, lock: { mode: 'pessimistic_write' } });
        if (!plan) throw new TrainingPlanNotFoundError();
        return await manager.getRepository(TrainingProgramSchema).save(program) as SavedTrainingProgram;
      });
    } catch (error: unknown) {
      if (error instanceof QueryFailedError && error.driverError.code === 'ER_DUP_ENTRY') throw new TrainingProgramAlreadyExistsError();
      throw error;
    }
  }

  findByPlan(planId: number): Promise<SavedTrainingProgram[]> {
    return this.dataSource.getRepository(TrainingProgramSchema).createQueryBuilder('program')
      .innerJoin(TrainingPlanSchema.options.name, 'plan', 'plan.id = program.planId AND plan.deletedAt IS NULL')
      .where('program.planId = :planId', { planId }).getMany() as Promise<SavedTrainingProgram[]>;
  }
}
