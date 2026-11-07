import {
  type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { RepositorioDeUsuarios } from '../dominio/repositorio-de-usuarios.js';
import type { RolDeUsuario } from '../dominio/usuario.js';

export const RequerirRol = Reflector.createDecorator<RolDeUsuario | RolDeUsuario[]>();

/** Comprueba el rol actual de la cuenta contra el exigido por el endpoint. */
@Injectable()
export class GuardiaDeRol implements CanActivate {
  constructor(
    @Inject(RepositorioDeUsuarios) private readonly usuarios: RepositorioDeUsuarios,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const peticion = contexto.switchToHttp().getRequest<Request>();
    const id = peticion.session?.usuarioId;
    if (!Number.isSafeInteger(id) || !id) throw new UnauthorizedException('Iniciá sesión para continuar.');
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario || usuario.fechaBaja) throw new UnauthorizedException('Iniciá sesión para continuar.');
    const rolRequerido = this.reflector.get(RequerirRol, contexto.getHandler());
    const rolesPermitidos = Array.isArray(rolRequerido) ? rolRequerido : [rolRequerido];
    if (!rolRequerido || !rolesPermitidos.includes(usuario.rol)) throw new ForbiddenException('No tenés permiso para realizar esta operación.');
    return true;
  }
}
