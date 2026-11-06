import { DataSource, EntitySchema } from 'typeorm';
import { ExerciseRepository } from '../domain/exercise.repository.js';
import { publicExercise, type Exercise, type ExerciseSearch } from '../domain/exercise.js';

export const ExerciseSchema = new EntitySchema<Exercise>({
  name: 'Exercise', tableName: 'exercises',
  columns: {
    id: { type: 'int', unsigned: true, primary: true, generated: 'increment' },
    source: { type: 'varchar', length: 100 }, sourceId: { name: 'source_id', type: 'varchar', length: 100 },
    name: { type: 'varchar', length: 300 }, bodyPart: { name: 'body_part', type: 'varchar', length: 100 },
    equipment: { type: 'varchar', length: 100 }, target: { type: 'varchar', length: 100 }, instructions: { type: 'text' },
  }, uniques: [{ columns: ['source', 'sourceId'] }],
});

export class TypeOrmExerciseRepository extends ExerciseRepository {
  constructor(private readonly db: DataSource) { super(); }
  findById(id: number) { return this.db.getRepository(ExerciseSchema).findOneBy({ id }); }

  async search({ q, bodyPart, equipment, offset }: ExerciseSearch) {
    const repository = this.db.getRepository(ExerciseSchema);
    const query = repository.createQueryBuilder('exercise');
    for (const [index, word] of q.trim().split(/\s+/u).filter(Boolean).entries()) {
      query.andWhere(`LOCATE(:word${index}, CONCAT_WS(' ', exercise.name, exercise.bodyPart, exercise.equipment, exercise.target)) > 0`, { ['word' + index]: word });
    }
    if (bodyPart) query.andWhere('exercise.bodyPart = :bodyPart', { bodyPart });
    if (equipment) query.andWhere('exercise.equipment = :equipment', { equipment });
    const [[items, total], parts, tools] = await Promise.all([
      query.orderBy('exercise.name', 'ASC').addOrderBy('exercise.id', 'ASC').skip(offset).take(20).getManyAndCount(),
      repository.createQueryBuilder('exercise').select('DISTINCT exercise.bodyPart', 'value').orderBy('value', 'ASC').getRawMany<{ value: string }>(),
      repository.createQueryBuilder('exercise').select('DISTINCT exercise.equipment', 'value').orderBy('value', 'ASC').getRawMany<{ value: string }>(),
    ]);
    return { items: items.map(publicExercise), total, bodyParts: parts.map(p => p.value), equipment: tools.map(t => t.value) };
  }
}
