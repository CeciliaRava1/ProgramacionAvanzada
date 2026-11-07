import { DataSource, EntitySchema, QueryFailedError } from 'typeorm';
import type { SolicitudDeEntrenador, Vinculacion } from '../dominio/solicitud-de-entrenador.js';
import { SolicitudEnConflictoError, SolicitudNoEncontradaError } from '../dominio/solicitud-de-entrenador.js';
import {
  RepositorioDeSolicitudes, type AlumnoAsignado, type SolicitudGuardada, type SolicitudRecibida, type TransaccionDeSolicitudes,
} from '../dominio/repositorio-de-solicitudes.js';
import { EsquemaDeUsuario } from './repositorio-de-usuarios-typeorm.js';

export const EsquemaDeSolicitud = new EntitySchema<SolicitudDeEntrenador>({
  name: 'SolicitudDeEntrenador', tableName: 'solicitudes_de_entrenador',
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    alumnoId: { name: 'alumno_id', type: 'int', unsigned: true },
    entrenadorId: { name: 'entrenador_id', type: 'int', unsigned: true },
    estado: { type: 'varchar', length: 10 },
  },
});

export const EsquemaDeVinculacion = new EntitySchema<Vinculacion>({
  name: 'Vinculacion', tableName: 'vinculaciones',
  columns: {
    alumnoId: { name: 'alumno_id', type: 'int', unsigned: true, primary: true },
    entrenadorId: { name: 'entrenador_id', type: 'int', unsigned: true },
  },
});

export class RepositorioDeSolicitudesTypeOrm extends RepositorioDeSolicitudes {
  constructor(private readonly dataSource: DataSource) { super(); }

  buscarPorId(id: number): Promise<SolicitudGuardada | null> {
    return this.dataSource.getRepository(EsquemaDeSolicitud).findOneBy({ id }) as Promise<SolicitudGuardada | null>;
  }

  buscarPendientesDelEntrenador(entrenadorId: number): Promise<SolicitudRecibida[]> {
    return this.dataSource.query(`
      SELECT s.id, s.alumno_id AS alumnoId, s.entrenador_id AS entrenadorId, s.estado,
             u.nombre AS nombre, u.apellido AS apellido
      FROM solicitudes_de_entrenador s JOIN usuarios u ON u.id = s.alumno_id
      WHERE s.entrenador_id = ? AND s.estado = 'pendiente' AND u.fecha_baja IS NULL
      ORDER BY u.apellido, u.nombre, s.id
    `, [entrenadorId]);
  }

  buscarAlumnosAsignados(entrenadorId: number): Promise<AlumnoAsignado[]> {
    return this.dataSource.query(`
      SELECT u.id, u.nombre AS nombre, u.apellido AS apellido
      FROM vinculaciones v JOIN usuarios u ON u.id = v.alumno_id
      WHERE v.entrenador_id = ? AND u.rol = 'alumno' AND u.fecha_baja IS NULL
      ORDER BY u.apellido, u.nombre, u.id
    `, [entrenadorId]);
  }

  buscarVinculacion(alumnoId: number): Promise<Vinculacion | null> {
    return this.dataSource.getRepository(EsquemaDeVinculacion).findOneBy({ alumnoId });
  }

  async conAlumno<T>(alumnoId: number, accion: (transaccion: TransaccionDeSolicitudes) => Promise<T>): Promise<T> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Todas las operaciones del mismo alumno esperan este bloqueo antes de leer su estado.
        const alumno = await manager.getRepository(EsquemaDeUsuario).findOne({
          where: { id: alumnoId, rol: 'alumno' }, lock: { mode: 'pessimistic_write' },
        });
        if (!alumno) throw new SolicitudNoEncontradaError('El alumno no existe.');
        const solicitudes = manager.getRepository(EsquemaDeSolicitud);
        const vinculaciones = manager.getRepository(EsquemaDeVinculacion);
        return accion({
          buscarPendiente: () => solicitudes.findOneBy({ alumnoId, estado: 'pendiente' }) as Promise<SolicitudGuardada | null>,
          buscarVinculacion: () => vinculaciones.findOneBy({ alumnoId }),
          buscarSolicitud: (id) => solicitudes.findOneBy({ id, alumnoId }) as Promise<SolicitudGuardada | null>,
          guardarSolicitud: (solicitud) => solicitudes.save(solicitud) as Promise<SolicitudGuardada>,
          guardarVinculacion: async (vinculacion) => {
            // FOR SHARE espera a una baja del entrenador en curso y evita vincular a un entrenador dado de baja.
            const activo = await manager.query('SELECT id FROM usuarios WHERE id = ? AND fecha_baja IS NULL FOR SHARE', [vinculacion.entrenadorId]);
            if (activo.length === 0) throw new SolicitudEnConflictoError('El entrenador ya no está disponible.');
            await vinculaciones.insert(vinculacion);
          },
        });
      });
    } catch (error: unknown) {
      if (error instanceof QueryFailedError && error.driverError.code === 'ER_DUP_ENTRY') {
        throw new SolicitudEnConflictoError('El alumno ya tiene una solicitud pendiente o un entrenador asignado.');
      }
      throw error;
    }
  }
}
