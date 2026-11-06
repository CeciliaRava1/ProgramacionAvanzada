export interface TrainerSummary {
  id: number;
  firstName: string;
  lastName: string;
  availability: string | null;
}

export function isTrainerSummary(value: unknown): value is TrainerSummary {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const trainer = value as Record<string, unknown>;
  return Object.keys(trainer).every((key) => ['id', 'firstName', 'lastName', 'availability'].includes(key)) &&
    Number.isSafeInteger(trainer.id) && Number(trainer.id) > 0 &&
    typeof trainer.firstName === 'string' && [...trainer.firstName.trim()].length > 0 && [...trainer.firstName].length <= 100 &&
    typeof trainer.lastName === 'string' && [...trainer.lastName.trim()].length > 0 && [...trainer.lastName].length <= 100 &&
    (trainer.availability === null || (typeof trainer.availability === 'string' && [...trainer.availability].length <= 255));
}

/** Consulta con la sesión y acepta únicamente los datos públicos del listado. */
export async function getTrainers(signal: AbortSignal): Promise<TrainerSummary[]> {
  let response: Response;
  try {
    response = await fetch('http://127.0.0.1:3000/users/trainers', {
      credentials: 'include',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new Error('No se pudo consultar el listado. Revisá la conexión e intentá nuevamente.');
  }
  if (!response.ok) {
    throw new Error(response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
      response.status === 403 ? 'No tenés permiso para consultar entrenadores.' : 'No se pudo consultar el listado. Intentá nuevamente.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.status !== 200 || !Array.isArray(body) || body.some((item: unknown) => !isTrainerSummary(item))) {
    throw new Error('No se pudo consultar el listado: la respuesta del servidor no es válida.');
  }
  return body as TrainerSummary[];
}
