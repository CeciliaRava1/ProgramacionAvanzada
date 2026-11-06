import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTrainingRoutines1792800000006 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE training_routines (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        program_id INT UNSIGNED NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT NULL,
        PRIMARY KEY (id),
        CONSTRAINT FK_training_routine_program FOREIGN KEY (program_id) REFERENCES training_programs(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar y respaldar las rutinas; no se borran automáticamente.');
  }
}
