import { GestionarRutinas } from './gestionar-rutinas.js';
import { EjercicioNoEncontradoError } from '../dominio/ejercicio.js';
import { validarEjercicioDeRutina, type DatosDeEjercicioDeRutina } from '../dominio/ejercicio-de-rutina.js';
import { RepositorioDeEjercicios } from '../dominio/repositorio-de-ejercicios.js';
import { RepositorioDeEjerciciosDeRutina } from '../dominio/repositorio-de-ejercicios-de-rutina.js';
import { RutinaNoEncontradaError } from '../dominio/rutina.js';

export class GestionarEjerciciosDeRutina {
  constructor(
    private readonly ejerciciosDeRutina: RepositorioDeEjerciciosDeRutina,
    private readonly catalogo: RepositorioDeEjercicios,
    private readonly rutinas: GestionarRutinas,
  ) {}

  async listar(entrenadorId: number, alumnoId: number, planId: number, rutinaId: number) {
    await this.autorizar(entrenadorId, alumnoId, planId, rutinaId);
    return this.ejerciciosDeRutina.listar(rutinaId);
  }

  async agregar(entrenadorId: number, alumnoId: number, planId: number, rutinaId: number, ejercicioId: number, datos: DatosDeEjercicioDeRutina) {
    await this.autorizar(entrenadorId, alumnoId, planId, rutinaId);
    const validados = validarEjercicioDeRutina(datos);
    if (!await this.catalogo.buscarPorId(ejercicioId)) throw new EjercicioNoEncontradoError();
    return this.ejerciciosDeRutina.guardar(rutinaId, ejercicioId, validados);
  }

  async modificar(entrenadorId: number, alumnoId: number, planId: number, rutinaId: number, id: number, datos: DatosDeEjercicioDeRutina) {
    await this.autorizar(entrenadorId, alumnoId, planId, rutinaId);
    const guardado = await this.ejerciciosDeRutina.modificar(rutinaId, id, validarEjercicioDeRutina(datos));
    if (!guardado) throw new EjercicioNoEncontradoError();
    return guardado;
  }

  private async autorizar(entrenadorId: number, alumnoId: number, planId: number, rutinaId: number) {
    if (!(await this.rutinas.listar(entrenadorId, alumnoId, planId)).some((rutina) => rutina.id === rutinaId)) throw new RutinaNoEncontradaError();
  }
}
