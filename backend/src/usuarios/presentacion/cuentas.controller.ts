import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Inject,
  InternalServerErrorException, NotFoundException, Param, Put, UseGuards,
} from '@nestjs/common';
import {
  CuentaDadaDeBajaError, CuentaNoEncontradaError, GestionarCuentas, type ResumenDeCuenta,
} from '../aplicacion/gestionar-cuentas.js';
import { DatosDeUsuarioInvalidosError } from '../dominio/usuario.js';
import { CorreoYaRegistradoError, type RolGestionado } from '../dominio/repositorio-de-usuarios.js';
import { leerIdentificadorDeRuta } from '../../comun/identificador-de-ruta.js';
import { RequerirRol, GuardiaDeRol } from './guardia-de-rol.js';
import { parsearModificacionDeCuenta } from './modificar-cuenta.request.js';

const rolesPorTipo: Record<string, RolGestionado> = { alumnos: 'alumno', entrenadores: 'entrenador' };

function rolDe(tipo: string): RolGestionado {
  const rol = rolesPorTipo[tipo];
  if (!rol) throw new NotFoundException();
  return rol;
}

/** Gestión de alumnos y entrenadores exclusiva del administrador. */
@Controller('usuarios/administrador')
export class CuentasController {
  constructor(@Inject(GestionarCuentas) private readonly cuentas: GestionarCuentas) {}

  @Get(':tipo')
  @UseGuards(GuardiaDeRol)
  @RequerirRol('administrador')
  async listar(@Param('tipo') tipo: string): Promise<ResumenDeCuenta[]> {
    const rol = rolDe(tipo);
    try {
      return await this.cuentas.listar(rol);
    } catch {
      throw new InternalServerErrorException('No se pudo consultar el listado. Intentá nuevamente.');
    }
  }

  @Put(':tipo/:id')
  @UseGuards(GuardiaDeRol)
  @RequerirRol('administrador')
  async modificar(@Param('tipo') tipo: string, @Param('id') idCrudo: string, @Body() cuerpo: unknown): Promise<ResumenDeCuenta> {
    const rol = rolDe(tipo);
    const id = leerIdentificadorDeRuta(idCrudo);
    const datos = parsearModificacionDeCuenta(cuerpo, rol);
    try {
      return await this.cuentas.modificar(rol, id, datos);
    } catch (error: unknown) {
      throw this.traducir(error, 'No se pudo guardar la cuenta. Intentá nuevamente.');
    }
  }

  @Delete(':tipo/:id')
  @HttpCode(204)
  @UseGuards(GuardiaDeRol)
  @RequerirRol('administrador')
  async darDeBaja(@Param('tipo') tipo: string, @Param('id') idCrudo: string): Promise<void> {
    const rol = rolDe(tipo);
    const id = leerIdentificadorDeRuta(idCrudo);
    try {
      await this.cuentas.darDeBaja(rol, id);
    } catch (error: unknown) {
      throw this.traducir(error, 'No se pudo dar de baja la cuenta. Intentá nuevamente.');
    }
  }

  private traducir(error: unknown, mensajeGenerico: string): Error {
    if (error instanceof DatosDeUsuarioInvalidosError) {
      return new BadRequestException({ message: error.message, erroresDeCampo: error.erroresDeCampo });
    }
    if (error instanceof CorreoYaRegistradoError) {
      return new ConflictException({ message: error.message, erroresDeCampo: { correo: error.message } });
    }
    if (error instanceof CuentaNoEncontradaError) return new NotFoundException(error.message);
    if (error instanceof CuentaDadaDeBajaError) return new ConflictException(error.message);
    // No exponer consultas, credenciales ni detalles del driver en la respuesta.
    return new InternalServerErrorException(mensajeGenerico);
  }
}
