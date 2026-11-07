export interface PlanDeEntrenamiento {
  id: number;
  alumnoId: number;
  nombre: string;
  objetivo: string;
}

export interface DatosDePlan { nombre: string; objetivo: string; }
export type ErroresDePlan = Partial<Record<keyof DatosDePlan, string>>;

export class ErrorDePlan extends Error {
  readonly estado: number;
  constructor(mensaje: string, estado = 0) { super(mensaje); this.estado = estado; }
}

export function obtenerErroresDePlan(datos: DatosDePlan): ErroresDePlan {
  const errores: ErroresDePlan = {};
  if ([...datos.nombre.trim()].length < 1 || [...datos.nombre.trim()].length > 200) errores.nombre = 'Ingresá entre 1 y 200 caracteres.';
  if ([...datos.objetivo.trim()].length < 1 || [...datos.objetivo.trim()].length > 5000) errores.objetivo = 'Ingresá entre 1 y 5000 caracteres.';
  return errores;
}

function esIdentificador(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 && valor <= 4_294_967_295;
}

export function esPlan(valor: unknown, alumnoId: number): valor is PlanDeEntrenamiento {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return false;
  const plan = valor as Record<string, unknown>;
  return Object.keys(plan).length === 4 && Object.keys(plan).every((clave) => ['id', 'alumnoId', 'nombre', 'objetivo'].includes(clave)) &&
    esIdentificador(plan.id) && plan.alumnoId === alumnoId && typeof plan.nombre === 'string' && typeof plan.objetivo === 'string' &&
    Object.keys(obtenerErroresDePlan({ nombre: plan.nombre, objetivo: plan.objetivo })).length === 0;
}

function respuestaInvalida(): never {
  throw new ErrorDePlan('No se pudo confirmar el resultado: la respuesta del servidor no es válida.');
}

/** Comparte cookies y mensajes conocidos; nunca presenta errores internos del servidor. */
async function pedir(alumnoId: number, senal: AbortSignal, metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', datos?: DatosDePlan, planId?: number): Promise<unknown> {
  if (!esIdentificador(alumnoId)) throw new ErrorDePlan('Seleccioná un alumno válido.');
  if ((metodo === 'PUT' || metodo === 'DELETE') && !esIdentificador(planId)) throw new ErrorDePlan('Seleccioná un plan válido.');
  let respuesta: Response;
  try {
    respuesta = await fetch(`http://127.0.0.1:3000/usuarios/alumnos/${alumnoId}/planes${planId === undefined ? '' : '/' + planId}`, {
      credentials: 'include', method: metodo,
      ...(datos ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: datos.nombre, objetivo: datos.objetivo }) } : {}),
      signal: AbortSignal.any([senal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new ErrorDePlan(metodo === 'GET' ? 'No se pudieron consultar los planes. Revisá la conexión.' :
      `No se pudo confirmar la ${metodo === 'POST' ? 'creación' : metodo === 'PUT' ? 'modificación' : 'eliminación'}. Se volverá a consultar el plan antes de reintentar.`);
  }
  if (!respuesta.ok) throw new ErrorDePlan(
    respuesta.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
      respuesta.status === 403 ? 'No tenés permiso para acceder a los planes de este alumno.' :
        respuesta.status === 404 ? 'El plan ya no está disponible.' :
          respuesta.status === 409 ? 'El alumno ya tiene un plan.' :
            respuesta.status === 400 ? 'Revisá el nombre, el objetivo y el alumno seleccionado.' :
              'No se pudo completar la operación con los planes. Intentá nuevamente.', respuesta.status,
  );
  if (respuesta.status !== (metodo === 'POST' ? 201 : metodo === 'DELETE' ? 204 : 200)) respuestaInvalida();
  if (metodo === 'DELETE') return undefined;
  return respuesta.json().catch(() => respuestaInvalida());
}

export async function consultarPlanes(alumnoId: number, senal: AbortSignal): Promise<PlanDeEntrenamiento[]> {
  const cuerpo = await pedir(alumnoId, senal, 'GET');
  if (!Array.isArray(cuerpo) || cuerpo.length > 1 || cuerpo.some((plan) => !esPlan(plan, alumnoId))) respuestaInvalida();
  return cuerpo as PlanDeEntrenamiento[];
}

export async function crearPlan(alumnoId: number, datos: DatosDePlan, senal: AbortSignal): Promise<PlanDeEntrenamiento> {
  if (Object.keys(obtenerErroresDePlan(datos)).length) throw new ErrorDePlan('Revisá los datos del plan.');
  const cuerpo = await pedir(alumnoId, senal, 'POST', datos);
  if (!esPlan(cuerpo, alumnoId) || cuerpo.nombre !== datos.nombre.trim() || cuerpo.objetivo !== datos.objetivo.trim()) respuestaInvalida();
  return cuerpo;
}

export async function modificarPlan(alumnoId: number, planId: number, datos: DatosDePlan, senal: AbortSignal): Promise<PlanDeEntrenamiento> {
  if (Object.keys(obtenerErroresDePlan(datos)).length) throw new ErrorDePlan('Revisá los datos del plan.');
  const cuerpo = await pedir(alumnoId, senal, 'PUT', datos, planId);
  if (!esPlan(cuerpo, alumnoId) || cuerpo.id !== planId || cuerpo.nombre !== datos.nombre.trim() || cuerpo.objetivo !== datos.objetivo.trim()) respuestaInvalida();
  return cuerpo;
}

export async function eliminarPlan(alumnoId: number, planId: number, senal: AbortSignal): Promise<void> {
  await pedir(alumnoId, senal, 'DELETE', undefined, planId);
}
