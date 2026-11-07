import type { EjercicioPublico } from './ejercicio.js';

export interface DatosDeEjercicioDeRutina {
  cantidadDeSeries: number;
  repeticionesRecomendadas: number;
  pesoRecomendadoKg: number | null;
  descansoEnSegundos: number | null;
  rirRecomendado?: number | null;
}
export interface EjercicioDeRutina extends DatosDeEjercicioDeRutina { id: number; rutinaId: number; ejercicioId: number; rirRecomendado: number | null; }
export interface EjercicioDeRutinaDetallado extends EjercicioDeRutina { ejercicio: EjercicioPublico; }
export type ErroresDeCampoDeEjercicioDeRutina = Partial<Record<keyof DatosDeEjercicioDeRutina, string>>;

export class DatosDeEjercicioDeRutinaInvalidosError extends Error {
  constructor(readonly erroresDeCampo: ErroresDeCampoDeEjercicioDeRutina) { super('Revisá las indicaciones del ejercicio.'); }
}

/** Los límites corresponden al almacenamiento; todas las series comparten estas indicaciones. */
export function validarEjercicioDeRutina(datos: DatosDeEjercicioDeRutina): DatosDeEjercicioDeRutina {
  const { cantidadDeSeries, repeticionesRecomendadas, pesoRecomendadoKg, descansoEnSegundos, rirRecomendado } = datos;
  const errores: ErroresDeCampoDeEjercicioDeRutina = {};
  for (const clave of ['cantidadDeSeries', 'repeticionesRecomendadas'] as const) {
    const valor = datos[clave];
    if (!Number.isInteger(valor) || valor < 1) errores[clave] = 'Ingresá una cantidad entera mayor que cero.';
    else if (valor > 65535) errores[clave] = 'Revisá la cantidad de ' + (clave === 'cantidadDeSeries' ? 'series.' : 'repeticiones.');
  }
  if (pesoRecomendadoKg !== null && (!Number.isFinite(pesoRecomendadoKg) || pesoRecomendadoKg < 0 || pesoRecomendadoKg > 999999.99 || Math.round(pesoRecomendadoKg * 100) / 100 !== pesoRecomendadoKg)) errores.pesoRecomendadoKg = 'Ingresá un peso válido, con hasta dos decimales.';
  if (descansoEnSegundos !== null && (!Number.isInteger(descansoEnSegundos) || descansoEnSegundos < 0 || descansoEnSegundos > 65535)) errores.descansoEnSegundos = 'Revisá el tiempo de descanso.';
  if (rirRecomendado !== undefined && rirRecomendado !== null && (!Number.isInteger(rirRecomendado) || rirRecomendado < 0 || rirRecomendado > 65535)) errores.rirRecomendado = 'Ingresá un RIR válido, entero y mayor o igual que cero.';
  if (Object.keys(errores).length) throw new DatosDeEjercicioDeRutinaInvalidosError(errores);
  return { cantidadDeSeries, repeticionesRecomendadas, pesoRecomendadoKg, descansoEnSegundos, ...(rirRecomendado !== undefined ? { rirRecomendado } : {}) };
}
