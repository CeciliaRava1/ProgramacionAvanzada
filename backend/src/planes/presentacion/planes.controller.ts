import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, Inject,
  InternalServerErrorException, NotFoundException, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { leerIdentificadorDeRuta } from '../../comun/identificador-de-ruta.js';
import { RequerirRol, GuardiaDeRol } from '../../usuarios/presentacion/guardia-de-rol.js';
import { AccesoAPlanDenegadoError, GestionarPlanes } from '../aplicacion/gestionar-planes.js';
import { DatosDePlanInvalidosError, PlanNoEncontradoError, PlanYaExisteError, type DatosDePlan } from '../dominio/plan-de-entrenamiento.js';

function leerDatosDePlan(cuerpo: unknown): DatosDePlan {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new BadRequestException('Indicá el nombre y el objetivo del plan.');
  }

  const entrada = cuerpo as Record<string, unknown>;

  if (Object.keys(entrada).some((clave) => !['nombre', 'objetivo'].includes(clave)) || typeof entrada.nombre !== 'string' ||
    typeof entrada.objetivo !== 'string') {
    throw new BadRequestException('El plan solo admite nombre y objetivo como texto.');
  }

  return { nombre: entrada.nombre, objetivo: entrada.objetivo };
}

@Controller('usuarios/alumnos/:alumnoId/planes')
@UseGuards(GuardiaDeRol)
export class PlanesController {
  constructor(@Inject(GestionarPlanes) private readonly planes: GestionarPlanes) { }

  @Get()
  @RequerirRol('entrenador')
  listar(@Param('alumnoId') alumnoIdCrudo: string, @Req() peticion: Request) {
    const alumnoId = leerIdentificadorDeRuta(alumnoIdCrudo);

    return this.ejecutar(() => this.planes.listar(peticion.session.usuarioId!, alumnoId));
  }

  @Post()
  @RequerirRol('entrenador')
  crear(@Param('alumnoId') alumnoIdCrudo: string, @Body() cuerpo: unknown, @Req() peticion: Request) {
    const alumnoId = leerIdentificadorDeRuta(alumnoIdCrudo);
    const datos = leerDatosDePlan(cuerpo);

    return this.ejecutar(() => this.planes.crear(peticion.session.usuarioId!, alumnoId, datos));
  }

  @Put(':planId')
  @RequerirRol('entrenador')
  modificar(
    @Param('alumnoId') alumnoIdCrudo: string,
    @Param('planId') planIdCrudo: string,
    @Body() cuerpo: unknown,
    @Req() peticion: Request,
  ) {
    const alumnoId = leerIdentificadorDeRuta(alumnoIdCrudo);
    const planId = leerIdentificadorDeRuta(planIdCrudo);
    const datos = leerDatosDePlan(cuerpo);

    return this.ejecutar(() => this.planes.modificar(peticion.session.usuarioId!, alumnoId, planId, datos));
  }

  @Delete(':planId')
  @HttpCode(204)
  @RequerirRol('entrenador')
  eliminar(@Param('alumnoId') alumnoIdCrudo: string, @Param('planId') planIdCrudo: string, @Req() peticion: Request) {
    const alumnoId = leerIdentificadorDeRuta(alumnoIdCrudo);
    const planId = leerIdentificadorDeRuta(planIdCrudo);

    return this.ejecutar(() => this.planes.eliminar(peticion.session.usuarioId!, alumnoId, planId));
  }

  private async ejecutar<T>(accion: () => Promise<T>): Promise<T> {
    try {
      return await accion();
    } catch (error: unknown) {
      if (error instanceof AccesoAPlanDenegadoError) throw new ForbiddenException(error.message);
      if (error instanceof PlanNoEncontradoError) throw new NotFoundException(error.message);
      if (error instanceof PlanYaExisteError) throw new ConflictException(error.message);
      if (error instanceof DatosDePlanInvalidosError) throw new BadRequestException({ message: error.message, erroresDeCampo: error.erroresDeCampo });
      throw new InternalServerErrorException('No se pudo completar la operación con el plan. Intentá nuevamente.');
    }
  }
}
