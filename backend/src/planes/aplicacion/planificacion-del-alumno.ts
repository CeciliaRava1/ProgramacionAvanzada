import { RepositorioDePlanes } from '../dominio/repositorio-de-planes.js';
import type { PlanGuardado } from '../dominio/plan-de-entrenamiento.js';
import { RepositorioDeRutinas } from '../dominio/repositorio-de-rutinas.js';
import { RutinaNoEncontradaError, type RutinaGuardada } from '../dominio/rutina.js';
import { RepositorioDeEjerciciosDeRutina } from '../dominio/repositorio-de-ejercicios-de-rutina.js';

export interface VistaDePlanificacion {
  plan: PlanGuardado | null;
  rutinas: RutinaGuardada[];
}

/** La consulta propia depende de la identidad del alumno, no de un vínculo con un entrenador. */
export class PlanificacionDelAlumno {
  constructor(
    private readonly planes: RepositorioDePlanes,
    private readonly rutinas: RepositorioDeRutinas,
    private readonly ejerciciosDeRutina: RepositorioDeEjerciciosDeRutina,
  ) {}

  async obtener(alumnoId: number): Promise<VistaDePlanificacion> {
    const plan = (await this.planes.buscarPorAlumno(alumnoId))[0];
    if (!plan) return { plan: null, rutinas: [] };
    const { id, nombre, objetivo } = plan;
    return {
      plan: { id, alumnoId, nombre, objetivo },
      rutinas: (await this.rutinas.buscarPorPlan(id)).map(({ id: rutinaId, planId, nombre: nombreDeRutina, descripcion }) => ({ id: rutinaId, planId, nombre: nombreDeRutina, descripcion })),
    };
  }

  async obtenerRutina(alumnoId: number, rutinaId: number) {
    const planificacion = await this.obtener(alumnoId);
    const rutina = planificacion.rutinas.find((elemento) => elemento.id === rutinaId);
    if (!rutina) throw new RutinaNoEncontradaError();
    const ejercicios = (await this.ejerciciosDeRutina.listar(rutinaId)).map(({
      id, rutinaId: idDeRutina, ejercicioId, cantidadDeSeries, repeticionesRecomendadas, pesoRecomendadoKg, descansoEnSegundos, rirRecomendado, ejercicio,
    }) => ({
      id, rutinaId: idDeRutina, ejercicioId, cantidadDeSeries, repeticionesRecomendadas, pesoRecomendadoKg, descansoEnSegundos, rirRecomendado,
      ejercicio: {
        id: ejercicio.id, nombre: ejercicio.nombre, parteDelCuerpo: ejercicio.parteDelCuerpo, equipamiento: ejercicio.equipamiento,
        musculoObjetivo: ejercicio.musculoObjetivo, instrucciones: ejercicio.instrucciones,
      },
    }));
    return { rutina, ejercicios };
  }
}
