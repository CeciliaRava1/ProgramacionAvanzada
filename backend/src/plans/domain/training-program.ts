export interface TrainingProgram {
  id?: number;
  planId: number;
  name: string;
  startDate: string;
  endDate: string;
}

export type TrainingProgramInput = Pick<TrainingProgram, 'name' | 'startDate' | 'endDate'>;
export type TrainingProgramFieldErrors = Partial<Record<keyof TrainingProgramInput, string>>;

export class InvalidTrainingProgramError extends Error {
  constructor(readonly fieldErrors: TrainingProgramFieldErrors) { super('Revisá los datos del programa.'); }
}

export class TrainingProgramAlreadyExistsError extends Error {
  constructor() { super('El plan ya tiene un programa.'); }
}

function isDate(value: string): boolean {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Las fechas describen el período; por ahora no controlan la activación. */
export function createTrainingProgram(planId: number, input: TrainingProgramInput): TrainingProgram {
  const program = { planId, name: input.name.trim(), startDate: input.startDate, endDate: input.endDate };
  const errors: TrainingProgramFieldErrors = {};
  if ([...program.name].length < 1 || [...program.name].length > 200) errors.name = 'Ingresá entre 1 y 200 caracteres.';
  if (!isDate(program.startDate)) errors.startDate = 'Ingresá una fecha de inicio válida.';
  if (!isDate(program.endDate)) errors.endDate = 'Ingresá una fecha de fin válida.';
  if (!errors.startDate && !errors.endDate && program.endDate < program.startDate) errors.endDate = 'La fecha de fin no puede ser anterior a la de inicio.';
  if (Object.keys(errors).length) throw new InvalidTrainingProgramError(errors);
  return program;
}
