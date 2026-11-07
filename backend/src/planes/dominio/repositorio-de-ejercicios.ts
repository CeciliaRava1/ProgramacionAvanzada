import type { BusquedaDeEjercicios, Ejercicio, PaginaDeEjercicios } from './ejercicio.js';

export abstract class RepositorioDeEjercicios {
  abstract buscar(busqueda: BusquedaDeEjercicios): Promise<PaginaDeEjercicios>;
  abstract buscarPorId(id: number): Promise<Ejercicio | null>;
}
