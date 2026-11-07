import { RepositorioDeSolicitudes } from '../../usuarios/dominio/repositorio-de-solicitudes.js';
import {
  crearPlanDeEntrenamiento, PlanNoEncontradoError, PlanYaExisteError, type DatosDePlan, type PlanGuardado,
} from '../dominio/plan-de-entrenamiento.js';
import { RepositorioDePlanes } from '../dominio/repositorio-de-planes.js';

export class AccesoAPlanDenegadoError extends Error {}

function planPublico({ id, alumnoId, nombre, objetivo }: PlanGuardado): PlanGuardado {
  return { id, alumnoId, nombre, objetivo };
}

/** Planes de entrenamiento de un alumno; solo los gestiona el entrenador con quien está vinculado. */
export class GestionarPlanes {
  constructor(private readonly planes: RepositorioDePlanes, private readonly solicitudes: RepositorioDeSolicitudes) {}

  async crear(entrenadorId: number, alumnoId: number, datos: DatosDePlan): Promise<PlanGuardado> {
    await this.autorizar(entrenadorId, alumnoId);
    if ((await this.planes.buscarPorAlumno(alumnoId)).length) throw new PlanYaExisteError();
    return planPublico(await this.planes.guardar(crearPlanDeEntrenamiento(alumnoId, datos.nombre, datos.objetivo)));
  }

  async listar(entrenadorId: number, alumnoId: number): Promise<PlanGuardado[]> {
    await this.autorizar(entrenadorId, alumnoId);
    return (await this.planes.buscarPorAlumno(alumnoId)).map(planPublico);
  }

  async modificar(entrenadorId: number, alumnoId: number, id: number, datos: DatosDePlan): Promise<PlanGuardado> {
    await this.autorizar(entrenadorId, alumnoId);
    const { nombre, objetivo } = crearPlanDeEntrenamiento(alumnoId, datos.nombre, datos.objetivo);
    const guardado = await this.planes.modificar(id, alumnoId, { nombre, objetivo });
    if (!guardado) throw new PlanNoEncontradoError();
    return planPublico(guardado);
  }

  async eliminar(entrenadorId: number, alumnoId: number, id: number): Promise<void> {
    await this.autorizar(entrenadorId, alumnoId);
    if (!await this.planes.eliminar(id, alumnoId)) throw new PlanNoEncontradoError();
  }

  private async autorizar(entrenadorId: number, alumnoId: number): Promise<void> {
    const vinculacion = await this.solicitudes.buscarVinculacion(alumnoId);
    if (vinculacion?.entrenadorId !== entrenadorId) throw new AccesoAPlanDenegadoError('No tenés permiso para acceder a los planes de este alumno.');
  }
}
