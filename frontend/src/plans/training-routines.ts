export interface TrainingRoutine { id: number; programId: number; name: string; description: string | null; }
export interface TrainingRoutineInput { name: string; description?: string | null; }
export type TrainingRoutineFieldErrors = Partial<Record<'name' | 'description', string>>;

export class TrainingRoutineError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

export function getTrainingRoutineFieldErrors(input: TrainingRoutineInput): TrainingRoutineFieldErrors {
  const errors: TrainingRoutineFieldErrors = {};
  if ([...input.name.trim()].length < 1 || [...input.name.trim()].length > 200) errors.name = 'Ingresá entre 1 y 200 caracteres.';
  if ([...(input.description?.trim() || '')].length > 5000) errors.description = 'Ingresá hasta 5000 caracteres.';
  return errors;
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 4_294_967_295;
}

function isRoutine(value: unknown, programId: number): value is TrainingRoutine {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const routine = value as Record<string, unknown>;
  return Object.keys(routine).length === 4 && Object.keys(routine).every((key) => ['id', 'programId', 'name', 'description'].includes(key)) &&
    isId(routine.id) && routine.programId === programId && typeof routine.name === 'string' && (routine.description === null || typeof routine.description === 'string') &&
    Object.keys(getTrainingRoutineFieldErrors({ name: routine.name, description: routine.description })).length === 0;
}

export { isRoutine as isTrainingRoutine };

function invalidResponse(): never { throw new TrainingRoutineError('No se pudo confirmar el resultado: la respuesta del servidor no es válida.'); }

async function request(studentId: number, planId: number, programId: number, signal: AbortSignal, input?: TrainingRoutineInput, routineId?: number): Promise<unknown> {
  if (![studentId, planId, programId].every(isId)) throw new TrainingRoutineError('Seleccioná un alumno, un plan y un programa válidos.');
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:3000/users/students/${studentId}/plans/${planId}/programs/${programId}/routines${routineId === undefined ? '' : '/' + routineId}`, {
      credentials: 'include', method: routineId !== undefined ? 'PUT' : input ? 'POST' : 'GET',
      ...(input ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: input.name, description: input.description?.trim() || null }) } : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new TrainingRoutineError(input ? `No se pudo confirmar la ${routineId === undefined ? 'creación' : 'modificación'}. Se volverá a consultar el listado; revisalo antes de volver a guardar.` : 'No se pudieron consultar las rutinas. Revisá la conexión.');
  }
  if (!response.ok) throw new TrainingRoutineError(
    response.status === 400 ? 'Revisá el nombre y la descripción de la rutina.' :
      response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
        response.status === 403 ? 'No tenés permiso para acceder a las rutinas de este alumno.' :
          response.status === 404 ? 'El plan, el programa o la rutina ya no está disponible.' : 'No se pudo completar la operación con las rutinas. Intentá nuevamente.', response.status,
  );
  if (response.status !== (input && routineId === undefined ? 201 : 200)) invalidResponse();
  return response.json().catch(() => invalidResponse());
}

export async function getTrainingRoutines(studentId: number, planId: number, programId: number, signal: AbortSignal): Promise<TrainingRoutine[]> {
  const body = await request(studentId, planId, programId, signal);
  if (!Array.isArray(body) || body.some((routine) => !isRoutine(routine, programId))) invalidResponse();
  return body as TrainingRoutine[];
}

export async function createTrainingRoutine(studentId: number, planId: number, programId: number, input: TrainingRoutineInput, signal: AbortSignal): Promise<TrainingRoutine> {
  if (Object.keys(getTrainingRoutineFieldErrors(input)).length) throw new TrainingRoutineError('Revisá los datos de la rutina.');
  const body = await request(studentId, planId, programId, signal, input);
  if (!isRoutine(body, programId) || body.name !== input.name.trim() || body.description !== (input.description?.trim() || null)) invalidResponse();
  return body;
}

export async function updateTrainingRoutine(studentId: number, planId: number, programId: number, routineId: number, input: TrainingRoutineInput, signal: AbortSignal): Promise<TrainingRoutine> {
  if (Object.keys(getTrainingRoutineFieldErrors(input)).length) throw new TrainingRoutineError('Revisá los datos de la rutina.');
  if (!isId(routineId)) throw new TrainingRoutineError('Seleccioná una rutina válida.');
  const body = await request(studentId, planId, programId, signal, input, routineId);
  if (!isRoutine(body, programId) || body.id !== routineId || body.name !== input.name.trim() || body.description !== (input.description?.trim() || null)) invalidResponse();
  return body;
}
