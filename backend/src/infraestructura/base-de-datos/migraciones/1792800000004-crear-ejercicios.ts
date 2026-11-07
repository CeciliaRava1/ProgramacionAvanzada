import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearEjercicios1792800000004 implements MigrationInterface {
  transaction = false;

  async up(ejecutor: QueryRunner): Promise<void> {
    // El catálogo se compara sin distinguir mayúsculas ni tildes, para que la búsqueda funcione en español.
    await ejecutor.query(`
      CREATE TABLE ejercicios (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        identificador VARCHAR(150) NOT NULL,
        nombre VARCHAR(300) NOT NULL,
        parte_del_cuerpo VARCHAR(100) NOT NULL,
        equipamiento VARCHAR(100) NOT NULL,
        musculo_objetivo VARCHAR(100) NOT NULL,
        instrucciones TEXT NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT UQ_ejercicio_identificador UNIQUE (identificador)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await ejecutor.query(`
      CREATE TABLE ejercicios_de_rutina (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        rutina_id INT UNSIGNED NOT NULL,
        ejercicio_id INT UNSIGNED NOT NULL,
        cantidad_de_series SMALLINT UNSIGNED NOT NULL,
        repeticiones_recomendadas SMALLINT UNSIGNED NOT NULL,
        peso_recomendado_kg DECIMAL(8,2) NULL,
        descanso_en_segundos SMALLINT UNSIGNED NULL,
        rir_recomendado SMALLINT UNSIGNED NULL,
        PRIMARY KEY (id),
        CONSTRAINT FK_ejercicio_de_rutina_rutina FOREIGN KEY (rutina_id) REFERENCES rutinas(id),
        CONSTRAINT FK_ejercicio_de_rutina_ejercicio FOREIGN KEY (ejercicio_id) REFERENCES ejercicios(id),
        CONSTRAINT CK_ejercicio_de_rutina_series CHECK (cantidad_de_series > 0),
        CONSTRAINT CK_ejercicio_de_rutina_repeticiones CHECK (repeticiones_recomendadas > 0),
        CONSTRAINT CK_ejercicio_de_rutina_peso CHECK (peso_recomendado_kg IS NULL OR peso_recomendado_kg >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere respaldar el catálogo y las indicaciones; no se borran automáticamente.');
  }
}
