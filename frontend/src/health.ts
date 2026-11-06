export async function checkBackendHealth(signal: AbortSignal): Promise<void> {
  const response = await fetch('http://127.0.0.1:3000/health', {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
  });

  if (!response.ok) {
    throw new Error('El backend respondió con un error.');
  }

  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || !('status' in body) || body.status !== 'ok') {
    throw new Error('La respuesta del backend no es válida.');
  }
}
