import { TrainingPlans } from './training-plans.js';
import { TrainingPlanNotFoundError } from '../domain/training-plan.js';
import { createTrainingProgram, TrainingProgramAlreadyExistsError, type TrainingProgramInput } from '../domain/training-program.js';
import { TrainingProgramRepository, type SavedTrainingProgram } from '../domain/training-program.repository.js';

function publicProgram({ id, planId, name, startDate, endDate }: SavedTrainingProgram): SavedTrainingProgram {
  return { id, planId, name, startDate, endDate };
}

export class TrainingPrograms {
  constructor(private readonly programs: TrainingProgramRepository, private readonly plans: TrainingPlans) {}

  async list(trainerId: number, studentId: number, planId: number): Promise<SavedTrainingProgram[]> {
    await this.authorize(trainerId, studentId, planId);
    return (await this.programs.findByPlan(planId)).map(publicProgram);
  }

  async create(trainerId: number, studentId: number, planId: number, input: TrainingProgramInput): Promise<SavedTrainingProgram> {
    await this.authorize(trainerId, studentId, planId);
    const program = createTrainingProgram(planId, input);
    if ((await this.programs.findByPlan(planId)).length) throw new TrainingProgramAlreadyExistsError();
    return publicProgram(await this.programs.save(program));
  }

  private async authorize(trainerId: number, studentId: number, planId: number): Promise<void> {
    if (!(await this.plans.list(trainerId, studentId)).some((plan) => plan.id === planId)) throw new TrainingPlanNotFoundError();
  }
}
