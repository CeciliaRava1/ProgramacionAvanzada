import { RepositorioDeSolicitudes, type AlumnoAsignado } from '../dominio/repositorio-de-solicitudes.js';

/** Expone solo la identidad pública de los alumnos vinculados al entrenador. */
export class ListarAlumnosAsignados {
  constructor(private readonly solicitudes: RepositorioDeSolicitudes) {}

  async ejecutar(entrenadorId: number): Promise<AlumnoAsignado[]> {
    const alumnos = await this.solicitudes.buscarAlumnosAsignados(entrenadorId);
    return alumnos.map(({ id, nombre, apellido }) => ({ id, nombre, apellido }));
  }
}
