import { BadRequestException } from '@nestjs/common';
import type { RegisterUserInput } from '../application/register-user.js';

/** Valida la entrada externa y rechaza campos como role o passwordHash. */
export function parseRegisterUserRequest(body: unknown, role: 'student' | 'trainer' = 'student'): RegisterUserInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('El cuerpo debe ser un objeto JSON.');
  }
  const input = body as Record<string, unknown>;
  const fields = ['firstName', 'lastName', 'email', 'password'];
  const allowedFields = role === 'trainer' ? [...fields, 'availability'] : fields;
  if (Object.keys(input).some((field) => !allowedFields.includes(field))) {
    throw new BadRequestException('La solicitud contiene campos no permitidos.');
  }

  const fieldErrors: Record<string, string> = {};
  for (const field of fields) {
    if (typeof input[field] !== 'string') fieldErrors[field] = 'Este campo es obligatorio y debe ser texto.';
  }
  if (input.availability !== undefined && input.availability !== null && typeof input.availability !== 'string') {
    fieldErrors.availability = 'El horario debe ser texto.';
  }
  if (typeof input.password === 'string') {
    const length = [...input.password].length;
    if (length > 128) {
      fieldErrors.password = 'La contraseña es demasiado larga.';
    } else if (length < 8 || /\s/u.test(input.password)) {
      fieldErrors.password = 'Usá al menos 8 caracteres, sin espacios.';
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new BadRequestException({ message: 'Revisá los datos ingresados.', fieldErrors });
  }

  return {
    firstName: input.firstName as string,
    lastName: input.lastName as string,
    email: input.email as string,
    password: input.password as string,
    ...(role === 'trainer' && input.availability !== undefined ? { availability: input.availability as string | null } : {}),
  };
}
