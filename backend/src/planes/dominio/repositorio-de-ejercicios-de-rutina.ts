import type { DatosDeEjercicioDeRutina, EjercicioDeRutinaDetallado } from './ejercicio-de-rutina.js';

export abstract class RepositorioDeEjerciciosDeRutina {
  abstract listar(rutinaId: number): Promise<EjercicioDeRutinaDetallado[]>;
  abstract guardar(rutinaId: number, ejercicioId: number, datos: DatosDeEjercicioDeRutina): Promise<EjercicioDeRutinaDetallado>;
  abstract modificar(rutinaId: number, id: number, datos: DatosDeEjercicioDeRutina): Promise<EjercicioDeRutinaDetallado | null>;
}
