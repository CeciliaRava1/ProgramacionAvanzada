export interface Rutina {
  id?: number;
  planId: number;
  nombre: string;
  descripcion: string | null;
}

export type RutinaGuardada = Rutina & { id: number };
export interface DatosDeRutina { nombre: string; descripcion?: string | null; }
export type ErroresDeCampoDeRutina = Partial<Record<'nombre' | 'descripcion', string>>;

export class DatosDeRutinaInvalidosError extends Error {
  constructor(readonly erroresDeCampo: ErroresDeCampoDeRutina) { super('Revisá los datos de la rutina.'); }
}

export class RutinaNoEncontradaError extends Error {
  constructor() { super('La rutina ya no está disponible.'); }
}

/** El nombre es libre; una descripción sin contenido se conserva como ausencia de valor. */
export function crearRutina(planId: number, datos: DatosDeRutina): Rutina {
  const rutina = { planId, nombre: datos.nombre.trim(), descripcion: datos.descripcion?.trim() || null };
  const errores: ErroresDeCampoDeRutina = {};
  if ([...rutina.nombre].length < 1 || [...rutina.nombre].length > 200) errores.nombre = 'Ingresá entre 1 y 200 caracteres.';
  if (rutina.descripcion && [...rutina.descripcion].length > 5000) errores.descripcion = 'Ingresá hasta 5000 caracteres.';
  if (Object.keys(errores).length) throw new DatosDeRutinaInvalidosError(errores);
  return rutina;
}
