import { RepositorioDeEjercicios } from '../dominio/repositorio-de-ejercicios.js';
import type { BusquedaDeEjercicios } from '../dominio/ejercicio.js';

export class CatalogoDeEjercicios {
  constructor(private readonly ejercicios: RepositorioDeEjercicios) {}
  buscar(busqueda: BusquedaDeEjercicios) { return this.ejercicios.buscar(busqueda); }
}
