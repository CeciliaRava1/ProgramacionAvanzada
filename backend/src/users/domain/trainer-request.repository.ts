import type { TrainerAssignment, TrainerRequest } from './trainer-request.js';

export type SavedTrainerRequest = TrainerRequest & { id: number };
export interface ReceivedTrainerRequest extends SavedTrainerRequest {
  firstName: string;
  lastName: string;
}

export interface AssignedStudent {
  id: number;
  firstName: string;
  lastName: string;
}

export interface TrainerRequestTransaction {
  findPending(): Promise<SavedTrainerRequest | null>;
  findAssignment(): Promise<TrainerAssignment | null>;
  findRequest(id: number): Promise<SavedTrainerRequest | null>;
  saveRequest(request: TrainerRequest): Promise<SavedTrainerRequest>;
  saveAssignment(assignment: TrainerAssignment): Promise<void>;
}

export abstract class TrainerRequestRepository {
  abstract findById(id: number): Promise<SavedTrainerRequest | null>;
  abstract findPendingByTrainer(trainerId: number): Promise<ReceivedTrainerRequest[]>;
  abstract findAssignedByTrainer(trainerId: number): Promise<AssignedStudent[]>;
  abstract findAssignment(studentId: number): Promise<TrainerAssignment | null>;
  // El bloqueo por alumno mantiene juntas las validaciones y escrituras de cada operación.
  abstract withStudent<T>(studentId: number, action: (transaction: TrainerRequestTransaction) => Promise<T>): Promise<T>;
}
