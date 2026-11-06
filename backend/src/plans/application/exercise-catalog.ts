import { ExerciseRepository } from '../domain/exercise.repository.js';
import type { ExerciseSearch } from '../domain/exercise.js';

export class ExerciseCatalog {
  constructor(private readonly exercises: ExerciseRepository) {}
  search(search: ExerciseSearch) { return this.exercises.search(search); }
}
