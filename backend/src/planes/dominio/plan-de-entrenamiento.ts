export interface PlanDeEntrenamiento {
  id?: number;
  alumnoId: number;
  nombre: string;
  objetivo: string;
}

export type PlanGuardado = PlanDeEntrenamiento & { id: number };
export type DatosDePlan = Pick<PlanDeEntrenamiento, 'nombre' | 'objetivo'>;
export type ErroresDeCampoDePlan = Partial<Record<keyof DatosDePlan, string>>;

export class PlanYaExisteError extends Error {
  constructor() { super('El alumno ya tiene un plan.'); }
}

export class PlanNoEncontradoError extends Error {
  constructor() { super('El plan ya no está disponible.'); }
}

export class DatosDePlanInvalidosError extends Error {
  constructor(readonly erroresDeCampo: ErroresDeCampoDePlan) {
    super('Revisá los datos del plan.');
  }
}

/** Solo normaliza texto; los objetivos no pertenecen a categorías cerradas. */
export function crearPlanDeEntrenamiento(alumnoId: number, nombre: string, objetivo: string): PlanDeEntrenamiento {
  const plan = { alumnoId, nombre: nombre.trim(), objetivo: objetivo.trim() };
  const errores: ErroresDeCampoDePlan = {};
  if ([...plan.nombre].length < 1 || [...plan.nombre].length > 200) errores.nombre = 'Ingresá entre 1 y 200 caracteres.';
  if ([...plan.objetivo].length < 1 || [...plan.objetivo].length > 5000) errores.objetivo = 'Ingresá entre 1 y 5000 caracteres.';
  if (Object.keys(errores).length) throw new DatosDePlanInvalidosError(errores);
  return plan;
}
