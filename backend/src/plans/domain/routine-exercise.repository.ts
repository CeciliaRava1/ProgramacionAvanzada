import type { RoutineExerciseDetails, RoutineExerciseInput } from './routine-exercise.js';

export abstract class RoutineExerciseRepository {
  abstract list(routineId: number): Promise<RoutineExerciseDetails[]>;
  abstract save(routineId: number, exerciseId: number, input: RoutineExerciseInput): Promise<RoutineExerciseDetails>;
  abstract update(routineId: number, id: number, input: RoutineExerciseInput): Promise<RoutineExerciseDetails | null>;
}
