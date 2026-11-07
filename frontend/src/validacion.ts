export function esRegistroConClaves(
  valor: unknown,
  claves: readonly string[],
): valor is Record<string, unknown> {
  return typeof valor === 'object' &&
    valor !== null &&
    !Array.isArray(valor) &&
    Object.keys(valor).length === claves.length &&
    claves.every(clave => Object.hasOwn(valor, clave));
}
