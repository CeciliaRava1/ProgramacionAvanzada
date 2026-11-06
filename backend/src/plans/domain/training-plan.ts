export interface TrainingPlan {
  id?: number;
  studentId: number;
  name: string;
  objective: string;
}

export class TrainingPlanAlreadyExistsError extends Error {
  constructor() { super('El alumno ya tiene un plan.'); }
}

export class TrainingPlanNotFoundError extends Error {
  constructor() { super('El plan ya no está disponible.'); }
}

export class InvalidTrainingPlanError extends Error {
  constructor(readonly fieldErrors: Partial<Record<'name' | 'objective', string>>) {
    super('Revisá los datos del plan.');
  }
}

/** Solo normaliza texto; los objetivos no pertenecen a categorías cerradas. */
export function createTrainingPlan(studentId: number, name: string, objective: string): TrainingPlan {
  const plan = { studentId, name: name.trim(), objective: objective.trim() };
  const fieldErrors: Partial<Record<'name' | 'objective', string>> = {};
  if ([...plan.name].length < 1 || [...plan.name].length > 200) fieldErrors.name = 'Ingresá entre 1 y 200 caracteres.';
  if ([...plan.objective].length < 1 || [...plan.objective].length > 5000) fieldErrors.objective = 'Ingresá entre 1 y 5000 caracteres.';
  if (Object.keys(fieldErrors).length) throw new InvalidTrainingPlanError(fieldErrors);
  return plan;
}
