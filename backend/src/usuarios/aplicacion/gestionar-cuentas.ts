import { normalizarDatosDeUsuario, normalizarHorarioDeEntrenador, type DatosDeUsuario, type Turno } from '../dominio/usuario.js';
import { RepositorioDeUsuarios, type RolGestionado, type UsuarioGuardado } from '../dominio/repositorio-de-usuarios.js';

export interface ResumenDeCuenta {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  activa: boolean;
  /** Solo en entrenadores. */
  horario?: Turno[];
}

export interface DatosDeModificacion extends DatosDeUsuario {
  horario?: unknown;
}

export class CuentaNoEncontradaError extends Error {
  constructor() { super('La cuenta no existe.'); }
}

export class CuentaDadaDeBajaError extends Error {
  constructor() { super('La cuenta está dada de baja y no se puede modificar.'); }
}

/** Expone solo lo que necesita el administrador; nunca el hash de la contraseña. */
function resumir(usuario: UsuarioGuardado): ResumenDeCuenta {
  return {
    id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, correo: usuario.correo,
    activa: !usuario.fechaBaja,
    ...(usuario.rol === 'entrenador' ? { horario: usuario.horario ?? [] } : {}),
  };
}

/** Consulta, modificación y baja lógica de alumnos y entrenadores por parte del administrador. */
export class GestionarCuentas {
  constructor(private readonly usuarios: RepositorioDeUsuarios) {}

  async listar(rol: RolGestionado): Promise<ResumenDeCuenta[]> {
    return (await this.usuarios.buscarPorRol(rol)).map(resumir);
  }

  async modificar(rol: RolGestionado, id: number, datos: DatosDeModificacion): Promise<ResumenDeCuenta> {
    // Se valida antes de consultar: un dato inválido no revela si la cuenta existe.
    const detalles = normalizarDatosDeUsuario(datos);
    const horario = rol === 'entrenador' ? normalizarHorarioDeEntrenador(datos.horario) : undefined;
    const actual = await this.usuarios.buscarPorId(id);
    if (!actual || actual.rol !== rol) throw new CuentaNoEncontradaError();
    if (actual.fechaBaja) throw new CuentaDadaDeBajaError();
    // La modificación reemplaza el horario: omitirlo equivale a no tener turnos cargados.
    const guardada = await this.usuarios.modificar(id, rol, { ...detalles, ...(rol === 'entrenador' ? { horario } : {}) });
    if (!guardada) throw new CuentaDadaDeBajaError();
    return resumir(guardada);
  }

  async darDeBaja(rol: RolGestionado, id: number): Promise<void> {
    if (!(await this.usuarios.darDeBaja(id, rol))) throw new CuentaNoEncontradaError();
  }
}
