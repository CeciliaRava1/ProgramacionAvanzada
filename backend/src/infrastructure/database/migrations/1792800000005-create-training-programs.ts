import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTrainingPrograms1792800000005 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE training_programs (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        plan_id INT UNSIGNED NOT NULL,
        name VARCHAR(200) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT UQ_training_program_plan UNIQUE (plan_id),
        CONSTRAINT FK_training_program_plan FOREIGN KEY (plan_id) REFERENCES training_plans(id),
        CONSTRAINT CK_training_program_dates CHECK (end_date >= start_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar y respaldar los programas; no se borran automáticamente.');
  }
}
