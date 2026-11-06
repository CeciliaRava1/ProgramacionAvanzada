import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherAvailability1792800000000 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users ADD availability VARCHAR(255) NULL');
  }

  async down(): Promise<void> {
    throw new Error('La reversión no es automática para evitar perder los horarios guardados.');
  }
}
