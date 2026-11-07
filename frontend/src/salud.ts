export async function comprobarSaludDelBackend(senal: AbortSignal): Promise<void> {
  const respuesta = await fetch('http://127.0.0.1:3000/health', {
    signal: AbortSignal.any([senal, AbortSignal.timeout(5000)]),
  });

  if (!respuesta.ok) {
    throw new Error('El backend respondió con un error.');
  }

  // `status` es la clave que define el contrato de /health (convención de infraestructura).
  const cuerpo: unknown = await respuesta.json();
  if (typeof cuerpo !== 'object' || cuerpo === null || !('status' in cuerpo) || cuerpo.status !== 'ok') {
    throw new Error('La respuesta del backend no es válida.');
  }
}
