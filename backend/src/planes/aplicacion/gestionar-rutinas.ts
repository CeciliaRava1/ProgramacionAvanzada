import { GestionarPlanes } from './gestionar-planes.js';
import { PlanNoEncontradoError } from '../dominio/plan-de-entrenamiento.js';
import { RepositorioDeRutinas } from '../dominio/repositorio-de-rutinas.js';
import { crearRutina, RutinaNoEncontradaError, type DatosDeRutina, type RutinaGuardada } from '../dominio/rutina.js';

function rutinaPublica({ id, planId, nombre, descripcion }: RutinaGuardada): RutinaGuardada {
  return { id, planId, nombre, descripcion };
}

/** Las rutinas (los días de entrenamiento) cuelgan directamente del plan. */
export class GestionarRutinas {
  constructor(private readonly rutinas: RepositorioDeRutinas, private readonly planes: GestionarPlanes) {}

  async listar(entrenadorId: number, alumnoId: number, planId: number): Promise<RutinaGuardada[]> {
    await this.autorizar(entrenadorId, alumnoId, planId);
    return (await this.rutinas.buscarPorPlan(planId)).map(rutinaPublica);
  }

  async crear(entrenadorId: number, alumnoId: number, planId: number, datos: DatosDeRutina): Promise<RutinaGuardada> {
    await this.autorizar(entrenadorId, alumnoId, planId);
    return rutinaPublica(await this.rutinas.guardar(crearRutina(planId, datos)));
  }

  async modificar(entrenadorId: number, alumnoId: number, planId: number, id: number, datos: DatosDeRutina): Promise<RutinaGuardada> {
    await this.autorizar(entrenadorId, alumnoId, planId);
    const { nombre, descripcion } = crearRutina(planId, datos);
    const guardada = await this.rutinas.modificar(id, planId, { nombre, descripcion });
    if (!guardada) throw new RutinaNoEncontradaError();
    return rutinaPublica(guardada);
  }

  private async autorizar(entrenadorId: number, alumnoId: number, planId: number): Promise<void> {
    if (!(await this.planes.listar(entrenadorId, alumnoId)).some((plan) => plan.id === planId)) throw new PlanNoEncontradoError();
  }
}
