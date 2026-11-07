import { DataSource, EntitySchema, type EntityManager } from 'typeorm';
import { PlanNoEncontradoError } from '../dominio/plan-de-entrenamiento.js';
import { RepositorioDeRutinas } from '../dominio/repositorio-de-rutinas.js';
import type { Rutina, RutinaGuardada } from '../dominio/rutina.js';
import { EsquemaDePlan } from './repositorio-de-planes-typeorm.js';

export const EsquemaDeRutina = new EntitySchema<Rutina>({
  name: 'Rutina', tableName: 'rutinas',
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    planId: { name: 'plan_id', type: 'int', unsigned: true },
    nombre: { type: 'varchar', length: 200 },
    descripcion: { type: 'text', nullable: true },
  },
});

/** Bloquea el plan no eliminado para coordinar las escrituras con su eliminación lógica. */
export async function bloquearPlan(gestor: EntityManager, planId: number): Promise<void> {
  const plan = await gestor.getRepository(EsquemaDePlan).createQueryBuilder('plan')
    .where('plan.id = :planId AND plan.fechaBaja IS NULL', { planId }).setLock('pessimistic_write').getOne();
  if (!plan) throw new PlanNoEncontradoError();
}

export class RepositorioDeRutinasTypeOrm extends RepositorioDeRutinas {
  constructor(private readonly baseDeDatos: DataSource) { super(); }

  guardar(rutina: Rutina): Promise<RutinaGuardada> {
    return this.baseDeDatos.transaction(async (gestor) => {
      await bloquearPlan(gestor, rutina.planId);
      return await gestor.getRepository(EsquemaDeRutina).save(rutina) as RutinaGuardada;
    });
  }

  buscarPorPlan(planId: number): Promise<RutinaGuardada[]> {
    return this.baseDeDatos.getRepository(EsquemaDeRutina).createQueryBuilder('rutina')
      .innerJoin(EsquemaDePlan.options.name, 'plan', 'plan.id = rutina.planId AND plan.fechaBaja IS NULL')
      .where('rutina.planId = :planId', { planId }).orderBy('rutina.id', 'ASC').getMany() as Promise<RutinaGuardada[]>;
  }

  modificar(id: number, planId: number, datos: Pick<Rutina, 'nombre' | 'descripcion'>): Promise<RutinaGuardada | null> {
    return this.baseDeDatos.transaction(async (gestor) => {
      await bloquearPlan(gestor, planId);
      const resultado = await gestor.getRepository(EsquemaDeRutina).update({ id, planId }, datos);
      return resultado.affected ? { id, planId, ...datos } : null;
    });
  }
}
