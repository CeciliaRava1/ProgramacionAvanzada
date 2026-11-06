import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1792713600000 implements MigrationInterface {
  // MySQL confirma DDL por separado; no se simula una transacción para crear tablas.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(254) COLLATE utf8mb4_0900_as_ci NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(16) NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT UQ_users_email UNIQUE (email),
        CONSTRAINT CHK_users_role CHECK (role IN ('student', 'teacher', 'admin'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar y respaldar las cuentas; no se borra users automáticamente.');
  }
}
