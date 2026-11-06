import { TrainingPrograms } from './training-programs.js';
import { createTrainingRoutine, TrainingProgramNotFoundError, TrainingRoutineNotFoundError, type TrainingRoutineInput } from '../domain/training-routine.js';
import { TrainingRoutineRepository, type SavedTrainingRoutine } from '../domain/training-routine.repository.js';

function publicRoutine({ id, programId, name, description }: SavedTrainingRoutine): SavedTrainingRoutine {
  return { id, programId, name, description };
}

export class TrainingRoutines {
  constructor(private readonly routines: TrainingRoutineRepository, private readonly programs: TrainingPrograms) {}

  async list(trainerId: number, studentId: number, planId: number, programId: number): Promise<SavedTrainingRoutine[]> {
    await this.authorize(trainerId, studentId, planId, programId);
    return (await this.routines.findByProgram(programId)).map(publicRoutine);
  }

  async create(trainerId: number, studentId: number, planId: number, programId: number, input: TrainingRoutineInput): Promise<SavedTrainingRoutine> {
    await this.authorize(trainerId, studentId, planId, programId);
    return publicRoutine(await this.routines.save(createTrainingRoutine(programId, input)));
  }

  async update(trainerId: number, studentId: number, planId: number, programId: number, id: number, input: TrainingRoutineInput): Promise<SavedTrainingRoutine> {
    await this.authorize(trainerId, studentId, planId, programId);
    const { name, description } = createTrainingRoutine(programId, input);
    const saved = await this.routines.update(id, programId, { name, description });
    if (!saved) throw new TrainingRoutineNotFoundError();
    return publicRoutine(saved);
  }

  private async authorize(trainerId: number, studentId: number, planId: number, programId: number): Promise<void> {
    if (!(await this.programs.list(trainerId, studentId, planId)).some((program) => program.id === programId)) throw new TrainingProgramNotFoundError();
  }
}
