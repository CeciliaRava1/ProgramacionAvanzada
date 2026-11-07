import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { RegistrarUsuario } from './aplicacion/registrar-usuario.js';
import { RepositorioDeUsuarios } from './dominio/repositorio-de-usuarios.js';
import { hashearContrasena, verificarContrasena } from './infraestructura/hash-de-contrasena.js';
import { RepositorioDeUsuariosTypeOrm } from './infraestructura/repositorio-de-usuarios-typeorm.js';
import { UsuariosController } from './presentacion/usuarios.controller.js';
import { IniciarSesion } from './aplicacion/iniciar-sesion.js';
import { SesionController } from './presentacion/sesion.controller.js';
import { crearMiddlewareDeSesion } from './presentacion/middleware-de-sesion.js';
import { GuardiaDeRol } from './presentacion/guardia-de-rol.js';
import { ListarEntrenadores } from './aplicacion/listar-entrenadores.js';
import { ListarAlumnosAsignados } from './aplicacion/listar-alumnos-asignados.js';
import { SolicitudesDeEntrenador } from './aplicacion/solicitudes-de-entrenador.js';
import { RepositorioDeSolicitudes } from './dominio/repositorio-de-solicitudes.js';
import { RepositorioDeSolicitudesTypeOrm } from './infraestructura/repositorio-de-solicitudes-typeorm.js';
import { SolicitudesDeEntrenadorController } from './presentacion/solicitudes-de-entrenador.controller.js';
import { GestionarCuentas } from './aplicacion/gestionar-cuentas.js';
import { CuentasController } from './presentacion/cuentas.controller.js';

@Module({
  // shortcut: el límite de intentos es por proceso; compartirlo al desplegar varias instancias.
  imports: [ConfigModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
  controllers: [UsuariosController, SesionController, SolicitudesDeEntrenadorController, CuentasController],
  exports: [GuardiaDeRol, RepositorioDeUsuarios, RepositorioDeSolicitudes],
  providers: [
    ThrottlerGuard,
    GuardiaDeRol,
    {
      provide: RepositorioDeSolicitudes,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => new RepositorioDeSolicitudesTypeOrm(dataSource),
    },
    {
      provide: SolicitudesDeEntrenador,
      inject: [RepositorioDeUsuarios, RepositorioDeSolicitudes],
      useFactory: (usuarios: RepositorioDeUsuarios, solicitudes: RepositorioDeSolicitudes) => new SolicitudesDeEntrenador(usuarios, solicitudes),
    },
    {
      provide: RepositorioDeUsuarios,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => new RepositorioDeUsuariosTypeOrm(dataSource),
    },
    {
      provide: RegistrarUsuario,
      inject: [RepositorioDeUsuarios],
      useFactory: (usuarios: RepositorioDeUsuarios) => new RegistrarUsuario(usuarios, hashearContrasena),
    },
    {
      provide: GestionarCuentas,
      inject: [RepositorioDeUsuarios],
      useFactory: (usuarios: RepositorioDeUsuarios) => new GestionarCuentas(usuarios),
    },
    {
      provide: ListarEntrenadores,
      inject: [RepositorioDeUsuarios],
      useFactory: (usuarios: RepositorioDeUsuarios) => new ListarEntrenadores(usuarios),
    },
    {
      provide: ListarAlumnosAsignados,
      inject: [RepositorioDeSolicitudes],
      useFactory: (solicitudes: RepositorioDeSolicitudes) => new ListarAlumnosAsignados(solicitudes),
    },
    {
      provide: IniciarSesion,
      inject: [RepositorioDeUsuarios],
      useFactory: (usuarios: RepositorioDeUsuarios) => new IniciarSesion(usuarios, verificarContrasena),
    },
  ],
})
export class UsuariosModule implements NestModule {
  constructor(private readonly config: ConfigService, private readonly dataSource: DataSource) {}

  configure(consumidor: MiddlewareConsumer): void {
    consumidor.apply(crearMiddlewareDeSesion(this.config, this.dataSource)).forRoutes(
      SesionController,
      SolicitudesDeEntrenadorController,
      CuentasController,
      UsuariosController,
    );
  }
}
