import { DataSource, EntitySchema } from 'typeorm';
import { ejercicioPublico, type BusquedaDeEjercicios, type Ejercicio } from '../dominio/ejercicio.js';
import { RepositorioDeEjercicios } from '../dominio/repositorio-de-ejercicios.js';

export const EsquemaDeEjercicio = new EntitySchema<Ejercicio>({
  name: 'Ejercicio', tableName: 'ejercicios',
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    identificador: { type: 'varchar', length: 150 },
    nombre: { type: 'varchar', length: 300 },
    parteDelCuerpo: { name: 'parte_del_cuerpo', type: 'varchar', length: 100 },
    equipamiento: { type: 'varchar', length: 100 },
    musculoObjetivo: { name: 'musculo_objetivo', type: 'varchar', length: 100 },
    instrucciones: { type: 'text' },
  },
  uniques: [{ name: 'UQ_ejercicio_identificador', columns: ['identificador'] }],
});

export class RepositorioDeEjerciciosTypeOrm extends RepositorioDeEjercicios {
  constructor(private readonly baseDeDatos: DataSource) { super(); }

  buscarPorId(id: number) { return this.baseDeDatos.getRepository(EsquemaDeEjercicio).findOneBy({ id }); }

  async buscar({ q, parteDelCuerpo, equipamiento, desde }: BusquedaDeEjercicios) {
    const repositorio = this.baseDeDatos.getRepository(EsquemaDeEjercicio);
    const consulta = repositorio.createQueryBuilder('ejercicio');
    for (const [indice, palabra] of q.trim().split(/\s+/u).filter(Boolean).entries()) {
      // LIKE respeta la intercalación ai_ci (ignora mayúsculas y tildes); LOCATE no lo hace. Se escapan los comodines.
      consulta.andWhere(`CONCAT_WS(' ', ejercicio.nombre, ejercicio.parteDelCuerpo, ejercicio.equipamiento, ejercicio.musculoObjetivo) LIKE :palabra${indice} ESCAPE '!'`, { ['palabra' + indice]: `%${palabra.replace(/[!%_]/gu, '!$&')}%` });
    }
    if (parteDelCuerpo) consulta.andWhere('ejercicio.parteDelCuerpo = :parteDelCuerpo', { parteDelCuerpo });
    if (equipamiento) consulta.andWhere('ejercicio.equipamiento = :equipamiento', { equipamiento });
    const [[elementos, total], partes, herramientas] = await Promise.all([
      consulta.orderBy('ejercicio.nombre', 'ASC').addOrderBy('ejercicio.id', 'ASC').skip(desde).take(20).getManyAndCount(),
      repositorio.createQueryBuilder('ejercicio').select('DISTINCT ejercicio.parteDelCuerpo', 'valor').orderBy('valor', 'ASC').getRawMany<{ valor: string }>(),
      repositorio.createQueryBuilder('ejercicio').select('DISTINCT ejercicio.equipamiento', 'valor').orderBy('valor', 'ASC').getRawMany<{ valor: string }>(),
    ]);
    return { elementos: elementos.map(ejercicioPublico), total, partesDelCuerpo: partes.map((p) => p.valor), equipamientos: herramientas.map((h) => h.valor) };
  }
}
