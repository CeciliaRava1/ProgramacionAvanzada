import { RepositorioDeUsuarios } from '../dominio/repositorio-de-usuarios.js';
import type { RolDeUsuario } from '../dominio/usuario.js';

export interface UsuarioDeSesion {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  rol: RolDeUsuario;
}

export class CredencialesInvalidasError extends Error {
  constructor() { super('Correo o contraseña incorrectos'); }
}

/** Verifica credenciales sin conocer cookies, Express ni TypeORM. */
export class IniciarSesion {
  constructor(
    private readonly usuarios: RepositorioDeUsuarios,
    private readonly verificarContrasena: (contrasena: string, hash?: string) => Promise<boolean>,
  ) {}

  async ejecutar(correo: string, contrasena: string, rol: RolDeUsuario): Promise<UsuarioDeSesion> {
    const usuario = await this.usuarios.buscarPorCorreoYRol(correo.trim().toLowerCase(), rol);
    const coincide = await this.verificarContrasena(contrasena, usuario?.hashDeContrasena);
    // Una cuenta dada de baja no puede iniciar sesión, con el mismo mensaje que una contraseña incorrecta.
    if (!usuario?.id || usuario.fechaBaja || !coincide) throw new CredencialesInvalidasError();
    return { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, correo: usuario.correo, rol: usuario.rol };
  }
}
