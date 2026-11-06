import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode,
  Inject, InternalServerErrorException, NotFoundException, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TrainerRequests } from '../application/trainer-requests.js';
import { TrainerRequestConflictError, TrainerRequestNotFoundError, TrainerRequestPermissionError } from '../domain/trainer-request.js';
import { RequireRole, RoleGuard } from './role.guard.js';

function positiveId(value: unknown): number {
  const id = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : value;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1 || id > 4_294_967_295) {
    throw new BadRequestException('El identificador debe ser un entero positivo válido.');
  }
  return id;
}

@Controller('users/trainer-requests')
@UseGuards(RoleGuard)
export class TrainerRequestsController {
  constructor(@Inject(TrainerRequests) private readonly requests: TrainerRequests) {}

  @Get('current')
  @RequireRole('student')
  current(@Req() request: Request) {
    return this.run(() => this.requests.current(request.session.userId!));
  }

  @Get()
  @RequireRole('trainer')
  received(@Req() request: Request) {
    return this.run(() => this.requests.received(request.session.userId!));
  }

  @Post()
  @RequireRole('student')
  send(@Body() body: unknown, @Req() request: Request) {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new BadRequestException('Indicá el entrenador seleccionado.');
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((key) => key !== 'trainerId') || typeof input.trainerId !== 'number') {
      throw new BadRequestException('La solicitud solo admite trainerId como número.');
    }
    const trainerId = positiveId(input.trainerId);
    return this.run(() => this.requests.send(request.session.userId!, trainerId));
  }

  @Post(':id/accept')
  @HttpCode(204)
  @RequireRole('trainer')
  accept(@Param('id') rawId: string, @Req() request: Request) {
    const id = positiveId(rawId);
    return this.run(() => this.requests.respond(id, request.session.userId!, 'accepted'));
  }

  @Post(':id/reject')
  @HttpCode(204)
  @RequireRole('trainer')
  reject(@Param('id') rawId: string, @Req() request: Request) {
    const id = positiveId(rawId);
    return this.run(() => this.requests.respond(id, request.session.userId!, 'rejected'));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireRole(['student', 'trainer'])
  cancel(@Param('id') rawId: string, @Req() request: Request) {
    const id = positiveId(rawId);
    return this.run(() => this.requests.respond(id, request.session.userId!, 'cancelled'));
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error: unknown) {
      if (error instanceof TrainerRequestNotFoundError) throw new NotFoundException(error.message);
      if (error instanceof TrainerRequestConflictError) throw new ConflictException(error.message);
      if (error instanceof TrainerRequestPermissionError) throw new ForbiddenException(error.message);
      throw new InternalServerErrorException('No se pudo completar la operación. Intentá nuevamente.');
    }
  }
}
