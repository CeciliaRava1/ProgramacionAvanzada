import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExercises1792800000007 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE IF NOT EXISTS exercises (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(100) NOT NULL, source_id VARCHAR(100) NOT NULL,
      name VARCHAR(300) NOT NULL, body_part VARCHAR(100) NOT NULL,
      equipment VARCHAR(100) NOT NULL, target VARCHAR(100) NOT NULL, instructions TEXT NOT NULL,
      UNIQUE KEY UQ_exercise_source (source, source_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await runner.query(`CREATE TABLE IF NOT EXISTS routine_exercises (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      routine_id INT UNSIGNED NOT NULL, exercise_id INT UNSIGNED NOT NULL,
      set_count SMALLINT UNSIGNED NOT NULL, recommended_repetitions SMALLINT UNSIGNED NOT NULL,
      recommended_weight_kg DECIMAL(8,2) NOT NULL, rest_seconds SMALLINT UNSIGNED NOT NULL,
      CONSTRAINT FK_routine_exercise_routine FOREIGN KEY (routine_id) REFERENCES training_routines(id),
      CONSTRAINT FK_routine_exercise_catalog FOREIGN KEY (exercise_id) REFERENCES exercises(id),
      CONSTRAINT CK_routine_exercise_sets CHECK (set_count > 0),
      CONSTRAINT CK_routine_exercise_reps CHECK (recommended_repetitions > 0),
      CONSTRAINT CK_routine_exercise_weight CHECK (recommended_weight_kg >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  async down(): Promise<void> { throw new Error('La reversión requiere respaldar el catálogo y las indicaciones; no se borran automáticamente.'); }
}
