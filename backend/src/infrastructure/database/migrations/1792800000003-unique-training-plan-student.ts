import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueTrainingPlanStudent1792800000003 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates = await queryRunner.query('SELECT student_id FROM training_plans GROUP BY student_id HAVING COUNT(*) > 1 LIMIT 1');
    if (duplicates.length) throw new Error('Hay alumnos con varios planes. Elegir qué plan conservar antes de aplicar esta migración; no se eliminan datos automáticamente.');
    await queryRunner.query('ALTER TABLE training_plans ADD CONSTRAINT UQ_training_plan_student UNIQUE (student_id)');
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar la regla de un plan por alumno.');
  }
}
