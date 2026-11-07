import { parseRouteId } from './parse-route-id.js';
import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Inject, InternalServerErrorException, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequerirRol, GuardiaDeRol } from '../../usuarios/presentacion/guardia-de-rol.js';
import { PlanAccessError } from '../application/training-plans.js';
import { TrainingPrograms } from '../application/training-programs.js';
import { TrainingPlanNotFoundError } from '../domain/training-plan.js';
import { InvalidTrainingProgramError, TrainingProgramAlreadyExistsError } from '../domain/training-program.js';


@Controller('users/students/:studentId/plans/:planId/programs')
@UseGuards(GuardiaDeRol)
export class TrainingProgramsController {
  constructor(@Inject(TrainingPrograms) private readonly programs: TrainingPrograms) { }

  @Get()
  @RequerirRol('entrenador')
  list(@Param('studentId') rawStudentId: string, @Param('planId') rawPlanId: string, @Req() request: Request) {
    const studentId = parseRouteId(rawStudentId),
      planId = parseRouteId(rawPlanId);

    return this.run(() => this.programs.list(request.session.usuarioId!, studentId, planId));
  }

  @Post()
  @RequerirRol('entrenador')
  create(
    @Param('studentId') rawStudentId: string,
    @Param('planId') rawPlanId: string,
    @Body() body: unknown,
    @Req() request: Request
  ) {
    const studentId = parseRouteId(rawStudentId),
      planId = parseRouteId(rawPlanId);

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BadRequestException('Indicá los datos del programa.');
    }

    const input = body as Record<string, unknown>;

    if (Object.keys(input).some((key) => !['name', 'startDate', 'endDate'].includes(key)) || typeof input.name !== 'string' ||
      typeof input.startDate !== 'string' ||
      typeof input.endDate !== 'string') {
      throw new BadRequestException('El programa solo admite name, startDate y endDate como texto.');
    }

    const details = { name: input.name, startDate: input.startDate, endDate: input.endDate };

    return this.run(() => this.programs.create(request.session.usuarioId!, studentId, planId, details));
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    }
    catch (error: unknown) {
      if (error instanceof PlanAccessError) {
        throw new ForbiddenException(error.message);
      }

      if (error instanceof TrainingPlanNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof TrainingProgramAlreadyExistsError) {
        throw new ConflictException(error.message);
      }

      if (error instanceof InvalidTrainingProgramError) {
        throw new BadRequestException({ message: error.message, fieldErrors: error.fieldErrors });
      }

      throw new InternalServerErrorException('No se pudo completar la operación con el programa. Intentá nuevamente.');
    }
  }
}
