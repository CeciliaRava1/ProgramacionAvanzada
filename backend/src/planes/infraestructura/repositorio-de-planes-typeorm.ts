import { DataSource, EntitySchema, IsNull, QueryFailedError } from 'typeorm';
import { PlanYaExisteError, type DatosDePlan, type PlanDeEntrenamiento, type PlanGuardado } from '../dominio/plan-de-entrenamiento.js';
import { RepositorioDePlanes } from '../dominio/repositorio-de-planes.js';

type PlanAlmacenado = PlanDeEntrenamiento & { fechaBaja?: Date | null };

export const EsquemaDePlan = new EntitySchema<PlanAlmacenado>({
  name: 'PlanDeEntrenamiento', tableName: 'planes_de_entrenamiento',
  // La migración protege la unicidad sobre la columna generada del plan no eliminado.
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    alumnoId: { name: 'alumno_id', type: 'int', unsigned: true },
    nombre: { type: 'varchar', length: 200 },
    objetivo: { type: 'text' },
    fechaBaja: { name: 'fecha_baja', type: 'datetime', precision: 3, nullable: true, deleteDate: true, select: false },
  },
});

export class RepositorioDePlanesTypeOrm extends RepositorioDePlanes {
  constructor(private readonly baseDeDatos: DataSource) { super(); }

  async guardar(plan: PlanDeEntrenamiento): Promise<PlanGuardado> {
    try {
      return await this.baseDeDatos.getRepository(EsquemaDePlan).save(plan) as PlanGuardado;
    } catch (error: unknown) {
      if (error instanceof QueryFailedError && error.driverError.code === 'ER_DUP_ENTRY') throw new PlanYaExisteError();
      throw error;
    }
  }

  buscarPorAlumno(alumnoId: number): Promise<PlanGuardado[]> {
    return this.baseDeDatos.getRepository(EsquemaDePlan).find({ where: { alumnoId }, order: { id: 'ASC' } }) as Promise<PlanGuardado[]>;
  }

  async modificar(id: number, alumnoId: number, datos: DatosDePlan): Promise<PlanGuardado | null> {
    const resultado = await this.baseDeDatos.getRepository(EsquemaDePlan).update({ id, alumnoId, fechaBaja: IsNull() }, datos);
    return resultado.affected ? { id, alumnoId, ...datos } : null;
  }

  async eliminar(id: number, alumnoId: number): Promise<boolean> {
    const resultado = await this.baseDeDatos.getRepository(EsquemaDePlan).softDelete({ id, alumnoId, fechaBaja: IsNull() });
    return Boolean(resultado.affected);
  }
}
