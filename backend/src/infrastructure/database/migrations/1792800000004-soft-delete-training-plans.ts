import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SoftDeleteTrainingPlans1792800000004 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    // Un índice separado conserva el soporte de la clave foránea al reemplazar la unicidad.
    await queryRunner.query(`
      ALTER TABLE training_plans
        ADD COLUMN deleted_at DATETIME(3) NULL,
        ADD COLUMN active_student_id INT UNSIGNED GENERATED ALWAYS AS
          (CASE WHEN deleted_at IS NULL THEN student_id ELSE NULL END) STORED,
        ADD INDEX IDX_training_plan_student (student_id),
        DROP INDEX UQ_training_plan_student,
        ADD CONSTRAINT UQ_active_training_plan_student UNIQUE (active_student_id)
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar los planes eliminados y sus referencias históricas.');
  }
}
