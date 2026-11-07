import {
  BadRequestException, Body, ConflictException, Controller, Get, Inject,
  InternalServerErrorException, Post, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RegistrarUsuario, type UsuarioRegistrado } from '../aplicacion/registrar-usuario.js';
import { DatosDeUsuarioInvalidosError } from '../dominio/usuario.js';
import { CorreoYaRegistradoError } from '../dominio/repositorio-de-usuarios.js';
import { parsearRegistroDeUsuario } from './registrar-usuario.request.js';
import { RequerirRol, GuardiaDeRol } from './guardia-de-rol.js';
import { ListarEntrenadores } from '../aplicacion/listar-entrenadores.js';
import { ListarAlumnosAsignados } from '../aplicacion/listar-alumnos-asignados.js';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    @Inject(RegistrarUsuario) private readonly registrarUsuario: RegistrarUsuario,
    @Inject(ListarEntrenadores) private readonly listarEntrenadores: ListarEntrenadores,
    @Inject(ListarAlumnosAsignados) private readonly listarAlumnosAsignados: ListarAlumnosAsignados,
  ) {}

  @Post('alumnos')
  @UseGuards(GuardiaDeRol)
  @RequerirRol('administrador')
  async registrar(@Body() cuerpo: unknown) {
    return this.registrarCuenta(cuerpo, 'alumno');
  }

  @Post('entrenadores')
  @UseGuards(GuardiaDeRol)
  @RequerirRol('administrador')
  async registrarEntrenador(@Body() cuerpo: unknown) {
    return this.registrarCuenta(cuerpo, 'entrenador');
  }

  @Get('entrenadores')
  @UseGuards(GuardiaDeRol)
  @RequerirRol('alumno')
  async entrenadores() {
    try {
      return await this.listarEntrenadores.ejecutar();
    } catch {
      throw new InternalServerErrorException('No se pudo consultar el listado de entrenadores. Intentá nuevamente.');
    }
  }

  @Get('alumnos')
  @UseGuards(GuardiaDeRol)
  @RequerirRol('entrenador')
  async alumnos(@Req() peticion: Request) {
    try {
      return await this.listarAlumnosAsignados.ejecutar(peticion.session.usuarioId!);
    } catch {
      throw new InternalServerErrorException('No se pudo consultar el listado de alumnos. Intentá nuevamente.');
    }
  }

  private async registrarCuenta(cuerpo: unknown, rol: UsuarioRegistrado['rol']) {
    const entrada = parsearRegistroDeUsuario(cuerpo, rol);
    try {
      return await this.registrarUsuario.ejecutar(entrada, rol);
    } catch (error: unknown) {
      if (error instanceof DatosDeUsuarioInvalidosError) {
        throw new BadRequestException({ message: error.message, erroresDeCampo: error.erroresDeCampo });
      }
      if (error instanceof CorreoYaRegistradoError) {
        throw new ConflictException({ message: error.message, erroresDeCampo: { correo: error.message } });
      }
      // No exponer consultas, credenciales ni detalles del driver en la respuesta.
      throw new InternalServerErrorException('No se pudo registrar la cuenta. Intentá nuevamente.');
    }
  }
}
