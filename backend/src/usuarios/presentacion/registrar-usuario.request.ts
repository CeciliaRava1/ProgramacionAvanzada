import { BadRequestException } from '@nestjs/common';
import type { EntradaDeRegistro } from '../aplicacion/registrar-usuario.js';
import { errorDeContrasena } from '../dominio/contrasena.js';
import type { Turno } from '../dominio/usuario.js';

/** Valida la entrada externa y rechaza campos como rol o hashDeContrasena. */
export function parsearRegistroDeUsuario(cuerpo: unknown, rol: 'alumno' | 'entrenador' = 'alumno'): EntradaDeRegistro {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new BadRequestException('El cuerpo debe ser un objeto JSON.');
  }
  const entrada = cuerpo as Record<string, unknown>;
  const campos = ['nombre', 'apellido', 'correo', 'contrasena'];
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
  if (typeof entrada.contrasena === 'string') {
    const error = errorDeContrasena(entrada.contrasena);
    if (error) erroresDeCampo.contrasena = error;
  }
  if (Object.keys(erroresDeCampo).length > 0) {
    throw new BadRequestException({ message: 'Revisá los datos ingresados.', erroresDeCampo });
  }

  return {
    nombre: entrada.nombre as string,
    apellido: entrada.apellido as string,
    correo: entrada.correo as string,
    contrasena: entrada.contrasena as string,
    ...(rol === 'entrenador' && entrada.horario !== undefined ? { horario: entrada.horario as Turno[] | null } : {}),
  };
}
