import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearRutinas1792800000003 implements MigrationInterface {
  transaction = false;

  async up(ejecutor: QueryRunner): Promise<void> {
    await ejecutor.query(`
      CREATE TABLE rutinas (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        plan_id INT UNSIGNED NOT NULL,
        nombre VARCHAR(200) NOT NULL,
        descripcion TEXT NULL,
        PRIMARY KEY (id),
        CONSTRAINT FK_rutina_plan FOREIGN KEY (plan_id) REFERENCES planes_de_entrenamiento(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar y respaldar las rutinas; no se borran automáticamente.');
  }
}
