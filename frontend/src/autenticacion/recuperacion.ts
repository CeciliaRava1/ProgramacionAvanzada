
export type RutaDeAcceso =
  | { pantalla: 'inicio' }
  | { pantalla: 'recuperar' }
  | { pantalla: 'restablecer'; token: string | null };

/** Interpreta el hash de la URL cuando todavía no hay sesión: recuperar o restablecer la contraseña. */
export function interpretarRutaDeAcceso(hash: string): RutaDeAcceso {
  const [ruta, consulta = ''] = hash.replace(/^#/, '').split('?');
  if (ruta === '/recuperar') return { pantalla: 'recuperar' };
  if (ruta !== '/restablecer') return { pantalla: 'inicio' };
  const parametros = new URLSearchParams(consulta);
  const token = parametros.get('token');
  return {
    pantalla: 'restablecer',
    token: token && token.length <= 200 ? token : null,
  };
}

/** Misma regla que el backend; el servidor vuelve a validar. */
export function errorDeContrasenaNueva(contrasena: string, confirmacion: string): string | null {
  const largo = [...contrasena].length;
  if (largo > 128) return 'La contraseña es demasiado larga.';
  if (largo < 8 || /\s/u.test(contrasena)) return 'Usá al menos 8 caracteres, sin espacios.';
  if (contrasena !== confirmacion) return 'Las contraseñas no coinciden.';
  return null;
}

export class ErrorDeRecuperacion extends Error {
  readonly enlaceInvalido: boolean;

  constructor(mensaje: string, enlaceInvalido = false) {
    super(mensaje);
    this.enlaceInvalido = enlaceInvalido;
  }
}

async function enviarJson(ruta: string, cuerpo: unknown, senal: AbortSignal): Promise<Response> {
  try {
    return await fetch(`http://127.0.0.1:3000/usuarios/recuperacion${ruta}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.any([senal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new ErrorDeRecuperacion('No se pudo confirmar la operación. Revisá la conexión y volvé a intentarlo.');
  }
}

/** La respuesta es la misma exista o no la cuenta, así que no se distingue ningún caso. */
export async function pedirRecuperacion(correo: string, senal: AbortSignal): Promise<void> {
  const respuesta = await enviarJson('', { correo: correo.trim() }, senal);
  if (respuesta.status === 429) throw new ErrorDeRecuperacion('Demasiados intentos. Esperá un minuto antes de volver a intentar.');
  if (respuesta.status === 400) throw new ErrorDeRecuperacion('Revisá el correo ingresado.');
  if (respuesta.status !== 202) throw new ErrorDeRecuperacion('No se pudo pedir el enlace. Intentá nuevamente.');
}

export async function restablecerContrasena(token: string, contrasena: string, senal: AbortSignal): Promise<void> {
  const respuesta = await enviarJson('/restablecer', { token, contrasena }, senal);
  if (respuesta.status === 204) return;
  if (respuesta.status === 410) throw new ErrorDeRecuperacion('El enlace no es válido o ya venció. Pedí uno nuevo.', true);
  if (respuesta.status === 429) throw new ErrorDeRecuperacion('Demasiados intentos. Esperá un minuto antes de volver a intentar.');
  if (respuesta.status === 400) {
    const cuerpo: unknown = await respuesta.json().catch(() => null);
    const errores = typeof cuerpo === 'object' && cuerpo !== null && 'erroresDeCampo' in cuerpo ? cuerpo.erroresDeCampo : null;
    const mensaje = typeof errores === 'object' && errores !== null && 'contrasena' in errores && typeof errores.contrasena === 'string'
      ? errores.contrasena : 'Revisá la contraseña ingresada.';
    throw new ErrorDeRecuperacion(mensaje);
  }
  throw new ErrorDeRecuperacion('No se pudo cambiar la contraseña. Intentá nuevamente.');
}
