export interface TrainingPlan {
  id: number;
  studentId: number;
  name: string;
  objective: string;
}

export interface TrainingPlanInput { name: string; objective: string; }
export type TrainingPlanFieldErrors = Partial<Record<keyof TrainingPlanInput, string>>;

export class TrainingPlanError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

export function getTrainingPlanFieldErrors(input: TrainingPlanInput): TrainingPlanFieldErrors {
  const errors: TrainingPlanFieldErrors = {};
  if ([...input.name.trim()].length < 1 || [...input.name.trim()].length > 200) errors.name = 'Ingresá entre 1 y 200 caracteres.';
  if ([...input.objective.trim()].length < 1 || [...input.objective.trim()].length > 5000) errors.objective = 'Ingresá entre 1 y 5000 caracteres.';
  return errors;
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 4_294_967_295;
}

function isPlan(value: unknown, studentId: number): value is TrainingPlan {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const plan = value as Record<string, unknown>;
  return Object.keys(plan).length === 4 && Object.keys(plan).every((key) => ['id', 'studentId', 'name', 'objective'].includes(key)) &&
    isId(plan.id) && plan.studentId === studentId && typeof plan.name === 'string' && typeof plan.objective === 'string' &&
    Object.keys(getTrainingPlanFieldErrors({ name: plan.name, objective: plan.objective })).length === 0;
}

export { isPlan as isTrainingPlan };

function invalidResponse(): never {
  throw new TrainingPlanError('No se pudo confirmar el resultado: la respuesta del servidor no es válida.');
}

/** Comparte cookies y mensajes conocidos; nunca presenta errores internos del servidor. */
async function request(studentId: number, signal: AbortSignal, method: 'GET' | 'POST' | 'PUT' | 'DELETE', input?: TrainingPlanInput, planId?: number): Promise<unknown> {
  if (!isId(studentId)) throw new TrainingPlanError('Seleccioná un alumno válido.');
  if ((method === 'PUT' || method === 'DELETE') && !isId(planId)) throw new TrainingPlanError('Seleccioná un plan válido.');
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:3000/users/students/${studentId}/plans${planId === undefined ? '' : '/' + planId}`, {
      credentials: 'include', method,
      ...(input ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: input.name, objective: input.objective }) } : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new TrainingPlanError(method === 'GET' ? 'No se pudieron consultar los planes. Revisá la conexión.' :
      `No se pudo confirmar la ${method === 'POST' ? 'creación' : method === 'PUT' ? 'modificación' : 'eliminación'}. Se volverá a consultar el plan antes de reintentar.`);
  }
  if (!response.ok) throw new TrainingPlanError(
    response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
      response.status === 403 ? 'No tenés permiso para acceder a los planes de este alumno.' :
        response.status === 404 ? 'El plan ya no está disponible.' :
        response.status === 409 ? 'El alumno ya tiene un plan.' :
        response.status === 400 ? 'Revisá el nombre, el objetivo y el alumno seleccionado.' :
          'No se pudo completar la operación con los planes. Intentá nuevamente.', response.status,
  );
  if (response.status !== (method === 'POST' ? 201 : method === 'DELETE' ? 204 : 200)) invalidResponse();
  if (method === 'DELETE') return undefined;
  return response.json().catch(() => invalidResponse());
}

export async function getTrainingPlans(studentId: number, signal: AbortSignal): Promise<TrainingPlan[]> {
  const body = await request(studentId, signal, 'GET');
  if (!Array.isArray(body) || body.length > 1 || body.some((plan) => !isPlan(plan, studentId))) invalidResponse();
  return body as TrainingPlan[];
}

export async function createTrainingPlan(studentId: number, input: TrainingPlanInput, signal: AbortSignal): Promise<TrainingPlan> {
  if (Object.keys(getTrainingPlanFieldErrors(input)).length) throw new TrainingPlanError('Revisá los datos del plan.');
  const body = await request(studentId, signal, 'POST', input);
  if (!isPlan(body, studentId) || body.name !== input.name.trim() || body.objective !== input.objective.trim()) invalidResponse();
  return body;
}

export async function updateTrainingPlan(studentId: number, planId: number, input: TrainingPlanInput, signal: AbortSignal): Promise<TrainingPlan> {
  if (Object.keys(getTrainingPlanFieldErrors(input)).length) throw new TrainingPlanError('Revisá los datos del plan.');
  const body = await request(studentId, signal, 'PUT', input, planId);
  if (!isPlan(body, studentId) || body.id !== planId || body.name !== input.name.trim() || body.objective !== input.objective.trim()) invalidResponse();
  return body;
}

export async function deleteTrainingPlan(studentId: number, planId: number, signal: AbortSignal): Promise<void> {
  await request(studentId, signal, 'DELETE', undefined, planId);
}
