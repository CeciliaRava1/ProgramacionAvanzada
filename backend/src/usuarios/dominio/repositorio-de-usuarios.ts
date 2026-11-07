import type { DatosDeUsuario, Turno, Usuario } from './usuario.js';

export type UsuarioGuardado = Usuario & { id: number };
export type RolGestionado = 'alumno' | 'entrenador';

/** Datos que el administrador puede modificar; el horario solo aplica a entrenadores. */
export interface CambiosDeCuenta extends DatosDeUsuario {
  horario?: Turno[] | null;
}

export class CorreoYaRegistradoError extends Error {
  constructor() {
    super('Ya existe una cuenta con ese correo electrónico.');
  }
}

/** Operaciones de cuentas que necesita la aplicación, sin conocer TypeORM. */
export abstract class RepositorioDeUsuarios {
  abstract buscarPorCorreo(correo: string): Promise<Usuario | null>;
  abstract buscarPorId(id: number): Promise<Usuario | null>;
  /** Entrenadores activos; las cuentas dadas de baja no se ofrecen a los alumnos. */
  abstract buscarEntrenadores(): Promise<UsuarioGuardado[]>;
  /** Cuentas del rol indicado, incluidas las dadas de baja. */
  abstract buscarPorRol(rol: RolGestionado): Promise<UsuarioGuardado[]>;
  abstract guardar(usuario: Usuario): Promise<UsuarioGuardado>;
  /** Modifica una cuenta activa del rol indicado. Devuelve null si no existe o está dada de baja. */
  abstract modificar(id: number, rol: RolGestionado, cambios: CambiosDeCuenta): Promise<UsuarioGuardado | null>;
  /**
   * Baja lógica: finaliza vinculaciones, cancela solicitudes pendientes y cierra sesiones.
   * Devuelve false si la cuenta no existe. Repetirla sobre una cuenta ya dada de baja no cambia nada.
   */
  abstract darDeBaja(id: number, rol: RolGestionado): Promise<boolean>;
}
