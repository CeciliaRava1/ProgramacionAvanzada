import { parseRouteId } from './parse-route-id.js';
import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, Inject,
  InternalServerErrorException, NotFoundException, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RequireRole, RoleGuard } from '../../users/presentation/role.guard.js';
import { PlanAccessError, TrainingPlans } from '../application/training-plans.js';
import { InvalidTrainingPlanError, TrainingPlanAlreadyExistsError, TrainingPlanNotFoundError } from '../domain/training-plan.js';


function planDetails(body: unknown): {
  name: string;
  objective: string;
} {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Indicá el nombre y el objetivo del plan.');
  }

  const input = body as Record<string, unknown>;

  if (Object.keys(input).some((key) => !['name', 'objective'].includes(key)) || typeof input.name !== 'string' ||
    typeof input.objective !== 'string') {
    throw new BadRequestException('El plan solo admite name y objective como texto.');
  }

  return { name: input.name, objective: input.objective };
}

@Controller('users/students/:studentId/plans')
@UseGuards(RoleGuard)
export class PlansController {
  constructor(@Inject(TrainingPlans) private readonly plans: TrainingPlans) { }

  @Get()
  @RequireRole('trainer')
  list(@Param('studentId') rawId: string, @Req() request: Request) {
    const id = parseRouteId(rawId);

    return this.run(() => this.plans.list(request.session.userId!, id));
  }

  @Post()
  @RequireRole('trainer')
  create(@Param('studentId') rawId: string, @Body() body: unknown, @Req() request: Request) {
    const id = parseRouteId(rawId);
    const details = planDetails(body);

    return this.run(() => this.plans.create(request.session.userId!, id, details));
  }

  @Put(':planId')
  @RequireRole('trainer')
  update(
    @Param('studentId') rawStudentId: string,
    @Param('planId') rawPlanId: string,
    @Body() body: unknown,
    @Req() request: Request
  ) {
    const id = parseRouteId(rawPlanId),
      studentId = parseRouteId(rawStudentId),
      details = planDetails(body);

    return this.run(() => this.plans.update(request.session.userId!, studentId, id, details));
  }

  @Delete(':planId')
  @HttpCode(204)
  @RequireRole('trainer')
  remove(@Param('studentId') rawStudentId: string, @Param('planId') rawPlanId: string, @Req() request: Request) {
    const id = parseRouteId(rawPlanId),
      studentId = parseRouteId(rawStudentId);

    return this.run(() => this.plans.remove(request.session.userId!, studentId, id));
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

      if (error instanceof TrainingPlanAlreadyExistsError) {
        throw new ConflictException(error.message);
      }

      if (error instanceof InvalidTrainingPlanError) {
        throw new BadRequestException({ message: error.message, fieldErrors: error.fieldErrors });
      }

      throw new InternalServerErrorException('No se pudo completar la operación con el plan. Intentá nuevamente.');
    }
  }
}
