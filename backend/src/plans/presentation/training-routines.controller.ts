import { parseRouteId } from './parse-route-id.js';
import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, InternalServerErrorException, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequireRole, RoleGuard } from '../../users/presentation/role.guard.js';
import { PlanAccessError } from '../application/training-plans.js';
import { TrainingRoutines } from '../application/training-routines.js';
import { TrainingPlanNotFoundError } from '../domain/training-plan.js';
import { InvalidTrainingRoutineError, TrainingProgramNotFoundError, TrainingRoutineNotFoundError, type TrainingRoutineInput } from '../domain/training-routine.js';


function routineDetails(body: unknown): TrainingRoutineInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Indicá los datos de la rutina.');
  }

  const input = body as Record<string, unknown>;

  if (Object.keys(input).some((key) => !['name', 'description'].includes(key)) || typeof input.name !== 'string' ||
    (input.description !== undefined && input.description !== null && typeof input.description !== 'string')) {
    throw new BadRequestException('La rutina solo admite name y description como texto; description es opcional.');
  }

  return { name: input.name, description: input.description as string | null | undefined };
}

@Controller('users/students/:studentId/plans/:planId/programs/:programId/routines')
@UseGuards(RoleGuard)
export class TrainingRoutinesController {
  constructor(@Inject(TrainingRoutines) private readonly routines: TrainingRoutines) { }

  @Get()
  @RequireRole('trainer')
  list(
    @Param('studentId') rawStudentId: string,
    @Param('planId') rawPlanId: string,
    @Param('programId') rawProgramId: string,
    @Req() request: Request
  ) {
    const studentId = parseRouteId(rawStudentId),
      planId = parseRouteId(rawPlanId),
      programId = parseRouteId(rawProgramId);

    return this.run(() => this.routines.list(request.session.userId!, studentId, planId, programId));
  }

  @Post()
  @RequireRole('trainer')
  create(
    @Param('studentId') rawStudentId: string,
    @Param('planId') rawPlanId: string,
    @Param('programId') rawProgramId: string,
    @Body() body: unknown,
    @Req() request: Request
  ) {
    const studentId = parseRouteId(rawStudentId),
      planId = parseRouteId(rawPlanId),
      programId = parseRouteId(rawProgramId);
    const details = routineDetails(body);

    return this.run(() => this.routines.create(request.session.userId!, studentId, planId, programId, details));
  }

  @Put(':routineId')
  @RequireRole('trainer')
  update(
    @Param('studentId') rawStudentId: string,
    @Param('planId') rawPlanId: string,
    @Param('programId') rawProgramId: string,
    @Param('routineId') rawRoutineId: string,
    @Body() body: unknown,
    @Req() request: Request
  ) {
    const studentId = parseRouteId(rawStudentId),
      planId = parseRouteId(rawPlanId),
      programId = parseRouteId(rawProgramId),
      id = parseRouteId(rawRoutineId);
    const details = routineDetails(body);

    return this.run(() => this.routines.update(request.session.userId!, studentId, planId, programId, id, details));
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    }
    catch (error: unknown) {
      if (error instanceof PlanAccessError) {
        throw new ForbiddenException(error.message);
      }

      if (error instanceof TrainingPlanNotFoundError || error instanceof TrainingProgramNotFoundError || error instanceof TrainingRoutineNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof InvalidTrainingRoutineError) {
        throw new BadRequestException({ message: error.message, fieldErrors: error.fieldErrors });
      }

      throw new InternalServerErrorException('No se pudo completar la operación con las rutinas. Intentá nuevamente.');
    }
  }
}
