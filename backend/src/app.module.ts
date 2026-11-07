import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { BaseDeDatosModule } from './infraestructura/base-de-datos/base-de-datos.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { PlanesModule } from './planes/planes.module.js';

@Module({
  imports: [BaseDeDatosModule, UsuariosModule, PlanesModule],
  controllers: [HealthController],
})
export class AppModule {}
