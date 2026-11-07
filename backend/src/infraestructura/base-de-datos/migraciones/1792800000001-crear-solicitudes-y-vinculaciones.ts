import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearSolicitudesYVinculaciones1792800000001 implements MigrationInterface {
  transaction = false;

  async up(ejecutor: QueryRunner): Promise<void> {
    await ejecutor.query(`
      CREATE TABLE vinculaciones (
        alumno_id INT UNSIGNED NOT NULL,
        entrenador_id INT UNSIGNED NOT NULL,
        PRIMARY KEY (alumno_id),
        CONSTRAINT FK_vinculacion_alumno FOREIGN KEY (alumno_id) REFERENCES usuarios(id),
        CONSTRAINT FK_vinculacion_entrenador FOREIGN KEY (entrenador_id) REFERENCES usuarios(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ejecutor.query(`
      CREATE TABLE solicitudes_de_entrenador (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        alumno_id INT UNSIGNED NOT NULL,
        entrenador_id INT UNSIGNED NOT NULL,
        estado VARCHAR(10) NOT NULL,
        alumno_pendiente_id INT UNSIGNED GENERATED ALWAYS AS
          (CASE WHEN estado = 'pendiente' THEN alumno_id ELSE NULL END) STORED,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_solicitud_pendiente (alumno_pendiente_id),
        INDEX IDX_solicitudes_pendientes_del_entrenador (entrenador_id, estado),
        CONSTRAINT CHK_solicitud_estado CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),
        CONSTRAINT FK_solicitud_alumno FOREIGN KEY (alumno_id) REFERENCES usuarios(id),
        CONSTRAINT FK_solicitud_entrenador FOREIGN KEY (entrenador_id) REFERENCES usuarios(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión no es automática para evitar borrar solicitudes y vinculaciones.');
  }
}
