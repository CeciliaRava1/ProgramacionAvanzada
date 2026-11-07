import { BadRequestException } from '@nestjs/common';
import type { DatosDeModificacion } from '../aplicacion/gestionar-cuentas.js';
import type { RolGestionado } from '../dominio/repositorio-de-usuarios.js';

/** Valida la entrada externa: solo los datos modificables, sin rol, contraseña ni identificador. */
export function parsearModificacionDeCuenta(cuerpo: unknown, rol: RolGestionado): DatosDeModificacion {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new BadRequestException('El cuerpo debe ser un objeto JSON.');
  }
  const entrada = cuerpo as Record<string, unknown>;
  const campos = ['nombre', 'apellido', 'correo'];
  const camposPermitidos = rol === 'entrenador' ? [...campos, 'horario'] : campos;
  if (Object.keys(entrada).some((campo) => !camposPermitidos.includes(campo))) {
    throw new BadRequestException('La solicitud contiene campos no permitidos.');
  }

  const erroresDeCampo: Record<string, string> = {};
  for (const campo of campos) {
    if (typeof entrada[campo] !== 'string') erroresDeCampo[campo] = 'Este campo es obligatorio y debe ser texto.';
  }
  if (entrada.horario !== undefined && entrada.horario !== null &&
      (!Array.isArray(entrada.horario) || entrada.horario.some((turno) => typeof turno !== 'string'))) {
    erroresDeCampo.horario = 'El horario debe ser una lista de turnos.';
  }
  if (Object.keys(erroresDeCampo).length > 0) {
    throw new BadRequestException({ message: 'Revisá los datos ingresados.', erroresDeCampo });
  }

  return {
    nombre: entrada.nombre as string,
    apellido: entrada.apellido as string,
    correo: entrada.correo as string,
    ...(rol === 'entrenador' ? { horario: entrada.horario } : {}),
  };
}
