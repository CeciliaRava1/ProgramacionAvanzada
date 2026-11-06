import { isTrainerSummary, type TrainerSummary } from './trainers.ts';

export type StudentTrainerState =
  | { status: 'unassigned' }
  | { status: 'pending'; requestId: number; trainer: TrainerSummary }
  | { status: 'assigned'; trainer: TrainerSummary };

export interface ReceivedTrainerRequest {
  id: number;
  student: { id: number; firstName: string; lastName: string };
}

export class TrainerRequestError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function objectWithKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}

function invalidResponse(): never {
  throw new TrainerRequestError('No se pudo confirmar el resultado: la respuesta del servidor no es válida.');
}

/** Centraliza cookies y errores de estas operaciones; nunca muestra mensajes internos del servidor. */
async function request(path: string, method: string, signal: AbortSignal, expectedStatus: number, body?: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch('http://127.0.0.1:3000/users/trainer-requests' + path, {
      method, credentials: 'include',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new TrainerRequestError(method === 'GET' ? 'No se pudo consultar el estado. Revisá la conexión.' :
      'No se pudo confirmar la operación. Actualizá el estado antes de reintentar.');
  }
  if (!response.ok) {
    throw new TrainerRequestError(
      response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
        response.status === 403 ? 'No tenés permiso para realizar esta operación.' :
          response.status === 404 ? 'El entrenador o la solicitud ya no están disponibles.' :
            response.status === 409 ? 'El estado cambió. Actualizá para ver la solicitud o el entrenador vigente.' :
              response.status === 400 ? 'Revisá el entrenador seleccionado.' : 'No se pudo completar la operación. Intentá nuevamente.',
      response.status,
    );
  }
  if (response.status !== expectedStatus) invalidResponse();
  return expectedStatus === 204 ? undefined : response.json().catch(() => invalidResponse());
}

export async function getStudentTrainerState(signal: AbortSignal): Promise<StudentTrainerState> {
  const body = await request('/current', 'GET', signal, 200);
  if (objectWithKeys(body, ['status']) && body.status === 'unassigned') return { status: 'unassigned' };
  if (objectWithKeys(body, ['status', 'trainer']) && body.status === 'assigned' && isTrainerSummary(body.trainer)) {
    return { status: 'assigned', trainer: body.trainer };
  }
  if (objectWithKeys(body, ['status', 'requestId', 'trainer']) && body.status === 'pending' && isId(body.requestId) && isTrainerSummary(body.trainer)) {
    return { status: 'pending', requestId: body.requestId, trainer: body.trainer };
  }
  return invalidResponse();
}

export async function getReceivedTrainerRequests(signal: AbortSignal): Promise<ReceivedTrainerRequest[]> {
  const body = await request('', 'GET', signal, 200);
  if (!Array.isArray(body) || body.some((entry: unknown) => {
    if (!objectWithKeys(entry, ['id', 'student']) || !isId(entry.id) || !objectWithKeys(entry.student, ['id', 'firstName', 'lastName'])) return true;
    const student = entry.student;
    return !isId(student.id) || typeof student.firstName !== 'string' || [...student.firstName.trim()].length < 1 || [...student.firstName].length > 100 ||
      typeof student.lastName !== 'string' || [...student.lastName.trim()].length < 1 || [...student.lastName].length > 100;
  })) return invalidResponse();
  return body as ReceivedTrainerRequest[];
}

export async function sendTrainerRequest(trainerId: number, signal: AbortSignal): Promise<void> {
  if (!isId(trainerId)) throw new TrainerRequestError('Seleccioná un entrenador válido.');
  const body = await request('', 'POST', signal, 201, { trainerId });
  if (!objectWithKeys(body, ['id', 'trainerId', 'status']) || !isId(body.id) || body.trainerId !== trainerId || body.status !== 'pending') invalidResponse();
}

export async function respondTrainerRequest(id: number, action: 'accept' | 'reject' | 'cancel', signal: AbortSignal): Promise<void> {
  if (!isId(id)) throw new TrainerRequestError('Seleccioná una solicitud válida.');
  await request(`/${id}${action === 'cancel' ? '' : '/' + action}`, action === 'cancel' ? 'DELETE' : 'POST', signal, 204);
}
