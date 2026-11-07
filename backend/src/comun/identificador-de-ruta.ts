import { BadRequestException } from '@nestjs/common';

/** Convierte un parámetro de ruta en un identificador entero positivo que entra en INT UNSIGNED. */
export function leerIdentificadorDeRuta(crudo: unknown): number {
  const id = typeof crudo === 'string' && /^\d+$/u.test(crudo) ? Number(crudo) : typeof crudo === 'number' ? crudo : NaN;

  if (!Number.isSafeInteger(id) || id < 1 || id > 4_294_967_295) {
    throw new BadRequestException('El identificador debe ser válido.');
  }

  return id;
}
