import { normalizarDatosDeUsuario, normalizarHorarioDeEntrenador, type DatosDeUsuario, type Turno } from '../dominio/usuario.js';
import { CorreoYaRegistradoError, RepositorioDeUsuarios } from '../dominio/repositorio-de-usuarios.js';

export interface EntradaDeRegistro extends DatosDeUsuario {
  contrasena: string;
  horario?: Turno[] | null;
}

export interface UsuarioRegistrado extends DatosDeUsuario {
  id: number;
  rol: 'alumno' | 'entrenador';
}

/** Coordina el alta; recibe sus dependencias para poder probarse sin MySQL. */
export class RegistrarUsuario {
  constructor(
    private readonly usuarios: RepositorioDeUsuarios,
    private readonly hashearContrasena: (contrasena: string) => Promise<string>,
  ) {}

  async ejecutar(entrada: EntradaDeRegistro, rol: UsuarioRegistrado['rol']): Promise<UsuarioRegistrado> {
    const datos = normalizarDatosDeUsuario(entrada);
    const datosDeEntrenador = rol === 'entrenador' ? { horario: normalizarHorarioDeEntrenador(entrada.horario) } : {};
    if (await this.usuarios.buscarPorCorreoYRol(datos.correo, rol)) throw new CorreoYaRegistradoError();

    const hashDeContrasena = await this.hashearContrasena(entrada.contrasena);
    // El rol lo fija la operación del servidor, nunca el cuerpo enviado por el navegador.
    const guardado = await this.usuarios.guardar({ ...datos, ...datosDeEntrenador, hashDeContrasena, rol });
    return { id: guardado.id, ...datos, rol };
  }
}
