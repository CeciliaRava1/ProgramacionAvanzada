export type TrainerRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface TrainerRequest {
  id?: number;
  studentId: number;
  trainerId: number;
  status: TrainerRequestStatus;
}

export interface TrainerAssignment {
  studentId: number;
  trainerId: number;
}

export class TrainerRequestConflictError extends Error {}
export class TrainerRequestNotFoundError extends Error {}
export class TrainerRequestPermissionError extends Error {}

/** Una solicitud pendiente y una asignación vigente impiden iniciar otra solicitud. */
export function createTrainerRequest(
  studentId: number, trainerId: number, assignment: TrainerAssignment | null, pending: TrainerRequest | null,
): TrainerRequest {
  if (assignment) throw new TrainerRequestConflictError('Ya tenés un entrenador asignado.');
  if (pending) throw new TrainerRequestConflictError('Ya tenés una solicitud pendiente.');
  return { studentId, trainerId, status: 'pending' };
}

/** La autorización depende de la participación, además del rol comprobado por HTTP. */
export function respondToTrainerRequest(
  request: TrainerRequest, actorId: number, status: Exclude<TrainerRequestStatus, 'pending'>,
): TrainerRequest {
  const allowed = actorId === request.trainerId || (status === 'cancelled' && actorId === request.studentId);
  if (!allowed) throw new TrainerRequestPermissionError('No tenés permiso para responder esta solicitud.');
  if (request.status !== 'pending') throw new TrainerRequestConflictError('La solicitud ya no está pendiente.');
  return { ...request, status };
}
