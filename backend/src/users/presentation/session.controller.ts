import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject,
  InternalServerErrorException, Post, Req, Res, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { InvalidCredentialsError, SignIn } from '../application/sign-in.js';
import { UserRepository } from '../domain/user.repository.js';
import { sessionCookieName, sessionCookiePath } from './session.middleware.js';

@Controller('users/session')
export class SessionController {
  constructor(
    @Inject(SignIn) private readonly signIn: SignIn,
    @Inject(UserRepository) private readonly users: UserRepository,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async create(@Body() body: unknown, @Req() request: Request) {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new BadRequestException('Ingresá correo y contraseña.');
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((key) => !['email', 'password'].includes(key)) ||
        typeof input.email !== 'string' || input.email.trim().length < 1 || [...input.email.trim()].length > 254 ||
        typeof input.password !== 'string' || input.password.length < 1 || [...input.password].length > 128) {
      throw new BadRequestException('Ingresá un correo y una contraseña válidos.');
    }
    try {
      const user = await this.signIn.execute(input.email, input.password);
      // Renovar el identificador evita conservar una sesión anterior al autenticarse.
      await new Promise<void>((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()));
      request.session.userId = user.id;
      await new Promise<void>((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()));
      return user;
    } catch (error: unknown) {
      if (error instanceof InvalidCredentialsError) throw new UnauthorizedException(error.message);
      throw new InternalServerErrorException('No se pudo iniciar sesión. Intentá nuevamente.');
    }
  }

  @Get()
  async current(@Req() request: Request) {
    const id = request.session.userId;
    if (!Number.isSafeInteger(id) || !id) throw new UnauthorizedException('No hay una sesión activa.');
    const user = await this.users.findById(id);
    if (!user?.id) {
      await new Promise<void>((resolve, reject) => request.session.destroy((error) => error ? reject(error) : resolve()));
      throw new UnauthorizedException('No hay una sesión activa.');
    }
    return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role };
  }

  @Delete()
  @HttpCode(204)
  async close(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await new Promise<void>((resolve, reject) => request.session.destroy((error) => error ? reject(error) : resolve()));
    response.clearCookie(sessionCookieName, { path: sessionCookiePath });
  }
}
