import { DataSource, EntitySchema, IsNull, QueryFailedError } from 'typeorm';
import type { TrainingPlan } from '../domain/training-plan.js';
import { TrainingPlanAlreadyExistsError } from '../domain/training-plan.js';
import { TrainingPlanRepository, type SavedTrainingPlan } from '../domain/training-plan.repository.js';

type StoredTrainingPlan = TrainingPlan & { deletedAt?: Date | null };

export const TrainingPlanSchema = new EntitySchema<StoredTrainingPlan>({
  name: 'TrainingPlan', tableName: 'training_plans',
  // La migración protege la unicidad sobre la columna generada del plan no eliminado.
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    studentId: { name: 'student_id', type: 'int', unsigned: true },
    name: { type: 'varchar', length: 200 },
    objective: { type: 'text' },
    deletedAt: { name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, deleteDate: true, select: false },
  },
});

export class TypeOrmTrainingPlanRepository extends TrainingPlanRepository {
  constructor(private readonly dataSource: DataSource) { super(); }

  async save(plan: TrainingPlan): Promise<SavedTrainingPlan> {
    try {
      return await this.dataSource.getRepository(TrainingPlanSchema).save(plan) as SavedTrainingPlan;
    } catch (error: unknown) {
      if (error instanceof QueryFailedError && error.driverError.code === 'ER_DUP_ENTRY') throw new TrainingPlanAlreadyExistsError();
      throw error;
    }
  }

  findByStudent(studentId: number): Promise<SavedTrainingPlan[]> {
    return this.dataSource.getRepository(TrainingPlanSchema).find({ where: { studentId }, order: { id: 'ASC' } }) as Promise<SavedTrainingPlan[]>;
  }

  async update(id: number, studentId: number, details: Pick<TrainingPlan, 'name' | 'objective'>): Promise<SavedTrainingPlan | null> {
    const result = await this.dataSource.getRepository(TrainingPlanSchema).update({ id, studentId, deletedAt: IsNull() }, details);
    return result.affected ? { id, studentId, ...details } : null;
  }

  async remove(id: number, studentId: number): Promise<boolean> {
    const result = await this.dataSource.getRepository(TrainingPlanSchema).softDelete({ id, studentId, deletedAt: IsNull() });
    return Boolean(result.affected);
  }
}
