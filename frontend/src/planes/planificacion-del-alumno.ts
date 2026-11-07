import { esPlan, type PlanDeEntrenamiento } from './planes.ts';
import { esRutina, type Rutina } from './rutinas.ts';
import { esEjercicioDeRutina, type EjercicioDeRutina } from './ejercicios-de-rutina.ts';
import { esRegistroConClaves } from '../validacion.ts';

export interface VistaDePlanificacion {
  plan: PlanDeEntrenamiento | null;
  rutinas: Rutina[];
}

export interface VistaDeRutinaDelAlumno {
  rutina: Rutina;
  ejercicios: EjercicioDeRutina[];
}

export class ErrorDePlanificacion extends Error {
  readonly estado: number;

  constructor(mensaje: string, estado = 0) {
    super(mensaje);
    this.estado = estado;
  }
}

const esIdentificador = (valor: number) => Number.isSafeInteger(valor) && valor > 0 && valor <= 4_294_967_295;

function respuestaInvalida(): never {
  throw new ErrorDePlanificacion('No se pudo consultar tu planificación: la respuesta del servidor no es válida.');
}

function esVistaDePlanificacion(valor: unknown, alumnoId: number): valor is VistaDePlanificacion {
  if (!esRegistroConClaves(valor, ['plan', 'rutinas']) || !Array.isArray(valor.rutinas)) {
    return false;
  }

  const { plan, rutinas } = valor;

  if (plan === null) {
    return rutinas.length === 0;
  }

  // Además de los tipos, la respuesta debe conservar la pertenencia entre sus elementos.
  return esPlan(plan, alumnoId) && rutinas.every(rutina => esRutina(rutina, plan.id));
}

function esVistaDeRutina(valor: unknown, rutinaId: number, planId: number): valor is VistaDeRutinaDelAlumno {
  return esRegistroConClaves(valor, ['rutina', 'ejercicios']) &&
    esRutina(valor.rutina, planId) &&
    valor.rutina.id === rutinaId &&
    Array.isArray(valor.ejercicios) &&
    valor.ejercicios.every(elemento => esEjercicioDeRutina(elemento, rutinaId));
}

async function pedir(ruta: string, senal: AbortSignal): Promise<unknown> {
  let respuesta: Response;

  try {
    respuesta = await fetch('http://127.0.0.1:3000/usuarios/mi-planificacion' + ruta, {
      method: 'GET',
      credentials: 'include',
      signal: AbortSignal.any([senal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new ErrorDePlanificacion('No se pudo consultar tu planificación. Revisá la conexión.');
  }

  if (!respuesta.ok) {
    let mensaje = 'No se pudo consultar tu planificación. Intentá nuevamente.';

    switch (respuesta.status) {
      case 400:
        mensaje = 'Seleccioná una rutina válida.';
        break;
      case 401:
        mensaje = 'Tu sesión venció. Volvé a iniciar sesión.';
        break;
      case 403:
        mensaje = 'No tenés permiso para consultar esta planificación.';
        break;
      case 404:
        mensaje = 'La rutina ya no está disponible.';
        break;
      case 503:
        mensaje = 'No se pudo recuperar tu sesión. Intentá nuevamente.';
        break;
    }

    throw new ErrorDePlanificacion(mensaje, respuesta.status);
  }

  if (respuesta.status !== 200) {
    respuestaInvalida();
  }

  return respuesta.json().catch(() => respuestaInvalida());
}

export async function consultarPlanificacion(alumnoId: number, senal: AbortSignal): Promise<VistaDePlanificacion> {
  if (!esIdentificador(alumnoId)) {
    throw new ErrorDePlanificacion('Tu sesión no es válida. Volvé a iniciar sesión.');
  }

  const valor = await pedir('', senal);

  if (!esVistaDePlanificacion(valor, alumnoId)) {
    respuestaInvalida();
  }

  return valor;
}

export async function consultarRutinaDelAlumno(
  rutinaId: number,
  planId: number,
  senal: AbortSignal,
): Promise<VistaDeRutinaDelAlumno> {
  if (!esIdentificador(rutinaId) || !esIdentificador(planId)) {
    throw new ErrorDePlanificacion('Seleccioná una rutina válida.', 400);
  }

  const valor = await pedir('/rutinas/' + rutinaId, senal);

  if (!esVistaDeRutina(valor, rutinaId, planId)) {
    respuestaInvalida();
  }

  return valor;
}
