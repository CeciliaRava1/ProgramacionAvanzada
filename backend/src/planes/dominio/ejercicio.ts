export interface Ejercicio {
  id: number;
  identificador: string;
  nombre: string;
  parteDelCuerpo: string;
  equipamiento: string;
  musculoObjetivo: string;
  instrucciones: string;
}

export type EjercicioPublico = Omit<Ejercicio, 'identificador'>;
export interface BusquedaDeEjercicios { q: string; parteDelCuerpo: string; equipamiento: string; desde: number; }
export interface PaginaDeEjercicios { elementos: EjercicioPublico[]; total: number; partesDelCuerpo: string[]; equipamientos: string[]; }

export class EjercicioNoEncontradoError extends Error {
  constructor() { super('El ejercicio ya no está disponible.'); }
}

export function ejercicioPublico({ id, nombre, parteDelCuerpo, equipamiento, musculoObjetivo, instrucciones }: Ejercicio): EjercicioPublico {
  return { id, nombre, parteDelCuerpo, equipamiento, musculoObjetivo, instrucciones };
}
