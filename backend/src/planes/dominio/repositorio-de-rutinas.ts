import type { Rutina, RutinaGuardada } from './rutina.js';

export abstract class RepositorioDeRutinas {
  abstract guardar(rutina: Rutina): Promise<RutinaGuardada>;
  abstract buscarPorPlan(planId: number): Promise<RutinaGuardada[]>;
  abstract modificar(id: number, planId: number, datos: Pick<Rutina, 'nombre' | 'descripcion'>): Promise<RutinaGuardada | null>;
}
