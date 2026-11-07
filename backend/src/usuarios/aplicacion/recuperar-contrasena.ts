import { createHash, randomBytes } from 'node:crypto';
import { errorDeContrasena } from '../dominio/contrasena.js';
import {
  EnlaceDeRecuperacionInvalidoError, EnviadorDeCorreo, RepositorioDeRecuperaciones, VIGENCIA_DEL_ENLACE_MS,
} from '../dominio/recuperacion-de-contrasena.js';
import { RepositorioDeUsuarios } from '../dominio/repositorio-de-usuarios.js';
import type { RolDeUsuario } from '../dominio/usuario.js';

export class ContrasenaNuevaInvalidaError extends Error {}

export function hashearToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const generarTokenAleatorio = () => randomBytes(32).toString('base64url');

/** Envía el enlace de recuperación. Si la cuenta no existe o está dada de baja no hace nada, sin avisar a quien pide. */
export class SolicitarRecuperacion {
  constructor(
    private readonly usuarios: RepositorioDeUsuarios,
    private readonly recuperaciones: RepositorioDeRecuperaciones,
    private readonly enviador: EnviadorDeCorreo,
    private readonly urlDelFrontend: string,
    private readonly generarToken: () => string = generarTokenAleatorio,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async ejecutar(correo: string, rol: RolDeUsuario): Promise<void> {
    const usuario = await this.usuarios.buscarPorCorreoYRol(correo.trim().toLowerCase(), rol);
    if (!usuario?.id || usuario.fechaBaja) return;

    const token = this.generarToken();
    await this.recuperaciones.crear(usuario.id, hashearToken(token), new Date(this.ahora().getTime() + VIGENCIA_DEL_ENLACE_MS));
    const enlace = `${this.urlDelFrontend}/#/restablecer?token=${encodeURIComponent(token)}&rol=${rol}`;
    await this.enviador.enviar({
      para: usuario.correo,
      asunto: 'Recuperá tu contraseña de GymHelper',
      texto: [
        `Hola ${usuario.nombre}:`,
        '',
        `Recibimos un pedido para cambiar la contraseña de tu cuenta de ${rol}. Entrá a este enlace para elegir una nueva:`,
        '',
        enlace,
        '',
        'El enlace sirve una sola vez y vence en 1 hora. Si no lo pediste vos, ignorá este mensaje: tu contraseña no cambia.',
      ].join('\n'),
    });
  }
}

/** Cambia la contraseña con un enlace de un solo uso. */
export class RestablecerContrasena {
  constructor(
    private readonly recuperaciones: RepositorioDeRecuperaciones,
    private readonly hashearContrasena: (contrasena: string) => Promise<string>,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async ejecutar(token: string, contrasena: string): Promise<void> {
    const error = errorDeContrasena(contrasena);
    if (error) throw new ContrasenaNuevaInvalidaError(error);
    const hash = await this.hashearContrasena(contrasena);
    if (!(await this.recuperaciones.consumir(hashearToken(token), this.ahora(), hash))) {
      throw new EnlaceDeRecuperacionInvalidoError();
    }
  }
}
