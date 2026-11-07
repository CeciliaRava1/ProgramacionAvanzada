import type { DatosDePlan, PlanDeEntrenamiento, PlanGuardado } from './plan-de-entrenamiento.js';

export abstract class RepositorioDePlanes {
  abstract guardar(plan: PlanDeEntrenamiento): Promise<PlanGuardado>;
  abstract buscarPorAlumno(alumnoId: number): Promise<PlanGuardado[]>;
  abstract modificar(id: number, alumnoId: number, datos: DatosDePlan): Promise<PlanGuardado | null>;
  abstract eliminar(id: number, alumnoId: number): Promise<boolean>;
}
