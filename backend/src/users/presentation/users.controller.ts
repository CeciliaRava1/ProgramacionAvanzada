import {
  BadRequestException, Body, ConflictException, Controller, Get, Inject,
  InternalServerErrorException, Post, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RegisterUser, type RegisteredUser } from '../application/register-user.js';
import { InvalidUserDataError } from '../domain/user.js';
import { EmailAlreadyRegisteredError } from '../domain/user.repository.js';
import { parseRegisterUserRequest } from './register-user.request.js';
import { RequireRole, RoleGuard } from './role.guard.js';
import { ListTrainers } from '../application/list-trainers.js';
import { ListAssignedStudents } from '../application/list-assigned-students.js';

@Controller('users')
export class UsersController {
  constructor(
    @Inject(RegisterUser) private readonly registerUser: RegisterUser,
    @Inject(ListTrainers) private readonly listTrainers: ListTrainers,
    @Inject(ListAssignedStudents) private readonly listAssignedStudents: ListAssignedStudents,
  ) {}

  @Post('students')
  async register(@Body() body: unknown) {
    return this.registerAccount(body, 'student');
  }

  @Post('trainers')
  @UseGuards(RoleGuard)
  @RequireRole('admin')
  async registerTrainer(@Body() body: unknown) {
    return this.registerAccount(body, 'trainer');
  }

  @Get('trainers')
  @UseGuards(RoleGuard)
  @RequireRole('student')
  async trainers() {
    try {
      return await this.listTrainers.execute();
    } catch {
      throw new InternalServerErrorException('No se pudo consultar el listado de entrenadores. Intentá nuevamente.');
    }
  }

  @Get('students')
  @UseGuards(RoleGuard)
  @RequireRole('trainer')
  async students(@Req() request: Request) {
    try {
      return await this.listAssignedStudents.execute(request.session.userId!);
    } catch {
      throw new InternalServerErrorException('No se pudo consultar el listado de alumnos. Intentá nuevamente.');
    }
  }

  private async registerAccount(body: unknown, role: RegisteredUser['role']) {
    const input = parseRegisterUserRequest(body, role);
    try {
      return await this.registerUser.execute(input, role);
    } catch (error: unknown) {
      if (error instanceof InvalidUserDataError) {
        throw new BadRequestException({ message: error.message, fieldErrors: error.fieldErrors });
      }
      if (error instanceof EmailAlreadyRegisteredError) {
        throw new ConflictException({ message: error.message, fieldErrors: { email: error.message } });
      }
      // No exponer consultas, credenciales ni detalles del driver en la respuesta.
      throw new InternalServerErrorException('No se pudo registrar la cuenta. Intentá nuevamente.');
    }
  }
}
