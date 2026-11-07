import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject,
  InternalServerErrorException, Post, Req, Res, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CredencialesInvalidasError, IniciarSesion } from '../aplicacion/iniciar-sesion.js';
import { RepositorioDeUsuarios } from '../dominio/repositorio-de-usuarios.js';
import { esRolDeUsuario } from '../dominio/usuario.js';
import { NOMBRE_DE_COOKIE_DE_SESION, RUTA_DE_COOKIE_DE_SESION } from './middleware-de-sesion.js';

@Controller('usuarios/sesion')
export class SesionController {
  constructor(
    @Inject(IniciarSesion) private readonly iniciarSesion: IniciarSesion,
    @Inject(RepositorioDeUsuarios) private readonly usuarios: RepositorioDeUsuarios,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async crear(@Body() cuerpo: unknown, @Req() peticion: Request) {
    if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) throw new BadRequestException('Ingresá correo y contraseña.');
    const entrada = cuerpo as Record<string, unknown>;
    if (Object.keys(entrada).some((clave) => !['correo', 'contrasena', 'rol'].includes(clave)) ||
        typeof entrada.correo !== 'string' || entrada.correo.trim().length < 1 || [...entrada.correo.trim()].length > 254 ||
        typeof entrada.contrasena !== 'string' || entrada.contrasena.length < 1 || [...entrada.contrasena].length > 128 ||
        !esRolDeUsuario(entrada.rol)) {
      throw new BadRequestException('Ingresá un correo, una contraseña y un rol válidos.');
    }
    try {
      const usuario = await this.iniciarSesion.ejecutar(entrada.correo, entrada.contrasena, entrada.rol);
      // Renovar el identificador evita conservar una sesión anterior al autenticarse.
      await new Promise<void>((resolver, rechazar) => peticion.session.regenerate((error) => error ? rechazar(error) : resolver()));
      peticion.session.usuarioId = usuario.id;
      await new Promise<void>((resolver, rechazar) => peticion.session.save((error) => error ? rechazar(error) : resolver()));
      return usuario;
    } catch (error: unknown) {
      if (error instanceof CredencialesInvalidasError) throw new UnauthorizedException(error.message);
      throw new InternalServerErrorException('No se pudo iniciar sesión. Intentá nuevamente.');
    }
  }

  @Get()
  async actual(@Req() peticion: Request) {
    const id = peticion.session.usuarioId;
    if (!Number.isSafeInteger(id) || !id) throw new UnauthorizedException('No hay una sesión activa.');
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario?.id || usuario.fechaBaja) {
      await new Promise<void>((resolver, rechazar) => peticion.session.destroy((error) => error ? rechazar(error) : resolver()));
      throw new UnauthorizedException('No hay una sesión activa.');
    }
    return { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, correo: usuario.correo, rol: usuario.rol };
  }

  @Delete()
  @HttpCode(204)
  async cerrar(@Req() peticion: Request, @Res({ passthrough: true }) respuesta: Response) {
    await new Promise<void>((resolver, rechazar) => peticion.session.destroy((error) => error ? rechazar(error) : resolver()));
    respuesta.clearCookie(NOMBRE_DE_COOKIE_DE_SESION, { path: RUTA_DE_COOKIE_DE_SESION });
  }
}
