export interface SessionUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'student' | 'trainer' | 'admin';
}

async function requestSession(method: 'GET' | 'POST' | 'DELETE', signal: AbortSignal, input?: { email: string; password: string }): Promise<Response> {
  try {
    return await fetch('http://127.0.0.1:3000/users/session', {
      method,
      credentials: 'include',
      ...(input ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: input.email, password: input.password }) } : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new Error('No se pudo confirmar la operación. Revisá la conexión y volvé a intentarlo.');
  }
}

/** La respuesta externa se valida antes de usarla para identificar al usuario. */
async function readUser(response: Response): Promise<SessionUser> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== 'object' || body === null ||
      !('id' in body) || !Number.isSafeInteger(body.id) || Number(body.id) < 1 ||
      !('firstName' in body) || typeof body.firstName !== 'string' ||
      !('lastName' in body) || typeof body.lastName !== 'string' ||
      !('email' in body) || typeof body.email !== 'string' ||
      !('role' in body) || !['student', 'trainer', 'admin'].includes(String(body.role)) ||
      'password' in body || 'passwordHash' in body) {
    throw new Error('La respuesta de sesión no es válida.');
  }
  return { id: body.id as number, firstName: body.firstName, lastName: body.lastName, email: body.email, role: body.role as SessionUser['role'] };
}

export async function getSession(signal: AbortSignal): Promise<SessionUser | null> {
  const response = await requestSession('GET', signal);
  if (response.status === 401) return null;
  if (response.status !== 200) throw new Error('No se pudo consultar la sesión.');
  return readUser(response);
}

export async function signIn(email: string, password: string, signal: AbortSignal): Promise<SessionUser> {
  const response = await requestSession('POST', signal, { email, password });
  if (response.status === 401) throw new Error('Correo o contraseña incorrectos');
  if (response.status === 429) throw new Error('Demasiados intentos. Esperá un minuto antes de volver a intentar.');
  if (response.status === 400) throw new Error('Revisá el correo y la contraseña ingresados.');
  if (response.status !== 200) throw new Error('No se pudo iniciar sesión. Intentá nuevamente.');
  return readUser(response);
}

export async function signOut(signal: AbortSignal): Promise<void> {
  const response = await requestSession('DELETE', signal);
  if (response.status !== 204) throw new Error('No se pudo cerrar sesión. Volvé a intentarlo.');
}
