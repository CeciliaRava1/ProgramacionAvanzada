export type RolDeUsuario = 'alumno' | 'entrenador' | 'administrador';

/** Turnos en los que un entrenador puede atender, en el orden en que se muestran. */
export const TURNOS = ['manana', 'tarde', 'noche'] as const;
export type Turno = (typeof TURNOS)[number];

export interface DatosDeUsuario {
  nombre: string;
  apellido: string;
  correo: string;
}

export interface Usuario extends DatosDeUsuario {
  id?: number;
  hashDeContrasena: string;
  rol: RolDeUsuario;
  /** null representa que no se cargó ningún turno. */
  horario?: Turno[] | null;
  /** Baja lógica: una cuenta dada de baja conserva sus datos pero no puede operar. */
  fechaBaja?: Date | null;
}

export class DatosDeUsuarioInvalidosError extends Error {
  constructor(readonly erroresDeCampo: Record<string, string>) {
    super('Revisá los datos ingresados.');
  }
}

/** Sin turnos elegidos equivale a información no cargada; se descartan repetidos y se ordena. */
export function normalizarHorarioDeEntrenador(valor?: unknown): Turno[] | null {
  if (valor === undefined || valor === null) return null;
  if (!Array.isArray(valor) || valor.some((turno) => !(TURNOS as readonly unknown[]).includes(turno))) {
    throw new DatosDeUsuarioInvalidosError({ horario: 'Elegí turnos válidos: mañana, tarde o noche.' });
  }
  const elegidos = TURNOS.filter((turno) => valor.includes(turno));
  return elegidos.length > 0 ? elegidos : null;
}

/** Normaliza los datos de la cuenta sin depender de HTTP ni de la base. */
export function normalizarDatosDeUsuario(entrada: DatosDeUsuario): DatosDeUsuario {
  const datos = {
    nombre: entrada.nombre.trim(),
    apellido: entrada.apellido.trim(),
    correo: entrada.correo.trim().toLowerCase(),
  };
  const erroresDeCampo: Record<string, string> = {};

  for (const campo of ['nombre', 'apellido'] as const) {
    if ([...datos[campo]].length < 1 || [...datos[campo]].length > 100) {
      erroresDeCampo[campo] = 'Ingresá entre 1 y 100 caracteres.';
    }
  }
  if ([...datos.correo].length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(datos.correo) ||
      /[\u0000-\u001f\u007f]/u.test(datos.correo)) {
    erroresDeCampo.correo = 'Ingresá un correo electrónico válido de hasta 254 caracteres.';
  }

  if (Object.keys(erroresDeCampo).length > 0) throw new DatosDeUsuarioInvalidosError(erroresDeCampo);
  return datos;
}
