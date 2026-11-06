export interface TrainingProgram {
  id: number;
  planId: number;
  name: string;
  startDate: string;
  endDate: string;
}

export type TrainingProgramInput = Pick<TrainingProgram, 'name' | 'startDate' | 'endDate'>;
export type TrainingProgramFieldErrors = Partial<Record<keyof TrainingProgramInput, string>>;

export class TrainingProgramError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

function isDate(value: string): boolean {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseProgramDate(value: string): string {
  const text = value.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(text);
  if (!match) return '';
  const date = `${match[3]}-${match[2]}-${match[1]}`;
  return isDate(date) ? date : '';
}

export function formatProgramDate(value: string): string {
  return isDate(value) ? value.split('-').reverse().join('/') : '';
}

export function getTrainingProgramFieldErrors(input: TrainingProgramInput): TrainingProgramFieldErrors {
  const errors: TrainingProgramFieldErrors = {};
  if ([...input.name.trim()].length < 1 || [...input.name.trim()].length > 200) errors.name = 'Ingresá entre 1 y 200 caracteres.';
  if (!isDate(input.startDate)) errors.startDate = 'Ingresá una fecha de inicio válida.';
  if (!isDate(input.endDate)) errors.endDate = 'Ingresá una fecha de fin válida.';
  if (!errors.startDate && !errors.endDate && input.endDate < input.startDate) errors.endDate = 'La fecha de fin no puede ser anterior a la de inicio.';
  return errors;
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 4_294_967_295;
}

function isProgram(value: unknown, planId: number): value is TrainingProgram {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const program = value as Record<string, unknown>;
  return Object.keys(program).length === 5 && Object.keys(program).every((key) => ['id', 'planId', 'name', 'startDate', 'endDate'].includes(key)) &&
    isId(program.id) && program.planId === planId && typeof program.name === 'string' && typeof program.startDate === 'string' && typeof program.endDate === 'string' &&
    Object.keys(getTrainingProgramFieldErrors({ name: program.name, startDate: program.startDate, endDate: program.endDate })).length === 0;
}

export { isProgram as isTrainingProgram };

function invalidResponse(): never {
  throw new TrainingProgramError('No se pudo confirmar el resultado: la respuesta del servidor no es válida.');
}

async function request(studentId: number, planId: number, signal: AbortSignal, input?: TrainingProgramInput): Promise<unknown> {
  if (!isId(studentId) || !isId(planId)) throw new TrainingProgramError('Seleccioná un alumno y un plan válidos.');
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:3000/users/students/${studentId}/plans/${planId}/programs`, {
      credentials: 'include', method: input ? 'POST' : 'GET',
      ...(input ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: input.name, startDate: input.startDate, endDate: input.endDate }) } : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new TrainingProgramError(input ? 'No se pudo confirmar la creación. Se volverá a consultar el programa antes de reintentar.' : 'No se pudo consultar el programa. Revisá la conexión.');
  }
  if (!response.ok) throw new TrainingProgramError(
    response.status === 400 ? 'Revisá el nombre y las fechas del programa.' :
      response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
        response.status === 403 ? 'No tenés permiso para acceder al programa de este alumno.' :
          response.status === 404 ? 'El plan ya no está disponible.' :
            response.status === 409 ? 'El plan ya tiene un programa.' : 'No se pudo completar la operación con el programa. Intentá nuevamente.', response.status,
  );
  if (response.status !== (input ? 201 : 200)) invalidResponse();
  return response.json().catch(() => invalidResponse());
}

export async function getTrainingPrograms(studentId: number, planId: number, signal: AbortSignal): Promise<TrainingProgram[]> {
  const body = await request(studentId, planId, signal);
  if (!Array.isArray(body) || body.length > 1 || body.some((program) => !isProgram(program, planId))) invalidResponse();
  return body as TrainingProgram[];
}

export async function createTrainingProgram(studentId: number, planId: number, input: TrainingProgramInput, signal: AbortSignal): Promise<TrainingProgram> {
  if (Object.keys(getTrainingProgramFieldErrors(input)).length) throw new TrainingProgramError('Revisá los datos del programa.');
  const body = await request(studentId, planId, signal, input);
  if (!isProgram(body, planId) || body.name !== input.name.trim() || body.startDate !== input.startDate || body.endDate !== input.endDate) invalidResponse();
  return body;
}
