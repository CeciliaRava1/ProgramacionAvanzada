import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { RegisterUser } from './application/register-user.js';
import { UserRepository } from './domain/user.repository.js';
import { hashPassword, verifyPassword } from './infrastructure/hash-password.js';
import { TypeOrmUserRepository } from './infrastructure/typeorm-user.repository.js';
import { UsersController } from './presentation/users.controller.js';
import { SignIn } from './application/sign-in.js';
import { SessionController } from './presentation/session.controller.js';
import { createSessionMiddleware } from './presentation/session.middleware.js';
import { RoleGuard } from './presentation/role.guard.js';
import { ListTrainers } from './application/list-trainers.js';
import { ListAssignedStudents } from './application/list-assigned-students.js';
import { TrainerRequests } from './application/trainer-requests.js';
import { TrainerRequestRepository } from './domain/trainer-request.repository.js';
import { TypeOrmTrainerRequestRepository } from './infrastructure/typeorm-trainer-request.repository.js';
import { TrainerRequestsController } from './presentation/trainer-requests.controller.js';

@Module({
  // shortcut: el límite de intentos es por proceso; compartirlo al desplegar varias instancias.
  imports: [ConfigModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
  controllers: [UsersController, SessionController, TrainerRequestsController],
  exports: [RoleGuard, UserRepository, TrainerRequestRepository],
  providers: [
    ThrottlerGuard,
    RoleGuard,
    {
      provide: TrainerRequestRepository,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => new TypeOrmTrainerRequestRepository(dataSource),
    },
    {
      provide: TrainerRequests,
      inject: [UserRepository, TrainerRequestRepository],
      useFactory: (users: UserRepository, requests: TrainerRequestRepository) => new TrainerRequests(users, requests),
    },
    {
      provide: UserRepository,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => new TypeOrmUserRepository(dataSource),
    },
    {
      provide: RegisterUser,
      inject: [UserRepository],
      useFactory: (users: UserRepository) => new RegisterUser(users, hashPassword),
    },
    {
      provide: ListTrainers,
      inject: [UserRepository],
      useFactory: (users: UserRepository) => new ListTrainers(users),
    },
    {
      provide: ListAssignedStudents,
      inject: [TrainerRequestRepository],
      useFactory: (requests: TrainerRequestRepository) => new ListAssignedStudents(requests),
    },
    {
      provide: SignIn,
      inject: [UserRepository],
      useFactory: (users: UserRepository) => new SignIn(users, verifyPassword),
    },
  ],
})
export class UsersModule implements NestModule {
  constructor(private readonly config: ConfigService, private readonly dataSource: DataSource) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(createSessionMiddleware(this.config, this.dataSource)).forRoutes(
      SessionController,
      TrainerRequestsController,
      { path: 'users/trainers', method: RequestMethod.POST },
      { path: 'users/trainers', method: RequestMethod.GET },
      { path: 'users/students', method: RequestMethod.GET },
    );
  }
}
