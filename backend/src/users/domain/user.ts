export type UserRole = 'student' | 'trainer' | 'admin';

export interface UserDetails {
  firstName: string;
  lastName: string;
  email: string;
}

export interface User extends UserDetails {
  id?: number;
  passwordHash: string;
  role: UserRole;
  availability?: string | null;
}

export class InvalidUserDataError extends Error {
  constructor(readonly fieldErrors: Record<string, string>) {
    super('Revisá los datos ingresados.');
  }
}

/** Un horario vacío representa información no cargada, no una categoría fija. */
export function normalizeTrainerAvailability(value?: string | null): string | null {
  const availability = value?.trim() || null;
  if (availability && [...availability].length > 255) {
    throw new InvalidUserDataError({ availability: 'Ingresá hasta 255 caracteres para el horario.' });
  }
  return availability;
}

/** Normaliza los datos de la cuenta sin depender de HTTP ni de la base. */
export function normalizeUserDetails(input: UserDetails): UserDetails {
  const details = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
  };
  const fieldErrors: Record<string, string> = {};

  for (const field of ['firstName', 'lastName'] as const) {
    if ([...details[field]].length < 1 || [...details[field]].length > 100) {
      fieldErrors[field] = 'Ingresá entre 1 y 100 caracteres.';
    }
  }
  if ([...details.email].length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(details.email) ||
      /[\u0000-\u001f\u007f]/u.test(details.email)) {
    fieldErrors.email = 'Ingresá un correo electrónico válido de hasta 254 caracteres.';
  }

  if (Object.keys(fieldErrors).length > 0) throw new InvalidUserDataError(fieldErrors);
  return details;
}
