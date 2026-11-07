import type { Exercise } from '../plans/routine-exercises.ts';

// Las pantallas 'student', 'plan-form', 'delete-plan', 'program-form', 'routine', 'routine-form', 'catalog'
// y 'exercise' pertenecen al módulo de planes y conservan su nombre; las demás son del entrenador.
export type PantallaDelEntrenador = 'inicio' | 'configuracion' | 'alumnos' | 'solicitudes' | 'student' | 'plan-form' | 'delete-plan' | 'program-form' | 'routine' | 'routine-form' | 'catalog' | 'exercise';
export interface RutaDelEntrenador { screen: PantallaDelEntrenador; studentId?: number; routineId?: number; entryId?: number; exerciseId?: number }
export type NavegarEntrenador = (ruta: RutaDelEntrenador, ejercicio?: Exercise) => void;

const identificador = (valor: string | undefined) => valor && /^[1-9]\d*$/.test(valor) && Number(valor) <= 4294967295 ? Number(valor) : undefined;

export function interpretarRutaDelEntrenador(hash: string): RutaDelEntrenador {
  const [pantalla, alumno, rutina, entrada, ejercicio, sobrante] = hash.replace(/^#/, '').split('/');
  const studentId = identificador(alumno), routineId = identificador(rutina), entryId = identificador(entrada), exerciseId = identificador(ejercicio);
  if (['inicio', 'configuracion', 'alumnos', 'solicitudes'].includes(pantalla) && alumno === undefined) return { screen: pantalla as PantallaDelEntrenador };
  if (['student', 'plan-form', 'delete-plan', 'program-form'].includes(pantalla) && studentId && rutina === undefined) return { screen: pantalla as PantallaDelEntrenador, studentId };
  if (pantalla === 'routine-form' && studentId && entrada === undefined && (rutina === undefined || routineId)) return { screen: pantalla, studentId, ...(routineId ? { routineId } : {}) };
  if (['routine', 'catalog'].includes(pantalla) && studentId && routineId && entrada === undefined) return { screen: pantalla as PantallaDelEntrenador, studentId, routineId };
  if (pantalla === 'exercise' && studentId && routineId && sobrante === undefined) {
    if (entryId && ejercicio === undefined) return { screen: pantalla, studentId, routineId, entryId };
    if (entrada === '' && exerciseId) return { screen: pantalla, studentId, routineId, exerciseId };
  }
  return { screen: 'alumnos' };
}

export function hrefDelEntrenador(ruta: RutaDelEntrenador): string {
  let hash = '#' + ruta.screen;
  if (ruta.studentId !== undefined) hash += '/' + ruta.studentId;
  if (ruta.routineId !== undefined) hash += '/' + ruta.routineId;
  if (ruta.screen === 'exercise') hash += ruta.entryId !== undefined ? '/' + ruta.entryId : '//' + ruta.exerciseId;
  return hash;
}

export function esFormularioDelEntrenador(ruta: RutaDelEntrenador) {
  return ['plan-form', 'delete-plan', 'program-form', 'routine-form'].includes(ruta.screen);
}
