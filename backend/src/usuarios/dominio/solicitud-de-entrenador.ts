export type EstadoDeSolicitud = 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada';

export interface SolicitudDeEntrenador {
  id?: number;
  alumnoId: number;
  entrenadorId: number;
  estado: EstadoDeSolicitud;
}

export interface Vinculacion {
  alumnoId: number;
  entrenadorId: number;
}

export class SolicitudEnConflictoError extends Error {}
export class SolicitudNoEncontradaError extends Error {}
export class SolicitudSinPermisoError extends Error {}

/** Una solicitud pendiente y una vinculación vigente impiden iniciar otra solicitud. */
export function crearSolicitudDeEntrenador(
  alumnoId: number, entrenadorId: number, vinculacion: Vinculacion | null, pendiente: SolicitudDeEntrenador | null,
): SolicitudDeEntrenador {
  if (vinculacion) throw new SolicitudEnConflictoError('Ya tenés un entrenador asignado.');
  if (pendiente) throw new SolicitudEnConflictoError('Ya tenés una solicitud pendiente.');
  return { alumnoId, entrenadorId, estado: 'pendiente' };
}

/** La autorización depende de la participación, además del rol comprobado por HTTP. */
export function responderSolicitudDeEntrenador(
  solicitud: SolicitudDeEntrenador, actorId: number, estado: Exclude<EstadoDeSolicitud, 'pendiente'>,
): SolicitudDeEntrenador {
  const permitido = actorId === solicitud.entrenadorId || (estado === 'cancelada' && actorId === solicitud.alumnoId);
  if (!permitido) throw new SolicitudSinPermisoError('No tenés permiso para responder esta solicitud.');
  if (solicitud.estado !== 'pendiente') throw new SolicitudEnConflictoError('La solicitud ya no está pendiente.');
  return { ...solicitud, estado };
}
