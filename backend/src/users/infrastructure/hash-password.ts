import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const dummyHash = `scrypt$131072$8$1$${'00'.repeat(16)}$${'00'.repeat(64)}`;

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 },
      (error, key) => error ? reject(error) : resolve(key));
  });
}

/** Guarda algoritmo, costo y sal junto al hash para su futura verificación. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt);
  return `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;
}

/** El costo se mantiene aunque no exista la cuenta; no se altera la contraseña. */
export async function verifyPassword(password: string, storedHash?: string): Promise<boolean> {
  const validFormat = /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(storedHash ?? '');
  const parts = (validFormat ? storedHash! : dummyHash).split('$');
  const key = await deriveKey(password, parts[4]);
  return timingSafeEqual(key, Buffer.from(parts[5], 'hex')) && validFormat;
}
