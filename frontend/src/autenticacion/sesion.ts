export type RolDeUsuario = 'alumno' | 'entrenador' | 'administrador';

export interface UsuarioDeSesion {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  rol: RolDeUsuario;
}

export const ROLES: readonly RolDeUsuario[] = ['alumno', 'entrenador', 'administrador'];

export const ETIQUETAS_DE_ROL: Record<RolDeUsuario, string> = { alumno: 'Alumno', entrenador: 'Entrenador', administrador: 'Administrador' };

async function pedirSesion(metodo: 'GET' | 'POST' | 'DELETE', senal: AbortSignal, entrada?: { correo: string; contrasena: string; rol: RolDeUsuario }): Promise<Response> {
  try {
    return await fetch('http://127.0.0.1:3000/usuarios/sesion', {
      method: metodo,
      credentials: 'include',
      ...(entrada ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: entrada.correo, contrasena: entrada.contrasena, rol: entrada.rol }) } : {}),
      signal: AbortSignal.any([senal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new Error('No se pudo confirmar la operación. Revisá la conexión y volvé a intentarlo.');
  }
}

/** La respuesta externa se valida antes de usarla para identificar al usuario. */
async function leerUsuario(respuesta: Response): Promise<UsuarioDeSesion> {
  const cuerpo: unknown = await respuesta.json().catch(() => null);
  if (typeof cuerpo !== 'object' || cuerpo === null ||
      !('id' in cuerpo) || !Number.isSafeInteger(cuerpo.id) || Number(cuerpo.id) < 1 ||
      !('nombre' in cuerpo) || typeof cuerpo.nombre !== 'string' ||
      !('apellido' in cuerpo) || typeof cuerpo.apellido !== 'string' ||
      !('correo' in cuerpo) || typeof cuerpo.correo !== 'string' ||
      !('rol' in cuerpo) || !ROLES.includes(cuerpo.rol as RolDeUsuario) ||
      'contrasena' in cuerpo || 'hashDeContrasena' in cuerpo) {
    throw new Error('La respuesta de sesión no es válida.');
  }
  return { id: cuerpo.id as number, nombre: cuerpo.nombre, apellido: cuerpo.apellido, correo: cuerpo.correo, rol: cuerpo.rol as RolDeUsuario };
}

export async function obtenerSesion(senal: AbortSignal): Promise<UsuarioDeSesion | null> {
  const respuesta = await pedirSesion('GET', senal);
  if (respuesta.status === 401) return null;
  if (respuesta.status !== 200) throw new Error('No se pudo consultar la sesión.');
  return leerUsuario(respuesta);
}

export async function iniciarSesion(correo: string, contrasena: string, rol: RolDeUsuario, senal: AbortSignal): Promise<UsuarioDeSesion> {
  const respuesta = await pedirSesion('POST', senal, { correo, contrasena, rol });
  if (respuesta.status === 401) throw new Error('Correo o contraseña incorrectos');
  if (respuesta.status === 429) throw new Error('Demasiados intentos. Esperá un minuto antes de volver a intentar.');
  if (respuesta.status === 400) throw new Error('Revisá el correo y la contraseña ingresados.');
  if (respuesta.status !== 200) throw new Error('No se pudo iniciar sesión. Intentá nuevamente.');
  return leerUsuario(respuesta);
}

export async function cerrarSesion(senal: AbortSignal): Promise<void> {
  const respuesta = await pedirSesion('DELETE', senal);
  if (respuesta.status !== 204) throw new Error('No se pudo cerrar sesión. Volvé a intentarlo.');
}
