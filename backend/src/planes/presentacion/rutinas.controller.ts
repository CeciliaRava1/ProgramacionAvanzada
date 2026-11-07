import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Inject, InternalServerErrorException, NotFoundException,
  Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { leerIdentificadorDeRuta } from '../../comun/identificador-de-ruta.js';
import { RequerirRol, GuardiaDeRol } from '../../usuarios/presentacion/guardia-de-rol.js';
import { AccesoAPlanDenegadoError } from '../aplicacion/gestionar-planes.js';
import { GestionarRutinas } from '../aplicacion/gestionar-rutinas.js';
import { PlanNoEncontradoError } from '../dominio/plan-de-entrenamiento.js';
import { DatosDeRutinaInvalidosError, RutinaNoEncontradaError, type DatosDeRutina } from '../dominio/rutina.js';

function leerDatosDeRutina(cuerpo: unknown): DatosDeRutina {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new BadRequestException('Indicá los datos de la rutina.');
  }

  const entrada = cuerpo as Record<string, unknown>;

  if (Object.keys(entrada).some((clave) => !['nombre', 'descripcion'].includes(clave)) || typeof entrada.nombre !== 'string' ||
    (entrada.descripcion !== undefined && entrada.descripcion !== null && typeof entrada.descripcion !== 'string')) {
    throw new BadRequestException('La rutina solo admite nombre y descripcion como texto; descripcion es opcional.');
  }

  return { nombre: entrada.nombre, descripcion: entrada.descripcion as string | null | undefined };
}

@Controller('usuarios/alumnos/:alumnoId/planes/:planId/rutinas')
@UseGuards(GuardiaDeRol)
export class RutinasController {
  constructor(@Inject(GestionarRutinas) private readonly rutinas: GestionarRutinas) { }

  @Get()
  @RequerirRol('entrenador')
  listar(@Param('alumnoId') alumnoIdCrudo: string, @Param('planId') planIdCrudo: string, @Req() peticion: Request) {
    const alumnoId = leerIdentificadorDeRuta(alumnoIdCrudo);
    const planId = leerIdentificadorDeRuta(planIdCrudo);

    return this.ejecutar(() => this.rutinas.listar(peticion.session.usuarioId!, alumnoId, planId));
  }

  @Post()
  @RequerirRol('entrenador')
  crear(
    @Param('alumnoId') alumnoIdCrudo: string,
    @Param('planId') planIdCrudo: string,
    @Body() cuerpo: unknown,
    @Req() peticion: Request,
  ) {
    const alumnoId = leerIdentificadorDeRuta(alumnoIdCrudo);
    const planId = leerIdentificadorDeRuta(planIdCrudo);
    const datos = leerDatosDeRutina(cuerpo);

    return this.ejecutar(() => this.rutinas.crear(peticion.session.usuarioId!, alumnoId, planId, datos));
  }

  @Put(':rutinaId')
  @RequerirRol('entrenador')
  modificar(
    @Param('alumnoId') alumnoIdCrudo: string,
    @Param('planId') planIdCrudo: string,
    @Param('rutinaId') rutinaIdCrudo: string,
    @Body() cuerpo: unknown,
    @Req() peticion: Request,
  ) {
    const alumnoId = leerIdentificadorDeRuta(alumnoIdCrudo);
    const planId = leerIdentificadorDeRuta(planIdCrudo);
    const rutinaId = leerIdentificadorDeRuta(rutinaIdCrudo);
    const datos = leerDatosDeRutina(cuerpo);

    return this.ejecutar(() => this.rutinas.modificar(peticion.session.usuarioId!, alumnoId, planId, rutinaId, datos));
  }

  private async ejecutar<T>(accion: () => Promise<T>): Promise<T> {
    try {
      return await accion();
    } catch (error: unknown) {
      if (error instanceof AccesoAPlanDenegadoError) throw new ForbiddenException(error.message);
      if (error instanceof PlanNoEncontradoError || error instanceof RutinaNoEncontradaError) throw new NotFoundException(error.message);
      if (error instanceof DatosDeRutinaInvalidosError) throw new BadRequestException({ message: error.message, erroresDeCampo: error.erroresDeCampo });
      throw new InternalServerErrorException('No se pudo completar la operación con las rutinas. Intentá nuevamente.');
    }
  }
}
