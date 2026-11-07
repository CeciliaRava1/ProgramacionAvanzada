import type { ConfigService } from '@nestjs/config';
import type { RequestHandler } from 'express';
import session from 'express-session';
import type { DataSource } from 'typeorm';
import { DURACION_DE_SESION_MS, AlmacenDeSesionesTypeOrm } from '../infraestructura/almacen-de-sesiones.js';

declare module 'express-session' {
  interface SessionData { usuarioId?: number; }
}

export const NOMBRE_DE_COOKIE_DE_SESION = 'gymhelper.sesion';
// La cookie debe llegar a todas las rutas con sesión: las de /usuarios y las del módulo de planes (/users).
export const RUTA_DE_COOKIE_DE_SESION = '/';

/** Origen del frontend autorizado para CORS y para las operaciones que modifican datos. */
export function origenDelFrontend(config: ConfigService): string {
  return config.get<string>('ORIGEN_DEL_FRONTEND') ?? 'http://127.0.0.1:5173';
}

/** El secreto permanece estable entre reinicios; nunca se reutiliza la contraseña de MySQL. */
export function crearMiddlewareDeSesion(config: ConfigService, dataSource: DataSource): RequestHandler {
  const secreto = config.get<string>('SECRETO_DE_SESION');
  if (!secreto || secreto.length < 32) throw new Error('SECRETO_DE_SESION debe contener al menos 32 caracteres en el archivo .env');
  const origenPermitido = origenDelFrontend(config);
  const manejador = session({
    name: NOMBRE_DE_COOKIE_DE_SESION,
    secret: secreto,
    store: new AlmacenDeSesionesTypeOrm(dataSource),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.get<string>('NODE_ENV') === 'production',
      path: RUTA_DE_COOKIE_DE_SESION,
      maxAge: DURACION_DE_SESION_MS,
    },
  });
  return (peticion, respuesta, siguiente) => {
    respuesta.setHeader('Cache-Control', 'no-store');
    if (peticion.method !== 'GET' && peticion.get('origin') !== origenPermitido) {
      respuesta.status(403).json({ message: 'Origen no permitido.' });
      return;
    }
    manejador(peticion, respuesta, (error?: unknown) => {
      if (error) { respuesta.status(503).json({ message: 'No se pudo consultar la sesión. Intentá nuevamente.' }); return; }
      siguiente();
    });
  };
}
