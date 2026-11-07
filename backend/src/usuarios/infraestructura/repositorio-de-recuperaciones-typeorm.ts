import { DataSource } from 'typeorm';
import { RepositorioDeRecuperaciones } from '../dominio/recuperacion-de-contrasena.js';

export class RepositorioDeRecuperacionesTypeOrm extends RepositorioDeRecuperaciones {
  constructor(private readonly dataSource: DataSource) { super(); }

  async crear(usuarioId: number, hashDelToken: string, venceEn: Date): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Un enlace nuevo deja sin efecto los anteriores todavía pendientes.
      await manager.query(
        'UPDATE recuperaciones_de_contrasena SET usado_en = ? WHERE usuario_id = ? AND usado_en IS NULL',
        [new Date(), usuarioId],
      );
      await manager.query(
        'INSERT INTO recuperaciones_de_contrasena (usuario_id, hash_del_token, vence_en) VALUES (?, ?, ?)',
        [usuarioId, hashDelToken, venceEn],
      );
    });
  }

  async consumir(hashDelToken: string, ahora: Date, hashDeContrasenaNueva: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      // FOR UPDATE serializa dos usos simultáneos del mismo enlace: el segundo ya lo encuentra usado.
      const filas: { usuario_id: number }[] = await manager.query(
        `SELECT r.usuario_id FROM recuperaciones_de_contrasena r
           JOIN usuarios u ON u.id = r.usuario_id
          WHERE r.hash_del_token = ? AND r.usado_en IS NULL AND r.vence_en > ? AND u.fecha_baja IS NULL
          FOR UPDATE`,
        [hashDelToken, ahora],
      );
      if (filas.length !== 1) return false;
      const usuarioId = filas[0].usuario_id;
      await manager.query('UPDATE usuarios SET hash_de_contrasena = ? WHERE id = ?', [hashDeContrasenaNueva, usuarioId]);
      await manager.query('UPDATE recuperaciones_de_contrasena SET usado_en = ? WHERE usuario_id = ? AND usado_en IS NULL', [ahora, usuarioId]);
      await manager.query("DELETE FROM sesiones WHERE JSON_UNQUOTE(JSON_EXTRACT(datos, '$.usuarioId')) = ?", [String(usuarioId)]);
      return true;
    });
  }
}
