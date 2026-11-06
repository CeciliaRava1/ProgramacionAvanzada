import type { PublicExercise } from './exercise.js';

export interface RoutineExerciseInput { setCount: number; recommendedRepetitions: number; recommendedWeightKg: number | null; restSeconds: number | null; recommendedRir?: number | null; }
export interface RoutineExercise extends RoutineExerciseInput { id: number; routineId: number; exerciseId: number; recommendedRir: number | null; }
export interface RoutineExerciseDetails extends RoutineExercise { exercise: PublicExercise; }
export type RoutineExerciseFieldErrors = Partial<Record<keyof RoutineExerciseInput, string>>;
export class InvalidRoutineExerciseError extends Error {
  constructor(readonly fieldErrors: RoutineExerciseFieldErrors) { super('Revisá las indicaciones del ejercicio.'); }
}

/** Los límites corresponden al almacenamiento; todas las series comparten estas indicaciones. */
export function validateRoutineExercise(input: RoutineExerciseInput): RoutineExerciseInput {
  const { setCount, recommendedRepetitions, recommendedWeightKg, restSeconds, recommendedRir } = input;
  const errors: RoutineExerciseFieldErrors = {};
  for (const key of ['setCount', 'recommendedRepetitions'] as const) {
    const value = input[key];
    if (!Number.isInteger(value) || value < 1) errors[key] = 'Ingresá una cantidad entera mayor que cero.';
    else if (value > 65535) errors[key] = 'Revisá la cantidad de ' + (key === 'setCount' ? 'series.' : 'repeticiones.');
  }
  if (recommendedWeightKg !== null && (!Number.isFinite(recommendedWeightKg) || recommendedWeightKg < 0 || recommendedWeightKg > 999999.99 || Math.round(recommendedWeightKg * 100) / 100 !== recommendedWeightKg)) errors.recommendedWeightKg = 'Ingresá un peso válido, con hasta dos decimales.';
  if (restSeconds !== null && (!Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 65535)) errors.restSeconds = 'Revisá el tiempo de descanso.';
  if (recommendedRir !== undefined && recommendedRir !== null && (!Number.isInteger(recommendedRir) || recommendedRir < 0 || recommendedRir > 65535)) errors.recommendedRir = 'Ingresá un RIR válido, entero y mayor o igual que cero.';
  if (Object.keys(errors).length) throw new InvalidRoutineExerciseError(errors);
  return { setCount, recommendedRepetitions, recommendedWeightKg, restSeconds, ...(recommendedRir !== undefined ? { recommendedRir } : {}) };
}
