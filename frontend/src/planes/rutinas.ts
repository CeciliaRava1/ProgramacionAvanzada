export interface Rutina { id: number; planId: number; nombre: string; descripcion: string | null; }
export interface DatosDeRutina { nombre: string; descripcion?: string | null; }
export type ErroresDeRutina = Partial<Record<'nombre' | 'descripcion', string>>;

export class ErrorDeRutina extends Error {
  readonly estado: number;
  constructor(mensaje: string, estado = 0) { super(mensaje); this.estado = estado; }
}

export function obtenerErroresDeRutina(datos: DatosDeRutina): ErroresDeRutina {
  const errores: ErroresDeRutina = {};
  if ([...datos.nombre.trim()].length < 1 || [...datos.nombre.trim()].length > 200) errores.nombre = 'Ingresá entre 1 y 200 caracteres.';
  if ([...(datos.descripcion?.trim() || '')].length > 5000) errores.descripcion = 'Ingresá hasta 5000 caracteres.';
  return errores;
}

function esIdentificador(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 && valor <= 4_294_967_295;
}

export function esRutina(valor: unknown, planId: number): valor is Rutina {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return false;
  const rutina = valor as Record<string, unknown>;
  return Object.keys(rutina).length === 4 && Object.keys(rutina).every((clave) => ['id', 'planId', 'nombre', 'descripcion'].includes(clave)) &&
    esIdentificador(rutina.id) && rutina.planId === planId && typeof rutina.nombre === 'string' && (rutina.descripcion === null || typeof rutina.descripcion === 'string') &&
    Object.keys(obtenerErroresDeRutina({ nombre: rutina.nombre, descripcion: rutina.descripcion })).length === 0;
}

function respuestaInvalida(): never { throw new ErrorDeRutina('No se pudo confirmar el resultado: la respuesta del servidor no es válida.'); }

async function pedir(alumnoId: number, planId: number, senal: AbortSignal, datos?: DatosDeRutina, rutinaId?: number): Promise<unknown> {
  if (![alumnoId, planId].every(esIdentificador)) throw new ErrorDeRutina('Seleccioná un alumno y un plan válidos.');
  let respuesta: Response;
  try {
    respuesta = await fetch(`http://127.0.0.1:3000/usuarios/alumnos/${alumnoId}/planes/${planId}/rutinas${rutinaId === undefined ? '' : '/' + rutinaId}`, {
      credentials: 'include', method: rutinaId !== undefined ? 'PUT' : datos ? 'POST' : 'GET',
      ...(datos ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: datos.nombre, descripcion: datos.descripcion?.trim() || null }) } : {}),
      signal: AbortSignal.any([senal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new ErrorDeRutina(datos ? `No se pudo confirmar la ${rutinaId === undefined ? 'creación' : 'modificación'}. Se volverá a consultar el listado; revisalo antes de volver a guardar.` : 'No se pudieron consultar las rutinas. Revisá la conexión.');
  }
  if (!respuesta.ok) throw new ErrorDeRutina(
    respuesta.status === 400 ? 'Revisá el nombre y la descripción de la rutina.' :
      respuesta.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
        respuesta.status === 403 ? 'No tenés permiso para acceder a las rutinas de este alumno.' :
          respuesta.status === 404 ? 'El plan o la rutina ya no está disponible.' : 'No se pudo completar la operación con las rutinas. Intentá nuevamente.', respuesta.status,
  );
  if (respuesta.status !== (datos && rutinaId === undefined ? 201 : 200)) respuestaInvalida();
  return respuesta.json().catch(() => respuestaInvalida());
}

export async function consultarRutinas(alumnoId: number, planId: number, senal: AbortSignal): Promise<Rutina[]> {
  const cuerpo = await pedir(alumnoId, planId, senal);
  if (!Array.isArray(cuerpo) || cuerpo.some((rutina) => !esRutina(rutina, planId))) respuestaInvalida();
  return cuerpo as Rutina[];
}

export async function crearRutina(alumnoId: number, planId: number, datos: DatosDeRutina, senal: AbortSignal): Promise<Rutina> {
  if (Object.keys(obtenerErroresDeRutina(datos)).length) throw new ErrorDeRutina('Revisá los datos de la rutina.');
  const cuerpo = await pedir(alumnoId, planId, senal, datos);
  if (!esRutina(cuerpo, planId) || cuerpo.nombre !== datos.nombre.trim() || cuerpo.descripcion !== (datos.descripcion?.trim() || null)) respuestaInvalida();
  return cuerpo;
}

export async function modificarRutina(alumnoId: number, planId: number, rutinaId: number, datos: DatosDeRutina, senal: AbortSignal): Promise<Rutina> {
  if (Object.keys(obtenerErroresDeRutina(datos)).length) throw new ErrorDeRutina('Revisá los datos de la rutina.');
  if (!esIdentificador(rutinaId)) throw new ErrorDeRutina('Seleccioná una rutina válida.');
  const cuerpo = await pedir(alumnoId, planId, senal, datos, rutinaId);
  if (!esRutina(cuerpo, planId) || cuerpo.id !== rutinaId || cuerpo.nombre !== datos.nombre.trim() || cuerpo.descripcion !== (datos.descripcion?.trim() || null)) respuestaInvalida();
  return cuerpo;
}
