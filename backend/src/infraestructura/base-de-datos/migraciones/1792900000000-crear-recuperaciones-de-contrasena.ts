import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearRecuperacionesDeContrasena1792900000000 implements MigrationInterface {
  transaction = false;

  async up(ejecutor: QueryRunner): Promise<void> {
    await ejecutor.query(`
      CREATE TABLE recuperaciones_de_contrasena (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        usuario_id INT UNSIGNED NOT NULL,
        hash_del_token CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        vence_en DATETIME(3) NOT NULL,
        usado_en DATETIME(3) NULL,
        PRIMARY KEY (id),
        CONSTRAINT UQ_recuperaciones_hash_del_token UNIQUE (hash_del_token),
        INDEX IDX_recuperaciones_usuario (usuario_id, usado_en),
        CONSTRAINT FK_recuperaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere revisar los pedidos de recuperación; no se borran automáticamente.');
  }
}
