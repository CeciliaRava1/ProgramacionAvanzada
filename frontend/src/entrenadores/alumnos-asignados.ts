export interface AlumnoAsignado {
  id: number;
  nombre: string;
  apellido: string;
}

/** La identidad del entrenador viaja en la cookie; la pantalla no puede elegir otra. */
export async function obtenerAlumnosAsignados(senal: AbortSignal): Promise<AlumnoAsignado[]> {
  let respuesta: Response;
  try {
    respuesta = await fetch('http://127.0.0.1:3000/usuarios/alumnos', {
      credentials: 'include',
      signal: AbortSignal.any([senal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new Error('No se pudo consultar el listado de alumnos. Revisá la conexión e intentá nuevamente.');
  }
  if (!respuesta.ok) {
    throw new Error(respuesta.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
      respuesta.status === 403 ? 'No tenés permiso para consultar alumnos.' : 'No se pudo consultar el listado de alumnos. Intentá nuevamente.');
  }
  const cuerpo: unknown = await respuesta.json().catch(() => null);
  if (respuesta.status !== 200 || !Array.isArray(cuerpo) || cuerpo.some((elemento: unknown) => {
    if (typeof elemento !== 'object' || elemento === null || Array.isArray(elemento)) return true;
    const alumno = elemento as Record<string, unknown>;
    return Object.keys(alumno).length !== 3 || Object.keys(alumno).some((clave) => !['id', 'nombre', 'apellido'].includes(clave)) ||
      !Number.isSafeInteger(alumno.id) || Number(alumno.id) < 1 || Number(alumno.id) > 4_294_967_295 ||
      typeof alumno.nombre !== 'string' || [...alumno.nombre.trim()].length < 1 || [...alumno.nombre].length > 100 ||
      typeof alumno.apellido !== 'string' || [...alumno.apellido.trim()].length < 1 || [...alumno.apellido].length > 100;
  })) {
    throw new Error('No se pudo consultar el listado de alumnos: la respuesta del servidor no es válida.');
  }
  return cuerpo as AlumnoAsignado[];
}
