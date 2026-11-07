import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowEmptyExerciseDetails1792800000010 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE routine_exercises MODIFY recommended_weight_kg DECIMAL(8,2) NULL, MODIFY rest_seconds SMALLINT UNSIGNED NULL');
  }

  async down(): Promise<void> { throw new Error('La reversión requiere resolver los valores sin informar; no se reemplazan automáticamente.'); }
}
