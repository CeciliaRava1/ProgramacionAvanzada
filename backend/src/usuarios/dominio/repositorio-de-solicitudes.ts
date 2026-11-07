import type { SolicitudDeEntrenador, Vinculacion } from './solicitud-de-entrenador.js';

export type SolicitudGuardada = SolicitudDeEntrenador & { id: number };
export interface SolicitudRecibida extends SolicitudGuardada {
  nombre: string;
  apellido: string;
}

export interface AlumnoAsignado {
  id: number;
  nombre: string;
  apellido: string;
}

export interface TransaccionDeSolicitudes {
  buscarPendiente(): Promise<SolicitudGuardada | null>;
  buscarVinculacion(): Promise<Vinculacion | null>;
  buscarSolicitud(id: number): Promise<SolicitudGuardada | null>;
  guardarSolicitud(solicitud: SolicitudDeEntrenador): Promise<SolicitudGuardada>;
  guardarVinculacion(vinculacion: Vinculacion): Promise<void>;
}

export abstract class RepositorioDeSolicitudes {
  abstract buscarPorId(id: number): Promise<SolicitudGuardada | null>;
  abstract buscarPendientesDelEntrenador(entrenadorId: number): Promise<SolicitudRecibida[]>;
  abstract buscarAlumnosAsignados(entrenadorId: number): Promise<AlumnoAsignado[]>;
  abstract buscarVinculacion(alumnoId: number): Promise<Vinculacion | null>;
  // El bloqueo por alumno mantiene juntas las validaciones y escrituras de cada operación.
  abstract conAlumno<T>(alumnoId: number, accion: (transaccion: TransaccionDeSolicitudes) => Promise<T>): Promise<T>;
}
