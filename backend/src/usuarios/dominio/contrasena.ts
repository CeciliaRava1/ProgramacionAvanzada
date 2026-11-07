/** Regla de contraseña de las cuentas: de 8 a 128 caracteres, sin espacios. Devuelve el error o null. */
export function errorDeContrasena(contrasena: string): string | null {
  const largo = [...contrasena].length;
  if (largo > 128) return 'La contraseña es demasiado larga.';
  if (largo < 8 || /\s/u.test(contrasena)) return 'Usá al menos 8 caracteres, sin espacios.';
  return null;
}
