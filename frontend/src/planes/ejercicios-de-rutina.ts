import { esRegistroConClaves } from '../validacion.ts';

export interface Ejercicio {
  id: number;
  nombre: string;
  parteDelCuerpo: string;
  equipamiento: string;
  musculoObjetivo: string;
  instrucciones: string;
}

export interface PaginaDeEjercicios {
  elementos: Ejercicio[];
  total: number;
  partesDelCuerpo: string[];
  equipamientos: string[];
}

export interface FiltrosDeEjercicios {
  q: string;
  parteDelCuerpo: string;
  equipamiento: string;
  desde: number;
}

export interface ContextoDeRutina {
  alumnoId: number;
  planId: number;
  rutinaId: number;
}

export interface DatosDeEjercicioDeRutina {
  cantidadDeSeries: number;
  repeticionesRecomendadas: number;
  pesoRecomendadoKg: number | null;
  descansoEnSegundos: number | null;
  rirRecomendado?: number | null;
}

export interface EjercicioDeRutina extends DatosDeEjercicioDeRutina {
  id: number;
  rutinaId: number;
  ejercicioId: number;
  ejercicio: Ejercicio;
  rirRecomendado: number | null;
}

export type ErroresDeEjercicioDeRutina = Partial<Record<keyof DatosDeEjercicioDeRutina, string>>;

export class ErrorDeEjercicioDeRutina extends Error {
  readonly estado: number;
  readonly incierto: boolean;

  constructor(mensaje: string, estado = 0, incierto = false) {
    super(mensaje);
    this.estado = estado;
    this.incierto = incierto;
  }
}

export function obtenerErroresDeEjercicioDeRutina(datos: DatosDeEjercicioDeRutina): ErroresDeEjercicioDeRutina {
  const errores: ErroresDeEjercicioDeRutina = {};

  for (const clave of ['cantidadDeSeries', 'repeticionesRecomendadas'] as const) {
    const valor = datos[clave];

    if (!Number.isInteger(valor) || valor < 1) {
      errores[clave] = 'Ingresá una cantidad entera mayor que cero.';
    } else if (valor > 65535) {
      errores[clave] = 'Revisá la cantidad de ' + (clave === 'cantidadDeSeries' ? 'series.' : 'repeticiones.');
    }
  }

  const peso = datos.pesoRecomendadoKg;

  if (peso !== null && (
    !Number.isFinite(peso) ||
    peso < 0 ||
    peso > 999999.99 ||
    Math.round(peso * 100) / 100 !== peso
  )) {
    errores.pesoRecomendadoKg = 'Ingresá un peso válido, con hasta dos decimales.';
  }

  if (datos.descansoEnSegundos !== null && (
    !Number.isInteger(datos.descansoEnSegundos) ||
    datos.descansoEnSegundos < 0 ||
    datos.descansoEnSegundos > 65535
  )) {
    errores.descansoEnSegundos = 'Revisá el tiempo de descanso.';
  }

  if (datos.rirRecomendado !== undefined && datos.rirRecomendado !== null && (
    !Number.isInteger(datos.rirRecomendado) ||
    datos.rirRecomendado < 0 ||
    datos.rirRecomendado > 65535
  )) {
    errores.rirRecomendado = 'Ingresá un RIR válido, entero y mayor o igual que cero.';
  }

  return errores;
}

const esIdentificador = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 && valor <= 4_294_967_295;

export function esEjercicio(valor: unknown): valor is Ejercicio {
  const claves = ['id', 'nombre', 'parteDelCuerpo', 'equipamiento', 'musculoObjetivo', 'instrucciones'];

  return esRegistroConClaves(valor, claves) &&
    esIdentificador(valor.id) &&
    claves.slice(1).every(clave => {
      const texto = valor[clave];
      return typeof texto === 'string' && texto.trim().length > 0;
    });
}

export function esEjercicioDeRutina(valor: unknown, rutinaId: number): valor is EjercicioDeRutina {
  if (!esRegistroConClaves(valor, [
    'id', 'rutinaId', 'ejercicioId', 'ejercicio', 'cantidadDeSeries',
    'repeticionesRecomendadas', 'pesoRecomendadoKg', 'descansoEnSegundos', 'rirRecomendado',
  ])) {
    return false;
  }

  if (!esIdentificador(valor.id) ||
    valor.rutinaId !== rutinaId ||
    !esEjercicio(valor.ejercicio) ||
    valor.ejercicioId !== valor.ejercicio.id ||
    typeof valor.cantidadDeSeries !== 'number' ||
    typeof valor.repeticionesRecomendadas !== 'number' ||
    (valor.pesoRecomendadoKg !== null && typeof valor.pesoRecomendadoKg !== 'number') ||
    (valor.descansoEnSegundos !== null && typeof valor.descansoEnSegundos !== 'number') ||
    (valor.rirRecomendado !== null && typeof valor.rirRecomendado !== 'number')
  ) {
    return false;
  }

  return Object.keys(obtenerErroresDeEjercicioDeRutina({
    cantidadDeSeries: valor.cantidadDeSeries,
    repeticionesRecomendadas: valor.repeticionesRecomendadas,
    pesoRecomendadoKg: valor.pesoRecomendadoKg,
    descansoEnSegundos: valor.descansoEnSegundos,
    rirRecomendado: valor.rirRecomendado,
  })).length === 0;
}

function esPaginaDeEjercicios(valor: unknown): valor is PaginaDeEjercicios {
  return esRegistroConClaves(valor, ['elementos', 'total', 'partesDelCuerpo', 'equipamientos']) &&
    Array.isArray(valor.elementos) &&
    valor.elementos.length <= 20 &&
    valor.elementos.every(esEjercicio) &&
    typeof valor.total === 'number' &&
    Number.isSafeInteger(valor.total) &&
    valor.total >= valor.elementos.length &&
    [valor.partesDelCuerpo, valor.equipamientos].every(lista =>
      Array.isArray(lista) && lista.every(elemento => typeof elemento === 'string' && elemento.length > 0),
    );
}

function respuestaInvalida(escribiendo = false): never {
  throw new ErrorDeEjercicioDeRutina('No se pudo confirmar el resultado: la respuesta del servidor no es válida.', 0, escribiendo);
}

async function pedir(
  ruta: string,
  senal: AbortSignal,
  metodo = 'GET',
  cuerpo?: unknown,
): Promise<unknown> {
  const escribiendo = metodo !== 'GET';
  let respuesta: Response;

  try {
    respuesta = await fetch('http://127.0.0.1:3000/usuarios/' + ruta, {
      method: metodo,
      credentials: 'include',
      signal: AbortSignal.any([senal, AbortSignal.timeout(15000)]),
      ...(cuerpo ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) } : {}),
    });
  } catch {
    const mensaje = escribiendo
      ? 'No se pudo confirmar el guardado. Volvé al listado y revisalo antes de intentar otra vez.'
      : 'No se pudo consultar. Revisá la conexión.';

    throw new ErrorDeEjercicioDeRutina(mensaje, 0, escribiendo);
  }

  if (!respuesta.ok) {
    let mensaje = 'No se pudo completar la operación. Intentá nuevamente.';

    switch (respuesta.status) {
      case 400:
        mensaje = 'Revisá los datos del ejercicio.';
        break;
      case 401:
        mensaje = 'Tu sesión venció. Volvé a iniciar sesión.';
        break;
      case 403:
        mensaje = 'No tenés permiso para acceder a estos ejercicios.';
        break;
      case 404:
        mensaje = 'La rutina o el ejercicio ya no está disponible.';
        break;
    }

    throw new ErrorDeEjercicioDeRutina(mensaje, respuesta.status, escribiendo && respuesta.status >= 500);
  }

  if (respuesta.status !== (metodo === 'POST' ? 201 : 200)) {
    respuestaInvalida(escribiendo);
  }

  return respuesta.json().catch(() => respuestaInvalida(escribiendo));
}

function rutaDeLaRutina(contexto: ContextoDeRutina) {
  if (![contexto.alumnoId, contexto.planId, contexto.rutinaId].every(esIdentificador)) {
    throw new ErrorDeEjercicioDeRutina('Seleccioná una rutina válida.');
  }

  return `alumnos/${contexto.alumnoId}/planes/${contexto.planId}/rutinas/${contexto.rutinaId}/ejercicios`;
}

export async function buscarEjercicios(filtros: FiltrosDeEjercicios, senal: AbortSignal): Promise<PaginaDeEjercicios> {
  if ([filtros.q, filtros.parteDelCuerpo, filtros.equipamiento].some(valor =>
    typeof valor !== 'string' || valor.length > 100,
  ) ||
    !Number.isSafeInteger(filtros.desde) ||
    filtros.desde < 0 ||
    filtros.desde > 4_294_967_295
  ) {
    throw new ErrorDeEjercicioDeRutina('Revisá los filtros del catálogo.');
  }

  const consulta = new URLSearchParams({ ...filtros, desde: String(filtros.desde) });
  const valor = await pedir('ejercicios?' + consulta, senal);

  if (!esPaginaDeEjercicios(valor)) {
    respuestaInvalida();
  }

  return valor;
}

export async function consultarEjerciciosDeRutina(contexto: ContextoDeRutina, senal: AbortSignal): Promise<EjercicioDeRutina[]> {
  const valor = await pedir(rutaDeLaRutina(contexto), senal);

  if (!Array.isArray(valor) || !valor.every(elemento => esEjercicioDeRutina(elemento, contexto.rutinaId))) {
    respuestaInvalida();
  }

  return valor;
}

export async function guardarEjercicioDeRutina(
  contexto: ContextoDeRutina,
  ejercicioId: number,
  datos: DatosDeEjercicioDeRutina,
  senal: AbortSignal,
  elementoId?: number,
): Promise<EjercicioDeRutina> {
  if (!esIdentificador(ejercicioId) ||
    (elementoId !== undefined && !esIdentificador(elementoId)) ||
    Object.keys(obtenerErroresDeEjercicioDeRutina(datos)).length
  ) {
    throw new ErrorDeEjercicioDeRutina('Revisá las indicaciones del ejercicio.');
  }

  const { cantidadDeSeries, repeticionesRecomendadas, pesoRecomendadoKg, descansoEnSegundos, rirRecomendado } = datos;
  // Omitir el RIR conserva el valor anterior; enviarlo como null lo borra.
  const indicaciones = {
    cantidadDeSeries,
    repeticionesRecomendadas,
    pesoRecomendadoKg,
    descansoEnSegundos,
    ...(rirRecomendado !== undefined ? { rirRecomendado } : {}),
  };
  const ruta = rutaDeLaRutina(contexto) + (elementoId === undefined ? '' : '/' + elementoId);
  const metodo = elementoId === undefined ? 'POST' : 'PUT';
  const cuerpo = elementoId === undefined ? { ejercicioId, ...indicaciones } : indicaciones;
  const valor = await pedir(ruta, senal, metodo, cuerpo);

  if (!esEjercicioDeRutina(valor, contexto.rutinaId) ||
    valor.ejercicioId !== ejercicioId ||
    (elementoId !== undefined && valor.id !== elementoId) ||
    Object.keys(indicaciones).some(clave =>
      valor[clave as keyof DatosDeEjercicioDeRutina] !== indicaciones[clave as keyof DatosDeEjercicioDeRutina],
    )
  ) {
    respuestaInvalida(true);
  }

  return valor;
}

export function resumenDeEjercicioDeRutina(elemento: DatosDeEjercicioDeRutina): string {
  return `${elemento.cantidadDeSeries} × ${elemento.repeticionesRecomendadas}` +
    (elemento.pesoRecomendadoKg === null
      ? ''
      : ` · ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(elemento.pesoRecomendadoKg)} kg`);
}

export function formatearTiempoDeDescanso(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

export function interpretarTiempoDeDescanso(valor: string): number {
  const coincidencia = /^(\d+):([0-5]\d)$/.exec(valor.trim());

  if (!coincidencia) {
    return NaN;
  }

  const segundos = Number(coincidencia[1]) * 60 + Number(coincidencia[2]);

  return Number.isSafeInteger(segundos) ? segundos : NaN;
}
