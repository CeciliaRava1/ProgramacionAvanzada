import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessions1792713600001 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sessions (
        id_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        data JSON NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id_hash),
        INDEX IDX_sessions_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar las sesiones; no se borra sessions automáticamente.');
  }
}
