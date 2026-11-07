import { createHash } from 'node:crypto';
import session from 'express-session';
import { DataSource, EntitySchema, LessThanOrEqual } from 'typeorm';

export const DURACION_DE_SESION_MS = 15 * 24 * 60 * 60 * 1000;

interface SesionGuardada {
  hashDeId: string;
  datos: session.SessionData;
  venceEn: Date;
}

export const EsquemaDeSesion = new EntitySchema<SesionGuardada>({
  name: 'SesionGuardada',
  tableName: 'sesiones',
  columns: {
    hashDeId: { name: 'hash_de_id', type: 'char', length: 64, primary: true, charset: 'ascii', collation: 'ascii_bin' },
    datos: { type: 'json' },
    venceEn: { name: 'vence_en', type: 'datetime', precision: 3 },
  },
  indices: [{ name: 'IDX_sesiones_vence_en', columns: ['venceEn'] }],
});

/** Adapta el contrato de express-session a MySQL sin guardar el identificador original. */
export class AlmacenDeSesionesTypeOrm extends session.Store {
  constructor(private readonly dataSource: DataSource) { super(); }

  private hashDeId(id: string): string {
    return createHash('sha256').update(id).digest('hex');
  }

  private venceEn(datos: session.SessionData): Date {
    return new Date(datos.cookie.expires?.valueOf() ?? Date.now() + DURACION_DE_SESION_MS);
  }

  get(id: string, devolver: (error: unknown, datos?: session.SessionData | null) => void): void {
    const repositorio = this.dataSource.getRepository(EsquemaDeSesion);
    void repositorio.findOneBy({ hashDeId: this.hashDeId(id) }).then(async (registro) => {
      if (!registro) return null;
      if (registro.venceEn.getTime() <= Date.now()) {
        await repositorio.delete({ hashDeId: registro.hashDeId });
        return null;
      }
      return registro.datos;
    }).then((datos) => devolver(null, datos), (error: unknown) => devolver(error));
  }

  set(id: string, datos: session.SessionData, devolver: (error?: unknown) => void = () => {}): void {
    const repositorio = this.dataSource.getRepository(EsquemaDeSesion);
    void (async () => {
      // La limpieza acompaña a los inicios de sesión, sin un proceso adicional.
      await repositorio.delete({ venceEn: LessThanOrEqual(new Date()) });
      await repositorio.upsert({ hashDeId: this.hashDeId(id), datos, venceEn: this.venceEn(datos) }, ['hashDeId']);
    })().then(() => devolver(), (error: unknown) => devolver(error));
  }

  touch(id: string, datos: session.SessionData, devolver: (error?: unknown) => void = () => {}): void {
    void this.dataSource.getRepository(EsquemaDeSesion)
      .update({ hashDeId: this.hashDeId(id) }, { venceEn: this.venceEn(datos) })
      .then(() => devolver(), (error: unknown) => devolver(error));
  }

  destroy(id: string, devolver: (error?: unknown) => void = () => {}): void {
    void this.dataSource.getRepository(EsquemaDeSesion).delete({ hashDeId: this.hashDeId(id) })
      .then(() => devolver(), (error: unknown) => devolver(error));
  }
}
