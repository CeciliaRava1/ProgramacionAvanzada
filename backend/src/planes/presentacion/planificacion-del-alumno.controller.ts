import { Controller, Get, Inject, InternalServerErrorException, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { leerIdentificadorDeRuta } from '../../comun/identificador-de-ruta.js';
import { RequerirRol, GuardiaDeRol } from '../../usuarios/presentacion/guardia-de-rol.js';
import { PlanificacionDelAlumno } from '../aplicacion/planificacion-del-alumno.js';
import { RutinaNoEncontradaError } from '../dominio/rutina.js';

@Controller('usuarios/mi-planificacion')
@UseGuards(GuardiaDeRol)
export class PlanificacionDelAlumnoController {
  constructor(@Inject(PlanificacionDelAlumno) private readonly planificacion: PlanificacionDelAlumno) {}

  @Get()
  @RequerirRol('alumno')
  obtener(@Req() peticion: Request) {
    return this.ejecutar(() => this.planificacion.obtener(peticion.session.usuarioId!));
  }

  @Get('rutinas/:rutinaId')
  @RequerirRol('alumno')
  obtenerRutina(@Param('rutinaId') rutinaIdCrudo: string, @Req() peticion: Request) {
    const rutinaId = leerIdentificadorDeRuta(rutinaIdCrudo);

    return this.ejecutar(() => this.planificacion.obtenerRutina(peticion.session.usuarioId!, rutinaId));
  }

  private async ejecutar<T>(accion: () => Promise<T>): Promise<T> {
    try {
      return await accion();
    } catch (error: unknown) {
      if (error instanceof RutinaNoEncontradaError) throw new NotFoundException(error.message);
      throw new InternalServerErrorException('No se pudo consultar tu planificación. Intentá nuevamente.');
    }
  }
}
