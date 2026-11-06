import { BadRequestException, Controller, Get, Inject, InternalServerErrorException, Query, UseGuards } from '@nestjs/common';
import { RequireRole, RoleGuard } from '../../users/presentation/role.guard.js';
import { ExerciseCatalog } from '../application/exercise-catalog.js';

@Controller('users/exercises')
@UseGuards(RoleGuard)
export class ExercisesController {
  constructor(@Inject(ExerciseCatalog) private readonly catalog: ExerciseCatalog) {}

  @Get()
  @RequireRole('trainer')
  async search(@Query() query: Record<string, unknown>) {
    if (Object.keys(query).some(key => !['q', 'bodyPart', 'equipment', 'offset'].includes(key))) throw new BadRequestException('Filtros no válidos.');
    for (const field of ['q', 'bodyPart', 'equipment']) {
      if (query[field] !== undefined && (typeof query[field] !== 'string' || (query[field] as string).length > 100)) throw new BadRequestException('Cada filtro admite hasta 100 caracteres.');
    }
    const rawOffset = query.offset ?? '0';
    const offset = typeof rawOffset === 'string' && /^\d+$/u.test(rawOffset) ? Number(rawOffset) : NaN;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 4_294_967_295) throw new BadRequestException('La página no es válida.');
    try {
      return await this.catalog.search({ q: ((query.q as string) || '').trim(), bodyPart: ((query.bodyPart as string) || '').trim(), equipment: ((query.equipment as string) || '').trim(), offset });
    } catch { throw new InternalServerErrorException('No se pudo consultar el catálogo. Intentá nuevamente.'); }
  }
}
