import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearSesiones1792713600001 implements MigrationInterface {
  transaction = false;

  async up(ejecutor: QueryRunner): Promise<void> {
    await ejecutor.query(`
      CREATE TABLE sesiones (
        hash_de_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        datos JSON NOT NULL,
        vence_en DATETIME(3) NOT NULL,
        PRIMARY KEY (hash_de_id),
        INDEX IDX_sesiones_vence_en (vence_en)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar las sesiones; no se borra sesiones automáticamente.');
  }
}
