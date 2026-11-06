import { createHash } from 'node:crypto';
import session from 'express-session';
import { DataSource, EntitySchema, LessThanOrEqual } from 'typeorm';

export const SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000;

interface StoredSession {
  idHash: string;
  data: session.SessionData;
  expiresAt: Date;
}

export const SessionSchema = new EntitySchema<StoredSession>({
  name: 'StoredSession',
  tableName: 'sessions',
  columns: {
    idHash: { name: 'id_hash', type: 'char', length: 64, primary: true, charset: 'ascii', collation: 'ascii_bin' },
    data: { type: 'json' },
    expiresAt: { name: 'expires_at', type: 'datetime', precision: 3 },
  },
  indices: [{ name: 'IDX_sessions_expires_at', columns: ['expiresAt'] }],
});

/** Adapta el contrato de express-session a MySQL sin guardar el identificador original. */
export class TypeOrmSessionStore extends session.Store {
  constructor(private readonly dataSource: DataSource) { super(); }

  private idHash(id: string): string {
    return createHash('sha256').update(id).digest('hex');
  }

  private expiresAt(data: session.SessionData): Date {
    return new Date(data.cookie.expires?.valueOf() ?? Date.now() + SESSION_TTL_MS);
  }

  get(id: string, callback: (error: unknown, data?: session.SessionData | null) => void): void {
    const repository = this.dataSource.getRepository(SessionSchema);
    void repository.findOneBy({ idHash: this.idHash(id) }).then(async (record) => {
      if (!record) return null;
      if (record.expiresAt.getTime() <= Date.now()) {
        await repository.delete({ idHash: record.idHash });
        return null;
      }
      return record.data;
    }).then((data) => callback(null, data), (error: unknown) => callback(error));
  }

  set(id: string, data: session.SessionData, callback: (error?: unknown) => void = () => {}): void {
    const repository = this.dataSource.getRepository(SessionSchema);
    void (async () => {
      // La limpieza acompaña a los inicios de sesión, sin un proceso adicional.
      await repository.delete({ expiresAt: LessThanOrEqual(new Date()) });
      await repository.upsert({ idHash: this.idHash(id), data, expiresAt: this.expiresAt(data) }, ['idHash']);
    })().then(() => callback(), (error: unknown) => callback(error));
  }

  touch(id: string, data: session.SessionData, callback: (error?: unknown) => void = () => {}): void {
    void this.dataSource.getRepository(SessionSchema)
      .update({ idHash: this.idHash(id) }, { expiresAt: this.expiresAt(data) })
      .then(() => callback(), (error: unknown) => callback(error));
  }

  destroy(id: string, callback: (error?: unknown) => void = () => {}): void {
    void this.dataSource.getRepository(SessionSchema).delete({ idHash: this.idHash(id) })
      .then(() => callback(), (error: unknown) => callback(error));
  }
}
