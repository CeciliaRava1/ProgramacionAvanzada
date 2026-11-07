export const VIGENCIA_DEL_ENLACE_MS = 60 * 60 * 1000;

export class EnlaceDeRecuperacionInvalidoError extends Error {
  constructor() { super('El enlace no es válido o ya venció. Pedí uno nuevo.'); }
}

export interface CorreoSaliente {
  para: string;
  asunto: string;
  texto: string;
}

/** Puerto de salida: la aplicación manda correos sin saber si van por SMTP u otro medio. */
export abstract class EnviadorDeCorreo {
  abstract enviar(correo: CorreoSaliente): Promise<void>;
}

/** Los enlaces se guardan solo como hash: quien lea la base no puede usarlos. */
export abstract class RepositorioDeRecuperaciones {
  /** Invalida los enlaces pendientes de la cuenta y registra el nuevo. */
  abstract crear(usuarioId: number, hashDelToken: string, venceEn: Date): Promise<void>;
  /**
   * En una sola transacción: verifica que el enlace exista, no esté usado, no haya vencido y la cuenta esté activa;
   * cambia la contraseña, lo marca como usado y cierra las sesiones de la cuenta. Devuelve false si no corresponde.
   */
  abstract consumir(hashDelToken: string, ahora: Date, hashDeContrasenaNueva: string): Promise<boolean>;
}
