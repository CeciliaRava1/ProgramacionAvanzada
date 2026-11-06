import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, InternalServerErrorException, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequireRole, RoleGuard } from '../../users/presentation/role.guard.js';
import { PlanAccessError } from '../application/training-plans.js';
import { RoutineExercises } from '../application/routine-exercises.js';
import { TrainingPlanNotFoundError } from '../domain/training-plan.js';
import { TrainingProgramNotFoundError, TrainingRoutineNotFoundError } from '../domain/training-routine.js';
import { ExerciseNotFoundError } from '../domain/exercise.js';
import { InvalidRoutineExerciseError, type RoutineExerciseInput } from '../domain/routine-exercise.js';

function positiveId(raw: unknown): number {
  const id = typeof raw === 'string' && /^\d+$/u.test(raw) ? Number(raw) : typeof raw === 'number' ? raw : NaN;

  if (!Number.isSafeInteger(id) || id < 1 || id > 4_294_967_295) {
    throw new BadRequestException('El identificador debe ser válido.');
  }

  return id;
}

function details(body: unknown, creating: boolean): RoutineExerciseInput & {
  exerciseId?: number;
} {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Indicá los datos del ejercicio.');
  }

  const input = body as Record<string, unknown>;
  const required = ['setCount', 'recommendedRepetitions'],
    optional = ['recommendedWeightKg', 'restSeconds', 'recommendedRir'];

  if (Object.keys(input).some(key => !required.includes(key) && !optional.includes(key) && !(creating && key === 'exerciseId')) ||
    required.some(key => typeof input[key] !== 'number') ||
    optional.some(key => input[key] !== undefined && input[key] !== null && typeof input[key] !== 'number')) {
    throw new BadRequestException('Los datos del ejercicio no son válidos.');
  }

  return {
    setCount: input.setCount as number,
    recommendedRepetitions: input.recommendedRepetitions as number,
    recommendedWeightKg: (input.recommendedWeightKg ?? null) as number | null,
    restSeconds: (input.restSeconds ?? null) as number | null,
    ...(input.recommendedRir !== undefined ? { recommendedRir: input.recommendedRir as number | null } : {}),
    ...(creating ? { exerciseId: positiveId(input.exerciseId) } : {})
  };
}

@Controller('users/students/:studentId/plans/:planId/programs/:programId/routines/:routineId/exercises')
@UseGuards(RoleGuard)
export class RoutineExercisesController {
  constructor(@Inject(RoutineExercises) private readonly entries: RoutineExercises) { }

  @Get()
  @RequireRole('trainer')
  list(@Param() params: Record<string, string>, @Req() request: Request) {
    const { studentId, planId, programId, routineId } = this.ids(params);

    return this.run(() => this.entries.list(request.session.userId!, studentId, planId, programId, routineId));
  }

  @Post()
  @RequireRole('trainer')
  create(@Param() params: Record<string, string>, @Body() body: unknown, @Req() request: Request) {
    const { studentId, planId, programId, routineId } = this.ids(params),
      input = details(body, true);

    return this.run(() => this.entries.create(request.session.userId!, studentId, planId, programId, routineId, input.exerciseId!, input));
  }

  @Put(':id')
  @RequireRole('trainer')
  update(@Param() params: Record<string, string>, @Body() body: unknown, @Req() request: Request) {
    const { studentId, planId, programId, routineId } = this.ids(params),
      id = positiveId(params.id),
      input = details(body, false);

    return this.run(() => this.entries.update(request.session.userId!, studentId, planId, programId, routineId, id, input));
  }

  private ids(params: Record<string, string>) {
    return {
      studentId: positiveId(params.studentId),
      planId: positiveId(params.planId),
      programId: positiveId(params.programId),
      routineId: positiveId(params.routineId),
    };
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    }
    catch (error: unknown) {
      if (error instanceof PlanAccessError) {
        throw new ForbiddenException(error.message);
      }

      if (error instanceof TrainingPlanNotFoundError || error instanceof TrainingProgramNotFoundError || error instanceof TrainingRoutineNotFoundError ||
        error instanceof ExerciseNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof InvalidRoutineExerciseError) {
        throw new BadRequestException({ message: error.message, fieldErrors: error.fieldErrors });
      }

      throw new InternalServerErrorException('No se pudo completar la operación con el ejercicio. Intentá nuevamente.');
    }
  }
}
