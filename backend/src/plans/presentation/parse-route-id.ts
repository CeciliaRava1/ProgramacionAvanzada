import { BadRequestException } from '@nestjs/common';

export function parseRouteId(raw: string): number {
  const id = /^\d+$/u.test(raw) ? Number(raw) : NaN;

  if (!Number.isSafeInteger(id) || id < 1 || id > 4_294_967_295) {
    throw new BadRequestException('El identificador debe ser válido.');
  }

  return id;
}
