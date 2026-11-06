import type { TrainingPlan } from './training-plan.js';

export type SavedTrainingPlan = TrainingPlan & { id: number };

export abstract class TrainingPlanRepository {
  abstract save(plan: TrainingPlan): Promise<SavedTrainingPlan>;
  abstract findByStudent(studentId: number): Promise<SavedTrainingPlan[]>;
  abstract update(id: number, studentId: number, details: Pick<TrainingPlan, 'name' | 'objective'>): Promise<SavedTrainingPlan | null>;
  abstract remove(id: number, studentId: number): Promise<boolean>;
}
