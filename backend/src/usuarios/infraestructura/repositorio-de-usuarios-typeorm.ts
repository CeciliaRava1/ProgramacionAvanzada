import { DataSource, EntitySchema, IsNull, QueryFailedError } from 'typeorm';
import type { RolDeUsuario, Turno, Usuario } from '../dominio/usuario.js';
import {
  CorreoYaRegistradoError, RepositorioDeUsuarios, type CambiosDeCuenta, type RolGestionado, type UsuarioGuardado,
} from '../dominio/repositorio-de-usuarios.js';

// Los turnos se guardan como lista separada por comas ("manana,noche"); null significa sin turnos.
const transformadorDeHorario = {
  to: (valor?: Turno[] | null) => (valor && valor.length > 0 ? valor.join(',') : null),
  from: (valor: string | null) => (valor ? (valor.split(',') as Turno[]) : null),
};

// El mapeo queda en infraestructura para que Usuario no importe decoradores del ORM.
export const EsquemaDeUsuario = new EntitySchema<Usuario>({
  name: 'Usuario',
  tableName: 'usuarios',
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    nombre: { type: 'varchar', length: 100 },
    apellido: { type: 'varchar', length: 100 },
    correo: { type: 'varchar', length: 254, collation: 'utf8mb4_0900_as_ci' },
    hashDeContrasena: { name: 'hash_de_contrasena', type: 'varchar', length: 255 },
    rol: { type: 'varchar', length: 16 },
    horario: { type: 'varchar', length: 32, nullable: true, transformer: transformadorDeHorario },
    fechaBaja: { name: 'fecha_baja', type: 'datetime', precision: 3, nullable: true },
  },
  uniques: [{ name: 'UQ_usuarios_correo_rol', columns: ['correo', 'rol'] }],
  checks: [{ name: 'CHK_usuarios_rol', expression: "rol IN ('alumno', 'entrenador', 'administrador')" }],
});

/** UNIQUE (correo, rol) resuelve también dos operaciones simultáneas con el mismo correo y rol. */
function traducirCorreoDuplicado(error: unknown): unknown {
  if (error instanceof QueryFailedError &&
      error.driverError.code === 'ER_DUP_ENTRY' &&
      String(error.driverError.sqlMessage).includes('UQ_usuarios_correo_rol')) {
    return new CorreoYaRegistradoError();
  }
  return error;
}

export class RepositorioDeUsuariosTypeOrm extends RepositorioDeUsuarios {
  constructor(private readonly dataSource: DataSource) { super(); }

  buscarPorCorreoYRol(correo: string, rol: RolDeUsuario): Promise<Usuario | null> {
    return this.dataSource.getRepository(EsquemaDeUsuario).findOneBy({ correo, rol });
  }

  buscarPorId(id: number): Promise<Usuario | null> {
    return this.dataSource.getRepository(EsquemaDeUsuario).findOneBy({ id });
  }

  buscarEntrenadores(): Promise<UsuarioGuardado[]> {
    return this.dataSource.getRepository(EsquemaDeUsuario).find({
      where: { rol: 'entrenador', fechaBaja: IsNull() },
      order: { apellido: 'ASC', nombre: 'ASC', id: 'ASC' },
    }) as Promise<UsuarioGuardado[]>;
  }

  buscarPorRol(rol: RolGestionado): Promise<UsuarioGuardado[]> {
    return this.dataSource.getRepository(EsquemaDeUsuario).find({
      where: { rol },
      order: { apellido: 'ASC', nombre: 'ASC', id: 'ASC' },
    }) as Promise<UsuarioGuardado[]>;
  }

  async guardar(usuario: Usuario): Promise<UsuarioGuardado> {
    try {
      return await this.dataSource.getRepository(EsquemaDeUsuario).save(usuario) as UsuarioGuardado;
    } catch (error: unknown) {
      throw traducirCorreoDuplicado(error);
    }
  }

  async modificar(id: number, rol: RolGestionado, cambios: CambiosDeCuenta): Promise<UsuarioGuardado | null> {
    const usuarios = this.dataSource.getRepository(EsquemaDeUsuario);
    try {
      const resultado = await usuarios.update({ id, rol, fechaBaja: IsNull() }, cambios);
      if (!resultado.affected) return null;
    } catch (error: unknown) {
      throw traducirCorreoDuplicado(error);
    }
    return usuarios.findOneBy({ id }) as Promise<UsuarioGuardado | null>;
  }

  async darDeBaja(id: number, rol: RolGestionado): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      // Bloquear la cuenta serializa la baja con las solicitudes del mismo alumno.
      const usuario = await manager.getRepository(EsquemaDeUsuario).findOne({
        where: { id, rol }, lock: { mode: 'pessimistic_write' },
      });
      if (!usuario) return false;
      if (usuario.fechaBaja) return true;
      const columna = rol === 'alumno' ? 'alumno_id' : 'entrenador_id';
      await manager.query('UPDATE usuarios SET fecha_baja = UTC_TIMESTAMP(3) WHERE id = ?', [id]);
      // Las tablas de vinculación pertenecen al repositorio de solicitudes; se usan consultas directas
      // para no importar su esquema desde aquí (importaría de vuelta a este archivo).
      await manager.query(`DELETE FROM vinculaciones WHERE ${columna} = ?`, [id]);
      await manager.query(`UPDATE solicitudes_de_entrenador SET estado = 'cancelada' WHERE ${columna} = ? AND estado = 'pendiente'`, [id]);
      await manager.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(id)]);
      return true;
    });
  }
}
