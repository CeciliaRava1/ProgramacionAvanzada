import { esListaDeTurnosValida, type Turno } from './turnos.ts';

export interface ResumenDeEntrenador {
  id: number;
  nombre: string;
  apellido: string;
  horario: Turno[];
}

export function esResumenDeEntrenador(valor: unknown): valor is ResumenDeEntrenador {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return false;
  const entrenador = valor as Record<string, unknown>;
  return Object.keys(entrenador).length === 4 && ['id', 'nombre', 'apellido', 'horario'].every((clave) => Object.hasOwn(entrenador, clave)) &&
    Number.isSafeInteger(entrenador.id) && Number(entrenador.id) > 0 &&
    typeof entrenador.nombre === 'string' && [...entrenador.nombre.trim()].length > 0 && [...entrenador.nombre].length <= 100 &&
    typeof entrenador.apellido === 'string' && [...entrenador.apellido.trim()].length > 0 && [...entrenador.apellido].length <= 100 &&
    esListaDeTurnosValida(entrenador.horario);
}

/** Consulta con la sesión y acepta únicamente los datos públicos del listado. */
export async function obtenerEntrenadores(senal: AbortSignal): Promise<ResumenDeEntrenador[]> {
  let respuesta: Response;
  try {
    respuesta = await fetch('http://127.0.0.1:3000/usuarios/entrenadores', {
      credentials: 'include',
      signal: AbortSignal.any([senal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new Error('No se pudo consultar el listado. Revisá la conexión e intentá nuevamente.');
  }
  if (!respuesta.ok) {
    throw new Error(respuesta.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
      respuesta.status === 403 ? 'No tenés permiso para consultar entrenadores.' : 'No se pudo consultar el listado. Intentá nuevamente.');
  }
  const cuerpo: unknown = await respuesta.json().catch(() => null);
  if (respuesta.status !== 200 || !Array.isArray(cuerpo) || cuerpo.some((elemento: unknown) => !esResumenDeEntrenador(elemento))) {
    throw new Error('No se pudo consultar el listado: la respuesta del servidor no es válida.');
  }
  return cuerpo as ResumenDeEntrenador[];
}
