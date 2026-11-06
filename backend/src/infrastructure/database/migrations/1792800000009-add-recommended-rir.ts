import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecommendedRir1792800000009 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    if (!await runner.hasColumn('routine_exercises', 'recommended_rir')) {
      await runner.query('ALTER TABLE routine_exercises ADD COLUMN recommended_rir SMALLINT UNSIGNED NULL DEFAULT NULL');
    }
  }

  async down(): Promise<void> { throw new Error('La reversión requiere respaldar los valores de RIR; no se borran automáticamente.'); }
}
