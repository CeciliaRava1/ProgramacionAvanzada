import { esResumenDeEntrenador, type ResumenDeEntrenador } from './entrenadores.ts';

export type EstadoDelAlumno =
  | { estado: 'sin_asignar' }
  | { estado: 'pendiente'; solicitudId: number; entrenador: ResumenDeEntrenador }
  | { estado: 'asignado'; entrenador: ResumenDeEntrenador };

export interface SolicitudRecibida {
  id: number;
  alumno: { id: number; nombre: string; apellido: string };
}

export type AccionSobreSolicitud = 'aceptar' | 'rechazar' | 'cancelar';

export class ErrorDeSolicitud extends Error {
  readonly estado: number;
  constructor(mensaje: string, estado = 0) { super(mensaje); this.estado = estado; }
}

function esIdentificador(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0;
}

function esObjetoConClaves(valor: unknown, claves: string[]): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) &&
    Object.keys(valor).length === claves.length && Object.keys(valor).every((clave) => claves.includes(clave));
}

function respuestaInvalida(): never {
  throw new ErrorDeSolicitud('No se pudo confirmar el resultado: la respuesta del servidor no es válida.');
}

/** Centraliza cookies y errores de estas operaciones; nunca muestra mensajes internos del servidor. */
async function pedir(ruta: string, metodo: string, senal: AbortSignal, estadoEsperado: number, cuerpo?: unknown): Promise<unknown> {
  let respuesta: Response;
  try {
    respuesta = await fetch('http://127.0.0.1:3000/usuarios/solicitudes-de-entrenador' + ruta, {
      method: metodo, credentials: 'include',
      ...(cuerpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }),
      signal: AbortSignal.any([senal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new ErrorDeSolicitud(metodo === 'GET' ? 'No se pudo consultar el estado. Revisá la conexión.' :
      'No se pudo confirmar la operación. Actualizá el estado antes de reintentar.');
  }
  if (!respuesta.ok) {
    throw new ErrorDeSolicitud(
      respuesta.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
        respuesta.status === 403 ? 'No tenés permiso para realizar esta operación.' :
          respuesta.status === 404 ? 'El entrenador o la solicitud ya no están disponibles.' :
            respuesta.status === 409 ? 'El estado cambió. Actualizá para ver la solicitud o el entrenador vigente.' :
              respuesta.status === 400 ? 'Revisá el entrenador seleccionado.' : 'No se pudo completar la operación. Intentá nuevamente.',
      respuesta.status,
    );
  }
  if (respuesta.status !== estadoEsperado) respuestaInvalida();
  return estadoEsperado === 204 ? undefined : respuesta.json().catch(() => respuestaInvalida());
}

export async function obtenerEstadoDelAlumno(senal: AbortSignal): Promise<EstadoDelAlumno> {
  const cuerpo = await pedir('/actual', 'GET', senal, 200);
  if (esObjetoConClaves(cuerpo, ['estado']) && cuerpo.estado === 'sin_asignar') return { estado: 'sin_asignar' };
  if (esObjetoConClaves(cuerpo, ['estado', 'entrenador']) && cuerpo.estado === 'asignado' && esResumenDeEntrenador(cuerpo.entrenador)) {
    return { estado: 'asignado', entrenador: cuerpo.entrenador };
  }
  if (esObjetoConClaves(cuerpo, ['estado', 'solicitudId', 'entrenador']) && cuerpo.estado === 'pendiente' && esIdentificador(cuerpo.solicitudId) && esResumenDeEntrenador(cuerpo.entrenador)) {
    return { estado: 'pendiente', solicitudId: cuerpo.solicitudId, entrenador: cuerpo.entrenador };
  }
  return respuestaInvalida();
}

export async function obtenerSolicitudesRecibidas(senal: AbortSignal): Promise<SolicitudRecibida[]> {
  const cuerpo = await pedir('', 'GET', senal, 200);
  if (!Array.isArray(cuerpo) || cuerpo.some((elemento: unknown) => {
    if (!esObjetoConClaves(elemento, ['id', 'alumno']) || !esIdentificador(elemento.id) || !esObjetoConClaves(elemento.alumno, ['id', 'nombre', 'apellido'])) return true;
    const alumno = elemento.alumno;
    return !esIdentificador(alumno.id) || typeof alumno.nombre !== 'string' || [...alumno.nombre.trim()].length < 1 || [...alumno.nombre].length > 100 ||
      typeof alumno.apellido !== 'string' || [...alumno.apellido.trim()].length < 1 || [...alumno.apellido].length > 100;
  })) return respuestaInvalida();
  return cuerpo as SolicitudRecibida[];
}

export async function enviarSolicitud(entrenadorId: number, senal: AbortSignal): Promise<void> {
  if (!esIdentificador(entrenadorId)) throw new ErrorDeSolicitud('Seleccioná un entrenador válido.');
  const cuerpo = await pedir('', 'POST', senal, 201, { entrenadorId });
  if (!esObjetoConClaves(cuerpo, ['id', 'entrenadorId', 'estado']) || !esIdentificador(cuerpo.id) || cuerpo.entrenadorId !== entrenadorId || cuerpo.estado !== 'pendiente') respuestaInvalida();
}

export async function responderSolicitud(id: number, accion: AccionSobreSolicitud, senal: AbortSignal): Promise<void> {
  if (!esIdentificador(id)) throw new ErrorDeSolicitud('Seleccioná una solicitud válida.');
  await pedir(`/${id}${accion === 'cancelar' ? '' : '/' + accion}`, accion === 'cancelar' ? 'DELETE' : 'POST', senal, 204);
}
