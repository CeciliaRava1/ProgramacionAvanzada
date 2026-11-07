import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Inject, InternalServerErrorException, NotFoundException,
  Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { leerIdentificadorDeRuta } from '../../comun/identificador-de-ruta.js';
import { RequerirRol, GuardiaDeRol } from '../../usuarios/presentacion/guardia-de-rol.js';
import { AccesoAPlanDenegadoError } from '../aplicacion/gestionar-planes.js';
import { GestionarEjerciciosDeRutina } from '../aplicacion/gestionar-ejercicios-de-rutina.js';
import { PlanNoEncontradoError } from '../dominio/plan-de-entrenamiento.js';
import { RutinaNoEncontradaError } from '../dominio/rutina.js';
import { EjercicioNoEncontradoError } from '../dominio/ejercicio.js';
import { DatosDeEjercicioDeRutinaInvalidosError, type DatosDeEjercicioDeRutina } from '../dominio/ejercicio-de-rutina.js';

function leerDatos(cuerpo: unknown, creando: boolean): DatosDeEjercicioDeRutina & { ejercicioId?: number } {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new BadRequestException('Indicá los datos del ejercicio.');
  }

  const entrada = cuerpo as Record<string, unknown>;
  const obligatorios = ['cantidadDeSeries', 'repeticionesRecomendadas'];
  const opcionales = ['pesoRecomendadoKg', 'descansoEnSegundos', 'rirRecomendado'];

  if (Object.keys(entrada).some((clave) => !obligatorios.includes(clave) && !opcionales.includes(clave) && !(creando && clave === 'ejercicioId')) ||
    obligatorios.some((clave) => typeof entrada[clave] !== 'number') ||
    opcionales.some((clave) => entrada[clave] !== undefined && entrada[clave] !== null && typeof entrada[clave] !== 'number')) {
    throw new BadRequestException('Los datos del ejercicio no son válidos.');
  }

  return {
    cantidadDeSeries: entrada.cantidadDeSeries as number,
    repeticionesRecomendadas: entrada.repeticionesRecomendadas as number,
    pesoRecomendadoKg: (entrada.pesoRecomendadoKg ?? null) as number | null,
    descansoEnSegundos: (entrada.descansoEnSegundos ?? null) as number | null,
    ...(entrada.rirRecomendado !== undefined ? { rirRecomendado: entrada.rirRecomendado as number | null } : {}),
    ...(creando ? { ejercicioId: leerIdentificadorDeRuta(entrada.ejercicioId) } : {}),
  };
}

@Controller('usuarios/alumnos/:alumnoId/planes/:planId/rutinas/:rutinaId/ejercicios')
@UseGuards(GuardiaDeRol)
export class EjerciciosDeRutinaController {
  constructor(@Inject(GestionarEjerciciosDeRutina) private readonly ejercicios: GestionarEjerciciosDeRutina) { }

  @Get()
  @RequerirRol('entrenador')
  listar(@Param() parametros: Record<string, string>, @Req() peticion: Request) {
    const { alumnoId, planId, rutinaId } = this.identificadores(parametros);

    return this.ejecutar(() => this.ejercicios.listar(peticion.session.usuarioId!, alumnoId, planId, rutinaId));
  }

  @Post()
  @RequerirRol('entrenador')
  agregar(@Param() parametros: Record<string, string>, @Body() cuerpo: unknown, @Req() peticion: Request) {
    const { alumnoId, planId, rutinaId } = this.identificadores(parametros);
    const datos = leerDatos(cuerpo, true);

    return this.ejecutar(() => this.ejercicios.agregar(peticion.session.usuarioId!, alumnoId, planId, rutinaId, datos.ejercicioId!, datos));
  }

  @Put(':id')
  @RequerirRol('entrenador')
  modificar(@Param() parametros: Record<string, string>, @Body() cuerpo: unknown, @Req() peticion: Request) {
    const { alumnoId, planId, rutinaId } = this.identificadores(parametros);
    const id = leerIdentificadorDeRuta(parametros.id);
    const datos = leerDatos(cuerpo, false);

    return this.ejecutar(() => this.ejercicios.modificar(peticion.session.usuarioId!, alumnoId, planId, rutinaId, id, datos));
  }

  private identificadores(parametros: Record<string, string>) {
    return {
      alumnoId: leerIdentificadorDeRuta(parametros.alumnoId),
      planId: leerIdentificadorDeRuta(parametros.planId),
      rutinaId: leerIdentificadorDeRuta(parametros.rutinaId),
    };
  }

  private async ejecutar<T>(accion: () => Promise<T>): Promise<T> {
    try {
      return await accion();
    } catch (error: unknown) {
      if (error instanceof AccesoAPlanDenegadoError) throw new ForbiddenException(error.message);
      if (error instanceof PlanNoEncontradoError || error instanceof RutinaNoEncontradaError || error instanceof EjercicioNoEncontradoError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof DatosDeEjercicioDeRutinaInvalidosError) {
        throw new BadRequestException({ message: error.message, erroresDeCampo: error.erroresDeCampo });
      }
      throw new InternalServerErrorException('No se pudo completar la operación con el ejercicio. Intentá nuevamente.');
    }
  }
}
