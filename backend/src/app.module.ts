import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { UsersModule } from './users/users.module.js';
import { PlansModule } from './plans/plans.module.js';

@Module({
  imports: [DatabaseModule, UsersModule, PlansModule],
  controllers: [HealthController],
})
export class AppModule {}
