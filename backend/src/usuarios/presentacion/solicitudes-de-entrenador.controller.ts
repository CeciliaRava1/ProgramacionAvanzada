import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode,
  Inject, InternalServerErrorException, NotFoundException, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SolicitudesDeEntrenador } from '../aplicacion/solicitudes-de-entrenador.js';
import { SolicitudEnConflictoError, SolicitudNoEncontradaError, SolicitudSinPermisoError } from '../dominio/solicitud-de-entrenador.js';
import { RequerirRol, GuardiaDeRol } from './guardia-de-rol.js';

function idPositivo(valor: unknown): number {
  const id = typeof valor === 'string' && /^\d+$/u.test(valor) ? Number(valor) : valor;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1 || id > 4_294_967_295) {
    throw new BadRequestException('El identificador debe ser un entero positivo válido.');
  }
  return id;
}

@Controller('usuarios/solicitudes-de-entrenador')
@UseGuards(GuardiaDeRol)
export class SolicitudesDeEntrenadorController {
  constructor(@Inject(SolicitudesDeEntrenador) private readonly solicitudes: SolicitudesDeEntrenador) {}

  @Get('actual')
  @RequerirRol('alumno')
  actual(@Req() peticion: Request) {
    return this.ejecutar(() => this.solicitudes.actual(peticion.session.usuarioId!));
  }

  @Get()
  @RequerirRol('entrenador')
  recibidas(@Req() peticion: Request) {
    return this.ejecutar(() => this.solicitudes.recibidas(peticion.session.usuarioId!));
  }

  @Post()
  @RequerirRol('alumno')
  enviar(@Body() cuerpo: unknown, @Req() peticion: Request) {
    if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) throw new BadRequestException('Indicá el entrenador seleccionado.');
    const entrada = cuerpo as Record<string, unknown>;
    if (Object.keys(entrada).some((clave) => clave !== 'entrenadorId') || typeof entrada.entrenadorId !== 'number') {
      throw new BadRequestException('La solicitud solo admite entrenadorId como número.');
    }
    const entrenadorId = idPositivo(entrada.entrenadorId);
    return this.ejecutar(() => this.solicitudes.enviar(peticion.session.usuarioId!, entrenadorId));
  }

  @Post(':id/aceptar')
  @HttpCode(204)
  @RequerirRol('entrenador')
  aceptar(@Param('id') idCrudo: string, @Req() peticion: Request) {
    const id = idPositivo(idCrudo);
    return this.ejecutar(() => this.solicitudes.responder(id, peticion.session.usuarioId!, 'aceptada'));
  }

  @Post(':id/rechazar')
  @HttpCode(204)
  @RequerirRol('entrenador')
  rechazar(@Param('id') idCrudo: string, @Req() peticion: Request) {
    const id = idPositivo(idCrudo);
    return this.ejecutar(() => this.solicitudes.responder(id, peticion.session.usuarioId!, 'rechazada'));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequerirRol(['alumno', 'entrenador'])
  cancelar(@Param('id') idCrudo: string, @Req() peticion: Request) {
    const id = idPositivo(idCrudo);
    return this.ejecutar(() => this.solicitudes.responder(id, peticion.session.usuarioId!, 'cancelada'));
  }

  private async ejecutar<T>(accion: () => Promise<T>): Promise<T> {
    try { return await accion(); }
    catch (error: unknown) {
      if (error instanceof SolicitudNoEncontradaError) throw new NotFoundException(error.message);
      if (error instanceof SolicitudEnConflictoError) throw new ConflictException(error.message);
      if (error instanceof SolicitudSinPermisoError) throw new ForbiddenException(error.message);
      throw new InternalServerErrorException('No se pudo completar la operación. Intentá nuevamente.');
    }
  }
}
