import type { Turno } from '../dominio/usuario.js';
import { RepositorioDeUsuarios } from '../dominio/repositorio-de-usuarios.js';

export interface ResumenDeEntrenador {
  id: number;
  nombre: string;
  apellido: string;
  /** Turnos de atención; lista vacía si no se cargaron. */
  horario: Turno[];
}

/** Construye la respuesta del listado sin exponer correo, contraseña ni hash. */
export class ListarEntrenadores {
  constructor(private readonly usuarios: RepositorioDeUsuarios) {}

  async ejecutar(): Promise<ResumenDeEntrenador[]> {
    const entrenadores = await this.usuarios.buscarEntrenadores();
    return entrenadores.map(({ id, nombre, apellido, horario }) => ({
      id, nombre, apellido, horario: horario ?? [],
    }));
  }
}
