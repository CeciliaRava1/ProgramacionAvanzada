export type Turno = 'manana' | 'tarde' | 'noche';

/** Orden canónico de los turnos; el backend los devuelve siempre en este orden. */
export const TURNOS: readonly Turno[] = ['manana', 'tarde', 'noche'];

export const ETIQUETAS_DE_TURNO: Readonly<Record<Turno, string>> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
};

export function esTurno(valor: unknown): valor is Turno {
  return typeof valor === 'string' && (TURNOS as readonly string[]).includes(valor);
}

/** Acepta solo turnos conocidos y sin repetir; una lista vacía significa horario sin cargar. */
export function esListaDeTurnosValida(valor: unknown): valor is Turno[] {
  return Array.isArray(valor) && valor.every(esTurno) && new Set(valor).size === valor.length;
}

export function ordenarTurnos(turnos: readonly Turno[]): Turno[] {
  return TURNOS.filter((turno) => turnos.includes(turno));
}

/** Texto para mostrar el horario, por ejemplo "Mañana, Tarde". */
export function formatearTurnos(turnos: readonly Turno[]): string {
  return ordenarTurnos(turnos).map((turno) => ETIQUETAS_DE_TURNO[turno]).join(', ');
}
