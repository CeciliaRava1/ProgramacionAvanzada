import { BadRequestException, Controller, Get, Inject, InternalServerErrorException, Query, UseGuards } from '@nestjs/common';
import { RequerirRol, GuardiaDeRol } from '../../usuarios/presentacion/guardia-de-rol.js';
import { CatalogoDeEjercicios } from '../aplicacion/catalogo-de-ejercicios.js';

@Controller('usuarios/ejercicios')
@UseGuards(GuardiaDeRol)
export class EjerciciosController {
  constructor(@Inject(CatalogoDeEjercicios) private readonly catalogo: CatalogoDeEjercicios) {}

  @Get()
  @RequerirRol('entrenador')
  async buscar(@Query() consulta: Record<string, unknown>) {
    if (Object.keys(consulta).some((clave) => !['q', 'parteDelCuerpo', 'equipamiento', 'desde'].includes(clave))) throw new BadRequestException('Filtros no válidos.');
    for (const campo of ['q', 'parteDelCuerpo', 'equipamiento']) {
      if (consulta[campo] !== undefined && (typeof consulta[campo] !== 'string' || (consulta[campo] as string).length > 100)) throw new BadRequestException('Cada filtro admite hasta 100 caracteres.');
    }
    const desdeCrudo = consulta.desde ?? '0';
    const desde = typeof desdeCrudo === 'string' && /^\d+$/u.test(desdeCrudo) ? Number(desdeCrudo) : NaN;
    if (!Number.isSafeInteger(desde) || desde < 0 || desde > 4_294_967_295) throw new BadRequestException('La página no es válida.');
    try {
      return await this.catalogo.buscar({
        q: ((consulta.q as string) || '').trim(),
        parteDelCuerpo: ((consulta.parteDelCuerpo as string) || '').trim(),
        equipamiento: ((consulta.equipamiento as string) || '').trim(),
        desde,
      });
    } catch { throw new InternalServerErrorException('No se pudo consultar el catálogo. Intentá nuevamente.'); }
  }
}
