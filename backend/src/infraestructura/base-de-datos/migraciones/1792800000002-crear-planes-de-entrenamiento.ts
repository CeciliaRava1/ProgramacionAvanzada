import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearPlanesDeEntrenamiento1792800000002 implements MigrationInterface {
  transaction = false;

  async up(ejecutor: QueryRunner): Promise<void> {
    // La columna generada permite un solo plan activo por alumno y conserva los eliminados.
    await ejecutor.query(`
      CREATE TABLE planes_de_entrenamiento (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        alumno_id INT UNSIGNED NOT NULL,
        nombre VARCHAR(200) NOT NULL,
        objetivo TEXT NOT NULL,
        fecha_baja DATETIME(3) NULL,
        alumno_id_activo INT UNSIGNED GENERATED ALWAYS AS
          (CASE WHEN fecha_baja IS NULL THEN alumno_id ELSE NULL END) STORED,
        PRIMARY KEY (id),
        INDEX IDX_plan_alumno (alumno_id),
        CONSTRAINT UQ_plan_activo_del_alumno UNIQUE (alumno_id_activo),
        CONSTRAINT FK_plan_alumno FOREIGN KEY (alumno_id) REFERENCES usuarios(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar y respaldar los planes; no se borran automáticamente.');
  }
}
