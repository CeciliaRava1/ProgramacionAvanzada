export interface RegistrationInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  availability?: string;
}

export type RegistrationFieldErrors = Partial<Record<keyof RegistrationInput, string>>;

export class RegistrationError extends Error {
  readonly fieldErrors: RegistrationFieldErrors;

  constructor(message: string, fieldErrors: RegistrationFieldErrors = {}) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

/** Da ayuda inmediata en el formulario; el backend vuelve a validar la entrada. */
export function getRegistrationFieldErrors(input: RegistrationInput): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  for (const field of ['firstName', 'lastName'] as const) {
    const length = [...input[field].trim()].length;
    if (length < 1 || length > 100) errors[field] = 'Ingresá entre 1 y 100 caracteres.';
  }
  const email = input.email.trim();
  if ([...email].length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ||
      /[\u0000-\u001f\u007f]/u.test(email)) {
    errors.email = 'Ingresá un correo electrónico válido de hasta 254 caracteres.';
  }
  const passwordLength = [...input.password].length;
  if (passwordLength > 128) {
    errors.password = 'La contraseña es demasiado larga.';
  } else if (passwordLength < 8 || /\s/u.test(input.password)) {
    errors.password = 'Usá al menos 8 caracteres, sin espacios.';
  }
  if (input.availability !== undefined && [...input.availability.trim()].length > 255) {
    errors.availability = 'Ingresá hasta 255 caracteres para el horario.';
  }
  return errors;
}

/** Envía los datos permitidos para cada alta y valida la respuesta externa. */
export async function registerUser(
  input: RegistrationInput, signal: AbortSignal, accountType: 'student' | 'trainer' = 'student',
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:3000/users/${accountType === 'trainer' ? 'trainers' : 'students'}`, {
      method: 'POST',
      ...(accountType === 'trainer' ? { credentials: 'include' as const } : {}),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        password: input.password,
        ...(accountType === 'trainer' && input.availability !== undefined ? { availability: input.availability } : {}),
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
  } catch {
    throw new RegistrationError('No se pudo confirmar el registro. Revisá la conexión antes de volver a intentarlo.');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const fieldErrors: RegistrationFieldErrors = {};
    // Solo se muestran mensajes conocidos: una respuesta inesperada no expone detalles internos.
    if (response.status === 409) {
      fieldErrors.email = 'Ya existe una cuenta con ese correo electrónico.';
    } else if (response.status === 400 && typeof body === 'object' && body !== null &&
               'fieldErrors' in body && typeof body.fieldErrors === 'object' && body.fieldErrors !== null) {
      for (const field of ['firstName', 'lastName', 'email', 'password', 'availability'] as const) {
        const error = (body.fieldErrors as Record<string, unknown>)[field];
        if (typeof error === 'string') fieldErrors[field] = error;
      }
    }
    throw new RegistrationError(
      response.status === 409 ? 'Ya existe una cuenta con ese correo electrónico.' :
        response.status === 400 ? 'Revisá los datos ingresados.' :
          response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' :
            response.status === 403 ? 'No tenés permiso para crear entrenadores.' : 'No se pudo registrar la cuenta. Intentá nuevamente.',
      fieldErrors,
    );
  }

  if (response.status !== 201 || typeof body !== 'object' || body === null ||
      !('id' in body) || !Number.isSafeInteger(body.id) || Number(body.id) < 1 ||
      !('firstName' in body) || typeof body.firstName !== 'string' ||
      !('lastName' in body) || typeof body.lastName !== 'string' ||
      !('email' in body) || typeof body.email !== 'string' ||
      !('role' in body) || body.role !== accountType || 'password' in body || 'passwordHash' in body) {
    throw new RegistrationError('No se pudo confirmar el registro: la respuesta del servidor no es válida.');
  }
}
