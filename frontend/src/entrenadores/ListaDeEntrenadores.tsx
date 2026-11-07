import { useEffect, useRef, useState } from 'react';
import { obtenerEntrenadores, type ResumenDeEntrenador } from './entrenadores.ts';
import { enviarSolicitud, ErrorDeSolicitud } from './solicitudes-de-entrenador.ts';
import { formatearTurnos } from './turnos.ts';

/** Mantiene carga, error y resultado separados para no confundir un fallo con una lista vacía. */
export function ListaDeEntrenadores({ alSolicitar }: {
  alSolicitar: () => void;
}) {
  const [entrenadores, setEntrenadores] = useState<ResumenDeEntrenador[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [mensaje, setMensaje] = useState('');
  const [intento, setIntento] = useState(0);
  const [idEnEnvio, setIdEnEnvio] = useState<number | null>(null);
  const [errorDeAccion, setErrorDeAccion] = useState('');
  const operacion = useRef<AbortController | null>(null);
  useEffect(() => () => operacion.current?.abort(), []);

  async function enviar(entrenadorId: number) {
    if (operacion.current) {
      return;
    }

    const controlador = new AbortController();
    operacion.current = controlador;
    setIdEnEnvio(entrenadorId);
    setErrorDeAccion('');

    try {
      await enviarSolicitud(entrenadorId, controlador.signal);

      if (!controlador.signal.aborted) {
        alSolicitar();
      }
    } catch (error: unknown) {
      if (!controlador.signal.aborted) {
        if (error instanceof ErrorDeSolicitud && error.estado === 409) {
          alSolicitar();
        }
        else {
          setErrorDeAccion(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.');
        }
      }
    } finally {
      operacion.current = null;

      if (!controlador.signal.aborted) {
        setIdEnEnvio(null);
      }
    }
  }

  useEffect(() => {
    const controlador = new AbortController();
    setEstado('cargando');
    setMensaje('');
    obtenerEntrenadores(controlador.signal).then(
      (resultado) => {
        if (!controlador.signal.aborted) {
          setEntrenadores(resultado);
          setEstado('listo');
        }
      },
      (error: unknown) => {
        if (!controlador.signal.aborted) {
          setMensaje(error instanceof Error ? error.message : 'No se pudo consultar el listado.');
          setEstado('error');
        }
      },
    );

    return () => controlador.abort();
  }, [intento]);

  return (
    <section aria-labelledby="titulo-de-entrenadores">
      <h2 id="titulo-de-entrenadores" tabIndex={-1} className="text-2xl font-semibold tracking-tight">Entrenadores</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">Elegí el entrenador al que querés enviar tu solicitud.</p>
      {errorDeAccion && <p className="mt-4 text-sm text-danger" role="alert">{errorDeAccion}</p>}
      {estado === 'cargando' && <p className="mt-6 text-sm text-muted" role="status">Consultando entrenadores…</p>}
      {estado === 'error' &&
        (
          <div className="mt-6">
            <p className="text-sm text-danger" role="alert">{mensaje}</p>
            <button
              type="button"
              onClick={() => setIntento((valor) => valor + 1)}
              className="mt-4 min-h-12 w-full cursor-pointer rounded-field bg-brand px-4 py-3 font-semibold text-brand-foreground outline-hidden hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >Reintentar</button>
          </div>
        )}
      {estado === 'listo' &&
        (entrenadores.length === 0
          ? (
            <p className="mt-6 text-sm text-muted" role="status">Todavía no hay entrenadores registrados.</p>
          )
          : (
            <ul className="mt-6 grid list-none gap-5 p-0 lg:grid-cols-2" aria-label="Listado de entrenadores">
              {entrenadores.map((entrenador) => (
                <li key={entrenador.id} className="tarjeta-de-superficie flex flex-col p-6 [overflow-wrap:anywhere]">
                  <h3 className="text-lg font-semibold text-body">{entrenador.nombre} {entrenador.apellido}</h3>
                  {entrenador.horario.length > 0 && <p className="mt-2 text-sm text-muted">Horario: {formatearTurnos(entrenador.horario)}</p>}
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => enviar(entrenador.id)}
                    disabled={idEnEnvio !== null}
                    className="mt-6 min-h-11 w-full cursor-pointer rounded-field bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground outline-hidden hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-60"
                  >
                    {idEnEnvio === entrenador.id ? 'Enviando…' : 'Solicitar entrenador'}
                  </button>
                </li>
              ))}
            </ul>
          ))}
    </section>
  );
}
