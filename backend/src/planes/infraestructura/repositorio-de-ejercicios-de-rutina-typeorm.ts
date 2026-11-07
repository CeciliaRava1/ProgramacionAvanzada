import { DataSource, EntitySchema, type EntityManager } from 'typeorm';
import { ejercicioPublico, type Ejercicio } from '../dominio/ejercicio.js';
import type { DatosDeEjercicioDeRutina, EjercicioDeRutina, EjercicioDeRutinaDetallado } from '../dominio/ejercicio-de-rutina.js';
import { RepositorioDeEjerciciosDeRutina } from '../dominio/repositorio-de-ejercicios-de-rutina.js';
import { RutinaNoEncontradaError } from '../dominio/rutina.js';
import { EsquemaDeEjercicio } from './repositorio-de-ejercicios-typeorm.js';
import { EsquemaDePlan } from './repositorio-de-planes-typeorm.js';
import { EsquemaDeRutina } from './repositorio-de-rutinas-typeorm.js';

export const EsquemaDeEjercicioDeRutina = new EntitySchema<EjercicioDeRutina>({
  name: 'EjercicioDeRutina', tableName: 'ejercicios_de_rutina',
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    rutinaId: { name: 'rutina_id', type: 'int', unsigned: true },
    ejercicioId: { name: 'ejercicio_id', type: 'int', unsigned: true },
    cantidadDeSeries: { name: 'cantidad_de_series', type: 'smallint', unsigned: true },
    repeticionesRecomendadas: { name: 'repeticiones_recomendadas', type: 'smallint', unsigned: true },
    pesoRecomendadoKg: {
      name: 'peso_recomendado_kg', type: 'decimal', precision: 8, scale: 2, nullable: true,
      transformer: { to: (valor: number | null) => valor, from: (valor: string | null) => valor === null ? null : Number(valor) },
    },
    descansoEnSegundos: { name: 'descanso_en_segundos', type: 'smallint', unsigned: true, nullable: true },
    rirRecomendado: { name: 'rir_recomendado', type: 'smallint', unsigned: true, nullable: true },
  },
});

export class RepositorioDeEjerciciosDeRutinaTypeOrm extends RepositorioDeEjerciciosDeRutina {
  constructor(private readonly baseDeDatos: DataSource) { super(); }

  async listar(rutinaId: number): Promise<EjercicioDeRutinaDetallado[]> {
    const elementos = await this.consulta(this.baseDeDatos.manager, rutinaId).orderBy('elemento.id', 'ASC').getMany() as EjercicioDeRutinaDetallado[];
    return elementos.map((elemento) => ({ ...elemento, ejercicio: ejercicioPublico(elemento.ejercicio as Ejercicio) }));
  }

  async guardar(rutinaId: number, ejercicioId: number, datos: DatosDeEjercicioDeRutina) {
    return this.baseDeDatos.transaction(async (gestor) => {
      await this.bloquearRutina(gestor, rutinaId);
      const guardado = await gestor.getRepository(EsquemaDeEjercicioDeRutina).save({ rutinaId, ejercicioId, ...datos });
      return this.detalle(gestor, rutinaId, guardado.id);
    });
  }

  async modificar(rutinaId: number, id: number, datos: DatosDeEjercicioDeRutina) {
    return this.baseDeDatos.transaction(async (gestor) => {
      await this.bloquearRutina(gestor, rutinaId);
      const resultado = await gestor.getRepository(EsquemaDeEjercicioDeRutina).update({ id, rutinaId }, datos);
      return resultado.affected ? this.detalle(gestor, rutinaId, id) : null;
    });
  }

  private consulta(gestor: EntityManager, rutinaId: number) {
    return gestor.getRepository(EsquemaDeEjercicioDeRutina).createQueryBuilder('elemento')
      .innerJoin(EsquemaDeRutina.options.name, 'rutina', 'rutina.id = elemento.rutinaId')
      .innerJoin(EsquemaDePlan.options.name, 'plan', 'plan.id = rutina.planId AND plan.fechaBaja IS NULL')
      .innerJoinAndMapOne('elemento.ejercicio', EsquemaDeEjercicio.options.name, 'ejercicio', 'ejercicio.id = elemento.ejercicioId')
      .where('elemento.rutinaId = :rutinaId', { rutinaId });
  }

  private async detalle(gestor: EntityManager, rutinaId: number, id: number): Promise<EjercicioDeRutinaDetallado> {
    const elemento = await this.consulta(gestor, rutinaId).andWhere('elemento.id = :id', { id }).getOneOrFail() as EjercicioDeRutinaDetallado;
    return { ...elemento, ejercicio: ejercicioPublico(elemento.ejercicio as Ejercicio) };
  }

  private async bloquearRutina(gestor: EntityManager, rutinaId: number) {
    const rutina = await gestor.getRepository(EsquemaDeRutina).findOneBy({ id: rutinaId });
    if (!rutina) throw new RutinaNoEncontradaError();
    // Mantiene el orden plan → rutina que utiliza la edición de rutinas.
    const plan = await gestor.getRepository(EsquemaDePlan).createQueryBuilder('plan')
      .where('plan.id = :planId AND plan.fechaBaja IS NULL', { planId: rutina.planId }).setLock('pessimistic_write').getOne();
    if (!plan || !await gestor.getRepository(EsquemaDeRutina).findOne({ where: { id: rutinaId, planId: plan.id! }, lock: { mode: 'pessimistic_write' } })) throw new RutinaNoEncontradaError();
  }
}
