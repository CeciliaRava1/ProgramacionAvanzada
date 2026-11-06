import {
  createTrainerRequest, respondToTrainerRequest, TrainerRequestConflictError, TrainerRequestNotFoundError,
  type TrainerRequestStatus,
} from '../domain/trainer-request.js';
import { TrainerRequestRepository } from '../domain/trainer-request.repository.js';
import { UserRepository } from '../domain/user.repository.js';
import type { TrainerSummary } from './list-trainers.js';

export type StudentTrainerState =
  | { status: 'unassigned' }
  | { status: 'pending'; requestId: number; trainer: TrainerSummary }
  | { status: 'assigned'; trainer: TrainerSummary };

export class TrainerRequests {
  constructor(private readonly users: UserRepository, private readonly requests: TrainerRequestRepository) {}

  async send(studentId: number, trainerId: number) {
    await this.trainerSummary(trainerId);
    return this.requests.withStudent(studentId, async (transaction) => {
      const assignment = await transaction.findAssignment();
      const pending = await transaction.findPending();
      const saved = await transaction.saveRequest(createTrainerRequest(studentId, trainerId, assignment, pending));
      return { id: saved.id, trainerId: saved.trainerId, status: saved.status };
    });
  }

  async current(studentId: number): Promise<StudentTrainerState> {
    const connection = await this.requests.withStudent(studentId, async (transaction) => {
      const assignment = await transaction.findAssignment();
      if (assignment) return { status: 'assigned' as const, trainerId: assignment.trainerId };
      const pending = await transaction.findPending();
      return pending ? { status: 'pending' as const, trainerId: pending.trainerId, requestId: pending.id } : null;
    });
    if (!connection) return { status: 'unassigned' };
    const trainer = await this.trainerSummary(connection.trainerId);
    return connection.status === 'assigned' ? { status: 'assigned', trainer } : { status: 'pending', requestId: connection.requestId, trainer };
  }

  async received(trainerId: number) {
    const requests = await this.requests.findPendingByTrainer(trainerId);
    return requests.map(({ id, studentId, firstName, lastName }) => ({ id, student: { id: studentId, firstName, lastName } }));
  }

  async respond(id: number, actorId: number, status: Exclude<TrainerRequestStatus, 'pending'>): Promise<void> {
    const original = await this.requests.findById(id);
    if (!original) throw new TrainerRequestNotFoundError('La solicitud no existe.');
    await this.requests.withStudent(original.studentId, async (transaction) => {
      const request = await transaction.findRequest(id);
      if (!request) throw new TrainerRequestNotFoundError('La solicitud no existe.');
      const updated = respondToTrainerRequest(request, actorId, status);
      if (status === 'accepted') {
        if (await transaction.findAssignment()) throw new TrainerRequestConflictError('El alumno ya tiene un entrenador asignado.');
        await transaction.saveAssignment({ studentId: request.studentId, trainerId: request.trainerId });
      }
      await transaction.saveRequest(updated);
    });
  }

  private async trainerSummary(id: number): Promise<TrainerSummary> {
    const trainer = await this.users.findById(id);
    if (!trainer?.id || trainer.role !== 'trainer') throw new TrainerRequestNotFoundError('El entrenador no existe.');
    return { id: trainer.id, firstName: trainer.firstName, lastName: trainer.lastName, availability: trainer.availability ?? null };
  }
}
