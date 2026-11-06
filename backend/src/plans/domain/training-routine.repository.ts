import type { TrainingRoutine } from './training-routine.js';

export type SavedTrainingRoutine = TrainingRoutine & { id: number };

export abstract class TrainingRoutineRepository {
  abstract save(routine: TrainingRoutine): Promise<SavedTrainingRoutine>;
  abstract findByProgram(programId: number): Promise<SavedTrainingRoutine[]>;
  abstract update(id: number, programId: number, details: Pick<TrainingRoutine, 'name' | 'description'>): Promise<SavedTrainingRoutine | null>;
}
