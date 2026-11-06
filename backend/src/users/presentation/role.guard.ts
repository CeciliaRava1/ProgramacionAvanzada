import {
  type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { UserRepository } from '../domain/user.repository.js';
import type { UserRole } from '../domain/user.js';

export const RequireRole = Reflector.createDecorator<UserRole | UserRole[]>();

/** Comprueba el rol actual de la cuenta contra el exigido por el endpoint. */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    @Inject(UserRepository) private readonly users: UserRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const id = request.session?.userId;
    if (!Number.isSafeInteger(id) || !id) throw new UnauthorizedException('Iniciá sesión para continuar.');
    const user = await this.users.findById(id);
    if (!user) throw new UnauthorizedException('Iniciá sesión para continuar.');
    const requiredRole = this.reflector.get(RequireRole, context.getHandler());
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!requiredRole || !allowedRoles.includes(user.role)) throw new ForbiddenException('No tenés permiso para realizar esta operación.');
    return true;
  }
}
