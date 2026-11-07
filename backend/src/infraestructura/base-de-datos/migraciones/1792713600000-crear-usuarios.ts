import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearUsuarios1792713600000 implements MigrationInterface {
  // MySQL confirma DDL por separado; no se simula una transacción para crear tablas.
  transaction = false;

  async up(ejecutor: QueryRunner): Promise<void> {
    await ejecutor.query(`
      CREATE TABLE usuarios (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        correo VARCHAR(254) COLLATE utf8mb4_0900_as_ci NOT NULL,
        hash_de_contrasena VARCHAR(255) NOT NULL,
        rol VARCHAR(16) NOT NULL,
        horario VARCHAR(32) NULL,
        fecha_baja DATETIME(3) NULL,
        PRIMARY KEY (id),
        CONSTRAINT UQ_usuarios_correo UNIQUE (correo),
        CONSTRAINT CHK_usuarios_rol CHECK (rol IN ('alumno', 'entrenador', 'administrador')),
        CONSTRAINT CHK_usuarios_horario CHECK (
          horario IS NULL OR horario REGEXP '^(manana|tarde|noche)(,(manana|tarde|noche))*$'
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar y respaldar las cuentas; no se borra usuarios automáticamente.');
  }
}
