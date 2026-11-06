import { TrainingRoutines } from './training-routines.js';
import { ExerciseRepository } from '../domain/exercise.repository.js';
import { ExerciseNotFoundError } from '../domain/exercise.js';
import { RoutineExerciseRepository } from '../domain/routine-exercise.repository.js';
import { validateRoutineExercise, type RoutineExerciseInput } from '../domain/routine-exercise.js';
import { TrainingRoutineNotFoundError } from '../domain/training-routine.js';

export class RoutineExercises {
  constructor(private readonly entries: RoutineExerciseRepository, private readonly catalog: ExerciseRepository, private readonly routines: TrainingRoutines) {}

  async list(trainerId: number, studentId: number, planId: number, programId: number, routineId: number) {
    await this.authorize(trainerId, studentId, planId, programId, routineId);
    return this.entries.list(routineId);
  }

  async create(trainerId: number, studentId: number, planId: number, programId: number, routineId: number, exerciseId: number, input: RoutineExerciseInput) {
    await this.authorize(trainerId, studentId, planId, programId, routineId);
    const details = validateRoutineExercise(input);
    if (!await this.catalog.findById(exerciseId)) throw new ExerciseNotFoundError();
    return this.entries.save(routineId, exerciseId, details);
  }

  async update(trainerId: number, studentId: number, planId: number, programId: number, routineId: number, id: number, input: RoutineExerciseInput) {
    await this.authorize(trainerId, studentId, planId, programId, routineId);
    const saved = await this.entries.update(routineId, id, validateRoutineExercise(input));
    if (!saved) throw new ExerciseNotFoundError();
    return saved;
  }

  private async authorize(trainerId: number, studentId: number, planId: number, programId: number, routineId: number) {
    if (!(await this.routines.list(trainerId, studentId, planId, programId)).some(routine => routine.id === routineId)) throw new TrainingRoutineNotFoundError();
  }
}
