import { RepositorioDeSolicitudes } from '../../usuarios/dominio/repositorio-de-solicitudes.js';
import { createTrainingPlan, TrainingPlanAlreadyExistsError, TrainingPlanNotFoundError } from '../domain/training-plan.js';
import { TrainingPlanRepository, type SavedTrainingPlan } from '../domain/training-plan.repository.js';

export class PlanAccessError extends Error {}

function publicPlan({ id, studentId, name, objective }: SavedTrainingPlan): SavedTrainingPlan {
  return { id, studentId, name, objective };
}

export class TrainingPlans {
  constructor(private readonly plans: TrainingPlanRepository, private readonly assignments: RepositorioDeSolicitudes) {}

  async create(trainerId: number, studentId: number, input: { name: string; objective: string }): Promise<SavedTrainingPlan> {
    await this.authorize(trainerId, studentId);
    if ((await this.plans.findByStudent(studentId)).length) throw new TrainingPlanAlreadyExistsError();
    const saved = await this.plans.save(createTrainingPlan(studentId, input.name, input.objective));
    return publicPlan(saved);
  }

  async list(trainerId: number, studentId: number): Promise<SavedTrainingPlan[]> {
    await this.authorize(trainerId, studentId);
    return (await this.plans.findByStudent(studentId)).map(publicPlan);
  }

  async update(trainerId: number, studentId: number, id: number, input: { name: string; objective: string }): Promise<SavedTrainingPlan> {
    await this.authorize(trainerId, studentId);
    const { name, objective } = createTrainingPlan(studentId, input.name, input.objective);
    const saved = await this.plans.update(id, studentId, { name, objective });
    if (!saved) throw new TrainingPlanNotFoundError();
    return publicPlan(saved);
  }

  async remove(trainerId: number, studentId: number, id: number): Promise<void> {
    await this.authorize(trainerId, studentId);
    if (!await this.plans.remove(id, studentId)) throw new TrainingPlanNotFoundError();
  }

  private async authorize(trainerId: number, studentId: number): Promise<void> {
    const assignment = await this.assignments.buscarVinculacion(studentId);
    if (assignment?.entrenadorId !== trainerId) throw new PlanAccessError('No tenés permiso para acceder a los planes de este alumno.');
  }
}
