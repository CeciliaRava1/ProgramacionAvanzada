import { isRecordWithKeys } from '../validation.ts';

export interface Exercise {
  id: number;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  instructions: string;
}

export interface ExercisePage {
  items: Exercise[];
  total: number;
  bodyParts: string[];
  equipment: string[];
}

export interface ExerciseFilters {
  q: string;
  bodyPart: string;
  equipment: string;
  offset: number;
}

export interface RoutineContext {
  studentId: number;
  planId: number;
  programId: number;
  routineId: number;
}

export interface RoutineExerciseInput {
  setCount: number;
  recommendedRepetitions: number;
  recommendedWeightKg: number | null;
  restSeconds: number | null;
  recommendedRir?: number | null;
}

export interface RoutineExercise extends RoutineExerciseInput {
  id: number;
  routineId: number;
  exerciseId: number;
  exercise: Exercise;
  recommendedRir: number | null;
}

export type RoutineExerciseFieldErrors = Partial<Record<keyof RoutineExerciseInput, string>>;

export class RoutineExerciseError extends Error {
  readonly status: number;
  readonly uncertain: boolean;

  constructor(message: string, status = 0, uncertain = false) {
    super(message);
    this.status = status;
    this.uncertain = uncertain;
  }
}

export function getRoutineExerciseFieldErrors(input: RoutineExerciseInput): RoutineExerciseFieldErrors {
  const errors: RoutineExerciseFieldErrors = {};

  for (const key of ['setCount', 'recommendedRepetitions'] as const) {
    const value = input[key];

    if (!Number.isInteger(value) || value < 1) {
      errors[key] = 'Ingresá una cantidad entera mayor que cero.';
    } else if (value > 65535) {
      errors[key] = 'Revisá la cantidad de ' + (key === 'setCount' ? 'series.' : 'repeticiones.');
    }
  }

  const weight = input.recommendedWeightKg;

  if (weight !== null && (
    !Number.isFinite(weight) ||
    weight < 0 ||
    weight > 999999.99 ||
    Math.round(weight * 100) / 100 !== weight
  )) {
    errors.recommendedWeightKg = 'Ingresá un peso válido, con hasta dos decimales.';
  }

  if (input.restSeconds !== null && (
    !Number.isInteger(input.restSeconds) ||
    input.restSeconds < 0 ||
    input.restSeconds > 65535
  )) {
    errors.restSeconds = 'Revisá el tiempo de descanso.';
  }

  if (input.recommendedRir !== undefined && input.recommendedRir !== null && (
    !Number.isInteger(input.recommendedRir) ||
    input.recommendedRir < 0 ||
    input.recommendedRir > 65535
  )) {
    errors.recommendedRir = 'Ingresá un RIR válido, entero y mayor o igual que cero.';
  }

  return errors;
}

const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 4_294_967_295;

export function isExercise(value: unknown): value is Exercise {
  const keys = ['id', 'name', 'bodyPart', 'equipment', 'target', 'instructions'];

  return isRecordWithKeys(value, keys) &&
    isId(value.id) &&
    keys.slice(1).every(key => {
      const text = value[key];
      return typeof text === 'string' && text.trim().length > 0;
    });
}

export function isRoutineExercise(value: unknown, routineId: number): value is RoutineExercise {
  if (!isRecordWithKeys(value, [
    'id', 'routineId', 'exerciseId', 'exercise', 'setCount',
    'recommendedRepetitions', 'recommendedWeightKg', 'restSeconds', 'recommendedRir',
  ])) {
    return false;
  }

  if (!isId(value.id) ||
    value.routineId !== routineId ||
    !isExercise(value.exercise) ||
    value.exerciseId !== value.exercise.id ||
    typeof value.setCount !== 'number' ||
    typeof value.recommendedRepetitions !== 'number' ||
    (value.recommendedWeightKg !== null && typeof value.recommendedWeightKg !== 'number') ||
    (value.restSeconds !== null && typeof value.restSeconds !== 'number') ||
    (value.recommendedRir !== null && typeof value.recommendedRir !== 'number')
  ) {
    return false;
  }

  return Object.keys(getRoutineExerciseFieldErrors({
    setCount: value.setCount,
    recommendedRepetitions: value.recommendedRepetitions,
    recommendedWeightKg: value.recommendedWeightKg,
    restSeconds: value.restSeconds,
    recommendedRir: value.recommendedRir,
  })).length === 0;
}

function isExercisePage(value: unknown): value is ExercisePage {
  return isRecordWithKeys(value, ['items', 'total', 'bodyParts', 'equipment']) &&
    Array.isArray(value.items) &&
    value.items.length <= 20 &&
    value.items.every(isExercise) &&
    typeof value.total === 'number' &&
    Number.isSafeInteger(value.total) &&
    value.total >= value.items.length &&
    [value.bodyParts, value.equipment].every(list =>
      Array.isArray(list) && list.every(item => typeof item === 'string' && item.length > 0),
    );
}

function invalid(writing = false): never {
  throw new RoutineExerciseError('No se pudo confirmar el resultado: la respuesta del servidor no es válida.', 0, writing);
}

async function request(
  path: string,
  signal: AbortSignal,
  method = 'GET',
  body?: unknown,
): Promise<unknown> {
  const writing = method !== 'GET';
  let response: Response;

  try {
    response = await fetch('http://127.0.0.1:3000/users/' + path, {
      method,
      credentials: 'include',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    const message = writing
      ? 'No se pudo confirmar el guardado. Volvé al listado y revisalo antes de intentar otra vez.'
      : 'No se pudo consultar. Revisá la conexión.';

    throw new RoutineExerciseError(message, 0, writing);
  }

  if (!response.ok) {
    let message = 'No se pudo completar la operación. Intentá nuevamente.';

    switch (response.status) {
      case 400:
        message = 'Revisá los datos del ejercicio.';
        break;
      case 401:
        message = 'Tu sesión venció. Volvé a iniciar sesión.';
        break;
      case 403:
        message = 'No tenés permiso para acceder a estos ejercicios.';
        break;
      case 404:
        message = 'La rutina o el ejercicio ya no está disponible.';
        break;
    }

    throw new RoutineExerciseError(message, response.status, writing && response.status >= 500);
  }

  if (response.status !== (method === 'POST' ? 201 : 200)) {
    invalid(writing);
  }

  return response.json().catch(() => invalid(writing));
}

function routinePath(context: RoutineContext) {
  if (![context.studentId, context.planId, context.programId, context.routineId].every(isId)) {
    throw new RoutineExerciseError('Seleccioná una rutina válida.');
  }

  return `students/${context.studentId}/plans/${context.planId}/programs/${context.programId}/routines/${context.routineId}/exercises`;
}

export async function searchExercises(filters: ExerciseFilters, signal: AbortSignal): Promise<ExercisePage> {
  if ([filters.q, filters.bodyPart, filters.equipment].some(value =>
    typeof value !== 'string' || value.length > 100,
  ) ||
    !Number.isSafeInteger(filters.offset) ||
    filters.offset < 0 ||
    filters.offset > 4_294_967_295
  ) {
    throw new RoutineExerciseError('Revisá los filtros del catálogo.');
  }

  const query = new URLSearchParams({ ...filters, offset: String(filters.offset) });
  const value = await request('exercises?' + query, signal);

  if (!isExercisePage(value)) {
    invalid();
  }

  return value;
}

export async function getRoutineExercises(context: RoutineContext, signal: AbortSignal): Promise<RoutineExercise[]> {
  const value = await request(routinePath(context), signal);

  if (!Array.isArray(value) || !value.every(entry => isRoutineExercise(entry, context.routineId))) {
    invalid();
  }

  return value;
}

export async function saveRoutineExercise(
  context: RoutineContext,
  exerciseId: number,
  input: RoutineExerciseInput,
  signal: AbortSignal,
  entryId?: number,
): Promise<RoutineExercise> {
  if (!isId(exerciseId) ||
    (entryId !== undefined && !isId(entryId)) ||
    Object.keys(getRoutineExerciseFieldErrors(input)).length
  ) {
    throw new RoutineExerciseError('Revisá las indicaciones del ejercicio.');
  }

  const { setCount, recommendedRepetitions, recommendedWeightKg, restSeconds, recommendedRir } = input;
  // Omitir RIR conserva el valor anterior; enviarlo como null lo borra.
  const details = {
    setCount,
    recommendedRepetitions,
    recommendedWeightKg,
    restSeconds,
    ...(recommendedRir !== undefined ? { recommendedRir } : {}),
  };
  const path = routinePath(context) + (entryId === undefined ? '' : '/' + entryId);
  const method = entryId === undefined ? 'POST' : 'PUT';
  const body = entryId === undefined ? { exerciseId, ...details } : details;
  const value = await request(path, signal, method, body);

  if (!isRoutineExercise(value, context.routineId) ||
    value.exerciseId !== exerciseId ||
    (entryId !== undefined && value.id !== entryId) ||
    Object.keys(details).some(key =>
      value[key as keyof RoutineExerciseInput] !== details[key as keyof RoutineExerciseInput],
    )
  ) {
    invalid(true);
  }

  return value;
}

export function routineExerciseSummary(entry: RoutineExerciseInput): string {
  return `${entry.setCount} × ${entry.recommendedRepetitions}` +
    (entry.recommendedWeightKg === null
      ? ''
      : ` · ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(entry.recommendedWeightKg)} kg`);
}

export function formatRestTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function parseRestTime(value: string): number {
  const match = /^(\d+):([0-5]\d)$/.exec(value.trim());

  if (!match) {
    return NaN;
  }

  const seconds = Number(match[1]) * 60 + Number(match[2]);

  return Number.isSafeInteger(seconds) ? seconds : NaN;
}
