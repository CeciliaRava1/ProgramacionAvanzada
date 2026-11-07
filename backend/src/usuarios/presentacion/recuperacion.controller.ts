import {
  BadRequestException, Body, Controller, GoneException, HttpCode, Inject, InternalServerErrorException, Logger, Post, UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ContrasenaNuevaInvalidaError, RestablecerContrasena, SolicitarRecuperacion,
} from '../aplicacion/recuperar-contrasena.js';
import { EnlaceDeRecuperacionInvalidoError } from '../dominio/recuperacion-de-contrasena.js';
import { esRolDeUsuario } from '../dominio/usuario.js';

/** Mismo cuerpo exista o no la cuenta: no permite averiguar qué correos están registrados. */
const RESPUESTA_NEUTRA = { message: 'Si existe una cuenta con esos datos, te enviamos un correo con el enlace para cambiar la contraseña.' };

function comoObjeto(cuerpo: unknown): Record<string, unknown> {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) throw new BadRequestException('El cuerpo debe ser un objeto JSON.');
  return cuerpo as Record<string, unknown>;
}

@Controller('usuarios/recuperacion')
export class RecuperacionController {
  private readonly registro = new Logger(RecuperacionController.name);

  constructor(
    @Inject(SolicitarRecuperacion) private readonly solicitar: SolicitarRecuperacion,
    @Inject(RestablecerContrasena) private readonly restablecer: RestablecerContrasena,
  ) {}

  @Post()
  @HttpCode(202)
  @UseGuards(ThrottlerGuard)
  async pedir(@Body() cuerpo: unknown) {
    const entrada = comoObjeto(cuerpo);
    if (Object.keys(entrada).some((clave) => !['correo', 'rol'].includes(clave)) ||
        typeof entrada.correo !== 'string' || entrada.correo.trim().length < 1 || [...entrada.correo.trim()].length > 254 ||
        !esRolDeUsuario(entrada.rol)) {
      throw new BadRequestException('Ingresá un correo y un rol válidos.');
    }
    // No se espera el envío: así la respuesta tarda lo mismo exista o no la cuenta, y un fallo de SMTP no revela nada.
    void this.solicitar.ejecutar(entrada.correo, entrada.rol).catch((error: unknown) => {
      this.registro.error('No se pudo enviar el enlace de recuperación.', error instanceof Error ? error.stack : undefined);
    });
    return RESPUESTA_NEUTRA;
  }

  @Post('restablecer')
  @HttpCode(204)
  @UseGuards(ThrottlerGuard)
  async cambiar(@Body() cuerpo: unknown) {
    const entrada = comoObjeto(cuerpo);
    if (Object.keys(entrada).some((clave) => !['token', 'contrasena'].includes(clave)) ||
        typeof entrada.token !== 'string' || entrada.token.length < 1 || entrada.token.length > 200 ||
        typeof entrada.contrasena !== 'string') {
      throw new BadRequestException('Faltan el enlace o la contraseña nueva.');
    }
    try {
      await this.restablecer.ejecutar(entrada.token, entrada.contrasena);
    } catch (error: unknown) {
      if (error instanceof ContrasenaNuevaInvalidaError) {
        throw new BadRequestException({ message: 'Revisá los datos ingresados.', erroresDeCampo: { contrasena: error.message } });
      }
      if (error instanceof EnlaceDeRecuperacionInvalidoError) throw new GoneException(error.message);
      throw new InternalServerErrorException('No se pudo cambiar la contraseña. Intentá nuevamente.');
    }
  }
}
