export interface TrainingRoutine {
  id?: number;
  programId: number;
  name: string;
  description: string | null;
}

export interface TrainingRoutineInput { name: string; description?: string | null; }
export type TrainingRoutineFieldErrors = Partial<Record<'name' | 'description', string>>;

export class InvalidTrainingRoutineError extends Error {
  constructor(readonly fieldErrors: TrainingRoutineFieldErrors) { super('Revisá los datos de la rutina.'); }
}

export class TrainingProgramNotFoundError extends Error {
  constructor() { super('El programa ya no está disponible.'); }
}

export class TrainingRoutineNotFoundError extends Error {
  constructor() { super('La rutina ya no está disponible.'); }
}

/** El nombre es libre; una descripción sin contenido se conserva como ausencia de valor. */
export function createTrainingRoutine(programId: number, input: TrainingRoutineInput): TrainingRoutine {
  const routine = { programId, name: input.name.trim(), description: input.description?.trim() || null };
  const errors: TrainingRoutineFieldErrors = {};
  if ([...routine.name].length < 1 || [...routine.name].length > 200) errors.name = 'Ingresá entre 1 y 200 caracteres.';
  if (routine.description && [...routine.description].length > 5000) errors.description = 'Ingresá hasta 5000 caracteres.';
  if (Object.keys(errors).length) throw new InvalidTrainingRoutineError(errors);
  return routine;
}
