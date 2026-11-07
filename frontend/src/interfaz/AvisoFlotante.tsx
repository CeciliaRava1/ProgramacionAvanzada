import { useEffect } from 'react';

/** Alerta breve y flotante que confirma una acción; se cierra sola o con el botón. */
export function AvisoFlotante({ mensaje, alCerrar, duracionEnMs = 5000 }: {
  mensaje: string;
  alCerrar: () => void;
  duracionEnMs?: number;
}) {
  useEffect(() => {
    if (!mensaje) {
      return;
    }

    const temporizador = window.setTimeout(alCerrar, duracionEnMs);

    return () => window.clearTimeout(temporizador);
  }, [mensaje, alCerrar, duracionEnMs]);

  if (!mensaje) {
    return null;
  }

  return <div className="aviso-flotante" role="status" aria-live="polite" aria-atomic="true">
    <span className="aviso-flotante-texto">{mensaje}</span>
    <button type="button" className="aviso-flotante-cerrar" onClick={alCerrar} aria-label="Cerrar aviso">×</button>
  </div>;
}
