export interface AssignedStudent {
  id: number;
  firstName: string;
  lastName: string;
}

/** La identidad del entrenador viaja en la cookie; la pantalla no puede elegir otra. */
export async function getAssignedStudents(signal: AbortSignal): Promise<AssignedStudent[]> {
  let response: Response;
  try {
    response = await fetch('http://127.0.0.1:3000/users/students', {
      credentials: 'include',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new Error('No se pudo consultar el listado de alumnos. Revisá la conexión e intentá nuevamente.');
  }
  if (!response.ok) {
    throw new Error(response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
      response.status === 403 ? 'No tenés permiso para consultar alumnos.' : 'No se pudo consultar el listado de alumnos. Intentá nuevamente.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.status !== 200 || !Array.isArray(body) || body.some((item: unknown) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return true;
    const student = item as Record<string, unknown>;
    return Object.keys(student).length !== 3 || Object.keys(student).some((key) => !['id', 'firstName', 'lastName'].includes(key)) ||
      !Number.isSafeInteger(student.id) || Number(student.id) < 1 || Number(student.id) > 4_294_967_295 ||
      typeof student.firstName !== 'string' || [...student.firstName.trim()].length < 1 || [...student.firstName].length > 100 ||
      typeof student.lastName !== 'string' || [...student.lastName.trim()].length < 1 || [...student.lastName].length > 100;
  })) {
    throw new Error('No se pudo consultar el listado de alumnos: la respuesta del servidor no es válida.');
  }
  return body as AssignedStudent[];
}
