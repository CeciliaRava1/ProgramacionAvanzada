import type { TrainingProgram } from './training-program.js';

export type SavedTrainingProgram = TrainingProgram & { id: number };

export abstract class TrainingProgramRepository {
  abstract save(program: TrainingProgram): Promise<SavedTrainingProgram>;
  abstract findByPlan(planId: number): Promise<SavedTrainingProgram[]>;
}
