import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTrainingPlans1792800000002 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE training_plans (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        student_id INT UNSIGNED NOT NULL,
        name VARCHAR(200) NOT NULL,
        objective TEXT NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT FK_training_plan_student FOREIGN KEY (student_id) REFERENCES usuarios(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar y respaldar los planes; no se borran automáticamente.');
  }
}
