import {
  crearSolicitudDeEntrenador, responderSolicitudDeEntrenador, SolicitudEnConflictoError, SolicitudNoEncontradaError,
  type EstadoDeSolicitud,
} from '../dominio/solicitud-de-entrenador.js';
import { RepositorioDeSolicitudes } from '../dominio/repositorio-de-solicitudes.js';
import { RepositorioDeUsuarios } from '../dominio/repositorio-de-usuarios.js';
import type { ResumenDeEntrenador } from './listar-entrenadores.js';

export type EstadoDelAlumno =
  | { estado: 'sin_asignar' }
  | { estado: 'pendiente'; solicitudId: number; entrenador: ResumenDeEntrenador }
  | { estado: 'asignado'; entrenador: ResumenDeEntrenador };

export class SolicitudesDeEntrenador {
  constructor(private readonly usuarios: RepositorioDeUsuarios, private readonly solicitudes: RepositorioDeSolicitudes) {}

  async enviar(alumnoId: number, entrenadorId: number) {
    await this.resumenDelEntrenador(entrenadorId);
    return this.solicitudes.conAlumno(alumnoId, async (transaccion) => {
      const vinculacion = await transaccion.buscarVinculacion();
      const pendiente = await transaccion.buscarPendiente();
      const guardada = await transaccion.guardarSolicitud(crearSolicitudDeEntrenador(alumnoId, entrenadorId, vinculacion, pendiente));
      return { id: guardada.id, entrenadorId: guardada.entrenadorId, estado: guardada.estado };
    });
  }

  async actual(alumnoId: number): Promise<EstadoDelAlumno> {
    const conexion = await this.solicitudes.conAlumno(alumnoId, async (transaccion) => {
      const vinculacion = await transaccion.buscarVinculacion();
      if (vinculacion) return { estado: 'asignado' as const, entrenadorId: vinculacion.entrenadorId };
      const pendiente = await transaccion.buscarPendiente();
      return pendiente ? { estado: 'pendiente' as const, entrenadorId: pendiente.entrenadorId, solicitudId: pendiente.id } : null;
    });
    if (!conexion) return { estado: 'sin_asignar' };
    const entrenador = await this.resumenDelEntrenador(conexion.entrenadorId);
    return conexion.estado === 'asignado'
      ? { estado: 'asignado', entrenador }
      : { estado: 'pendiente', solicitudId: conexion.solicitudId, entrenador };
  }

  async recibidas(entrenadorId: number) {
    const solicitudes = await this.solicitudes.buscarPendientesDelEntrenador(entrenadorId);
    return solicitudes.map(({ id, alumnoId, nombre, apellido }) => ({ id, alumno: { id: alumnoId, nombre, apellido } }));
  }

  async responder(id: number, actorId: number, estado: Exclude<EstadoDeSolicitud, 'pendiente'>): Promise<void> {
    const original = await this.solicitudes.buscarPorId(id);
    if (!original) throw new SolicitudNoEncontradaError('La solicitud no existe.');
    await this.solicitudes.conAlumno(original.alumnoId, async (transaccion) => {
      const solicitud = await transaccion.buscarSolicitud(id);
      if (!solicitud) throw new SolicitudNoEncontradaError('La solicitud no existe.');
      const actualizada = responderSolicitudDeEntrenador(solicitud, actorId, estado);
      if (estado === 'aceptada') {
        if (await transaccion.buscarVinculacion()) throw new SolicitudEnConflictoError('El alumno ya tiene un entrenador asignado.');
        await transaccion.guardarVinculacion({ alumnoId: solicitud.alumnoId, entrenadorId: solicitud.entrenadorId });
      }
      await transaccion.guardarSolicitud(actualizada);
    });
  }

  private async resumenDelEntrenador(id: number): Promise<ResumenDeEntrenador> {
    const entrenador = await this.usuarios.buscarPorId(id);
    if (!entrenador?.id || entrenador.rol !== 'entrenador' || entrenador.fechaBaja) throw new SolicitudNoEncontradaError('El entrenador no existe.');
    return { id: entrenador.id, nombre: entrenador.nombre, apellido: entrenador.apellido, horario: entrenador.horario ?? [] };
  }
}
