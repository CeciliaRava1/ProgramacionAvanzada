import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { RepositorioDeSolicitudes } from '../usuarios/dominio/repositorio-de-solicitudes.js';
import { crearMiddlewareDeSesion } from '../usuarios/presentacion/middleware-de-sesion.js';
import { CatalogoDeEjercicios } from './aplicacion/catalogo-de-ejercicios.js';
import { GestionarEjerciciosDeRutina } from './aplicacion/gestionar-ejercicios-de-rutina.js';
import { GestionarPlanes } from './aplicacion/gestionar-planes.js';
import { GestionarRutinas } from './aplicacion/gestionar-rutinas.js';
import { PlanificacionDelAlumno } from './aplicacion/planificacion-del-alumno.js';
import { RepositorioDeEjercicios } from './dominio/repositorio-de-ejercicios.js';
import { RepositorioDeEjerciciosDeRutina } from './dominio/repositorio-de-ejercicios-de-rutina.js';
import { RepositorioDePlanes } from './dominio/repositorio-de-planes.js';
import { RepositorioDeRutinas } from './dominio/repositorio-de-rutinas.js';
import { RepositorioDeEjerciciosDeRutinaTypeOrm } from './infraestructura/repositorio-de-ejercicios-de-rutina-typeorm.js';
import { RepositorioDeEjerciciosTypeOrm } from './infraestructura/repositorio-de-ejercicios-typeorm.js';
import { RepositorioDePlanesTypeOrm } from './infraestructura/repositorio-de-planes-typeorm.js';
import { RepositorioDeRutinasTypeOrm } from './infraestructura/repositorio-de-rutinas-typeorm.js';
import { EjerciciosController } from './presentacion/ejercicios.controller.js';
import { EjerciciosDeRutinaController } from './presentacion/ejercicios-de-rutina.controller.js';
import { PlanesController } from './presentacion/planes.controller.js';
import { PlanificacionDelAlumnoController } from './presentacion/planificacion-del-alumno.controller.js';
import { RutinasController } from './presentacion/rutinas.controller.js';

const controladores = [PlanesController, RutinasController, EjerciciosController, EjerciciosDeRutinaController, PlanificacionDelAlumnoController];

@Module({
  imports: [ConfigModule, UsuariosModule],
  controllers: controladores,
  providers: [
    { provide: RepositorioDePlanes, inject: [DataSource], useFactory: (baseDeDatos: DataSource) => new RepositorioDePlanesTypeOrm(baseDeDatos) },
    { provide: RepositorioDeRutinas, inject: [DataSource], useFactory: (baseDeDatos: DataSource) => new RepositorioDeRutinasTypeOrm(baseDeDatos) },
    { provide: RepositorioDeEjercicios, inject: [DataSource], useFactory: (baseDeDatos: DataSource) => new RepositorioDeEjerciciosTypeOrm(baseDeDatos) },
    { provide: RepositorioDeEjerciciosDeRutina, inject: [DataSource], useFactory: (baseDeDatos: DataSource) => new RepositorioDeEjerciciosDeRutinaTypeOrm(baseDeDatos) },
    { provide: CatalogoDeEjercicios, inject: [RepositorioDeEjercicios], useFactory: (ejercicios: RepositorioDeEjercicios) => new CatalogoDeEjercicios(ejercicios) },
    { provide: GestionarPlanes, inject: [RepositorioDePlanes, RepositorioDeSolicitudes], useFactory: (planes: RepositorioDePlanes, solicitudes: RepositorioDeSolicitudes) => new GestionarPlanes(planes, solicitudes) },
    { provide: GestionarRutinas, inject: [RepositorioDeRutinas, GestionarPlanes], useFactory: (rutinas: RepositorioDeRutinas, planes: GestionarPlanes) => new GestionarRutinas(rutinas, planes) },
    {
      provide: GestionarEjerciciosDeRutina,
      inject: [RepositorioDeEjerciciosDeRutina, RepositorioDeEjercicios, GestionarRutinas],
      useFactory: (ejerciciosDeRutina: RepositorioDeEjerciciosDeRutina, catalogo: RepositorioDeEjercicios, rutinas: GestionarRutinas) => new GestionarEjerciciosDeRutina(ejerciciosDeRutina, catalogo, rutinas),
    },
    {
      provide: PlanificacionDelAlumno,
      inject: [RepositorioDePlanes, RepositorioDeRutinas, RepositorioDeEjerciciosDeRutina],
      useFactory: (planes: RepositorioDePlanes, rutinas: RepositorioDeRutinas, ejerciciosDeRutina: RepositorioDeEjerciciosDeRutina) => new PlanificacionDelAlumno(planes, rutinas, ejerciciosDeRutina),
    },
  ],
})
export class PlanesModule implements NestModule {
  constructor(private readonly config: ConfigService, private readonly baseDeDatos: DataSource) {}

  configure(consumidor: MiddlewareConsumer): void {
    consumidor.apply(crearMiddlewareDeSesion(this.config, this.baseDeDatos)).forRoutes(...controladores);
  }
}
