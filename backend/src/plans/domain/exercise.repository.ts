import type { Exercise, ExercisePage, ExerciseSearch } from './exercise.js';

export abstract class ExerciseRepository {
  abstract search(search: ExerciseSearch): Promise<ExercisePage>;
  abstract findById(id: number): Promise<Exercise | null>;
}
