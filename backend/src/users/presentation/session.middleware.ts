import type { ConfigService } from '@nestjs/config';
import type { RequestHandler } from 'express';
import session from 'express-session';
import type { DataSource } from 'typeorm';
import { SESSION_TTL_MS, TypeOrmSessionStore } from '../infrastructure/typeorm-session.store.js';

declare module 'express-session' {
  interface SessionData { userId?: number; }
}

export const sessionCookieName = 'gymhelper.sid';
export const sessionCookiePath = '/users';

/** El secreto permanece estable entre reinicios; nunca se reutiliza la contraseña de MySQL. */
export function createSessionMiddleware(config: ConfigService, dataSource: DataSource): RequestHandler {
  const secret = config.get<string>('SESSION_SECRET');
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET debe contener al menos 32 caracteres en backend/.env');
  const handler = session({
    name: sessionCookieName,
    secret,
    store: new TypeOrmSessionStore(dataSource),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.get<string>('NODE_ENV') === 'production',
      path: sessionCookiePath,
      maxAge: SESSION_TTL_MS,
    },
  });
  return (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET' && request.get('origin') !== 'http://127.0.0.1:5173') {
      response.status(403).json({ message: 'Origen no permitido.' });
      return;
    }
    handler(request, response, (error?: unknown) => {
      if (error) { response.status(503).json({ message: 'No se pudo consultar la sesión. Intentá nuevamente.' }); return; }
      // Retira el alcance anterior y conserva las sesiones existentes al ampliar la cookie.
      if (request.headers.cookie?.includes(`${sessionCookieName}=`)) {
        response.clearCookie(sessionCookieName, { path: '/users/session' });
      }
      if (request.session.cookie.path !== sessionCookiePath) {
        request.session.cookie.path = sessionCookiePath;
        request.session.save((saveError) => {
          if (saveError) { response.status(503).json({ message: 'No se pudo actualizar la sesión. Intentá nuevamente.' }); return; }
          next();
        });
        return;
      }
      next();
    });
  };
}
