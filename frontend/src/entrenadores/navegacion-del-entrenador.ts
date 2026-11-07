import type { Ejercicio } from '../planes/ejercicios-de-rutina.ts';

export type PantallaDelEntrenador =
  | 'inicio' | 'configuracion' | 'alumnos' | 'solicitudes'
  | 'alumno' | 'formulario-de-plan' | 'eliminar-plan' | 'rutina' | 'formulario-de-rutina' | 'catalogo' | 'ejercicio';
export interface RutaDelEntrenador {
  pantalla: PantallaDelEntrenador;
  alumnoId?: number;
  rutinaId?: number;
  ejercicioDeRutinaId?: number;
  ejercicioId?: number;
}
export type NavegarEntrenador = (ruta: RutaDelEntrenador, ejercicio?: Ejercicio) => void;

const identificador = (valor: string | undefined) => valor && /^[1-9]\d*$/.test(valor) && Number(valor) <= 4294967295 ? Number(valor) : undefined;

export function interpretarRutaDelEntrenador(hash: string): RutaDelEntrenador {
  const [pantalla, alumno, rutina, elemento, ejercicio, sobrante] = hash.replace(/^#/, '').split('/');
  const alumnoId = identificador(alumno), rutinaId = identificador(rutina), ejercicioDeRutinaId = identificador(elemento), ejercicioId = identificador(ejercicio);
  if (['inicio', 'configuracion', 'alumnos', 'solicitudes'].includes(pantalla) && alumno === undefined) return { pantalla: pantalla as PantallaDelEntrenador };
  if (['alumno', 'formulario-de-plan', 'eliminar-plan'].includes(pantalla) && alumnoId && rutina === undefined) return { pantalla: pantalla as PantallaDelEntrenador, alumnoId };
  if (pantalla === 'formulario-de-rutina' && alumnoId && elemento === undefined && (rutina === undefined || rutinaId)) return { pantalla, alumnoId, ...(rutinaId ? { rutinaId } : {}) };
  if (['rutina', 'catalogo'].includes(pantalla) && alumnoId && rutinaId && elemento === undefined) return { pantalla: pantalla as PantallaDelEntrenador, alumnoId, rutinaId };
  if (pantalla === 'ejercicio' && alumnoId && rutinaId && sobrante === undefined) {
    if (ejercicioDeRutinaId && ejercicio === undefined) return { pantalla, alumnoId, rutinaId, ejercicioDeRutinaId };
    if (elemento === '' && ejercicioId) return { pantalla, alumnoId, rutinaId, ejercicioId };
  }
  return { pantalla: 'alumnos' };
}

export function hrefDelEntrenador(ruta: RutaDelEntrenador): string {
  let hash = '#' + ruta.pantalla;
  if (ruta.alumnoId !== undefined) hash += '/' + ruta.alumnoId;
  if (ruta.rutinaId !== undefined) hash += '/' + ruta.rutinaId;
  if (ruta.pantalla === 'ejercicio') hash += ruta.ejercicioDeRutinaId !== undefined ? '/' + ruta.ejercicioDeRutinaId : '//' + ruta.ejercicioId;
  return hash;
}

export function esFormularioDelEntrenador(ruta: RutaDelEntrenador) {
  return ['formulario-de-plan', 'eliminar-plan', 'formulario-de-rutina'].includes(ruta.pantalla);
}
