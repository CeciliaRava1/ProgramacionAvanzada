import { BadRequestException, Controller, Get, Inject, InternalServerErrorException, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequireRole, RoleGuard } from '../../users/presentation/role.guard.js';
import { StudentPlanning } from '../application/student-planning.js';
import { TrainingRoutineNotFoundError } from '../domain/training-routine.js';

@Controller('users/me/planning')
@UseGuards(RoleGuard)
export class StudentPlanningController {
  constructor(@Inject(StudentPlanning) private readonly planning: StudentPlanning) {}

  @Get()
  @RequireRole('student')
  get(@Req() request: Request) {
    return this.run(() => this.planning.get(request.session.userId!));
  }

  @Get('routines/:routineId')
  @RequireRole('student')
  getRoutine(@Param('routineId') rawId: string, @Req() request: Request) {
    const id = /^\d+$/u.test(rawId) ? Number(rawId) : NaN;
    if (!Number.isSafeInteger(id) || id < 1 || id > 4_294_967_295) throw new BadRequestException('El identificador debe ser válido.');
    return this.run(() => this.planning.getRoutine(request.session.userId!, id));
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error: unknown) {
      if (error instanceof TrainingRoutineNotFoundError) throw new NotFoundException(error.message);
      throw new InternalServerErrorException('No se pudo consultar tu planificación. Intentá nuevamente.');
    }
  }
}
