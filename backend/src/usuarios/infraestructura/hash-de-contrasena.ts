import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const hashFicticio = `scrypt$131072$8$1$${'00'.repeat(16)}$${'00'.repeat(64)}`;

function derivarClave(contrasena: string, sal: string): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(contrasena, sal, 64, { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 },
      (error, clave) => error ? rechazar(error) : resolver(clave));
  });
}

/** Guarda algoritmo, costo y sal junto al hash para su futura verificación. */
export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16).toString('hex');
  const clave = await derivarClave(contrasena, sal);
  return `scrypt$131072$8$1$${sal}$${clave.toString('hex')}`;
}

/** El costo se mantiene aunque no exista la cuenta; no se altera la contraseña. */
export async function verificarContrasena(contrasena: string, hashGuardado?: string): Promise<boolean> {
  const formatoValido = /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hashGuardado ?? '');
  const partes = (formatoValido ? hashGuardado! : hashFicticio).split('$');
  const clave = await derivarClave(contrasena, partes[4]);
  return timingSafeEqual(clave, Buffer.from(partes[5], 'hex')) && formatoValido;
}
