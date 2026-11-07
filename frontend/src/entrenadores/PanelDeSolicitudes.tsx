import { useEffect, useRef, useState } from 'react';
import { obtenerSolicitudesRecibidas, responderSolicitud, type AccionSobreSolicitud, type SolicitudRecibida } from './solicitudes-de-entrenador.ts';

export function PanelDeSolicitudes({ alAceptar, alCambiarCantidad, alCambiarOcupado }: {
  alAceptar: () => void;
  alCambiarCantidad: (cantidad: number | null) => void;
  alCambiarOcupado: (ocupado: boolean) => void;
}) {
  const [solicitudes, setSolicitudes] = useState<SolicitudRecibida[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorDeCarga, setErrorDeCarga] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [accionFallida, setAccionFallida] = useState(false);
  const [idOcupado, setIdOcupado] = useState<number | null>(null);
  const [accionEnCurso, setAccionEnCurso] = useState<AccionSobreSolicitud | null>(null);
  const [intento, setIntento] = useState(0);
  const operacion = useRef<AbortController | null>(null);
  useEffect(() => () => {
    operacion.current?.abort();
    alCambiarOcupado(false);
  }, [alCambiarOcupado]);
  useEffect(() => {
    alCambiarCantidad(solicitudes?.length ?? null);
  }, [solicitudes, alCambiarCantidad]);

  useEffect(() => {
    const controlador = new AbortController();
    setCargando(true);
    setErrorDeCarga('');
    obtenerSolicitudesRecibidas(controlador.signal).then(
      (valor) => {
        if (!controlador.signal.aborted) {
          setSolicitudes(valor);
        }
      },
      (error: unknown) => {
        if (!controlador.signal.aborted) {
          setSolicitudes(null);
          setErrorDeCarga(error instanceof Error ? error.message : 'No se pudieron consultar las solicitudes.');
        }
      },
    ).finally(() => {
      if (!controlador.signal.aborted) {
        setCargando(false);
      }
    });
    const retomar = () => {
      if (document.visibilityState === 'visible') {
        setIntento((valor) => valor + 1);
      }
    };
    document.addEventListener('visibilitychange', retomar);

    return () => {
      controlador.abort();
      document.removeEventListener('visibilitychange', retomar);
    };
  }, [intento]);

  async function responder(id: number, accion: AccionSobreSolicitud) {
    if (operacion.current) {
      return;
    }

    const controlador = new AbortController();
    operacion.current = controlador;
    setIdOcupado(id);
    setAccionEnCurso(accion);
    alCambiarOcupado(true);
    setMensaje('');
    setAccionFallida(false);

    try {
      await responderSolicitud(id, accion, controlador.signal);

      if (!controlador.signal.aborted) {
        setMensaje(accion === 'aceptar' ? 'Solicitud aceptada. El alumno quedó vinculado.' : accion === 'rechazar' ? 'Solicitud rechazada.' : 'Solicitud cancelada.');

        if (accion === 'aceptar') {
          alAceptar();
        }
      }
    } catch (error: unknown) {
      if (!controlador.signal.aborted) {
        setAccionFallida(true);
        setMensaje(error instanceof Error ? error.message : 'No se pudo responder la solicitud.');
      }
    } finally {
      operacion.current = null;

      if (!controlador.signal.aborted) {
        setIdOcupado(null);
        alCambiarOcupado(false);
        setIntento((valor) => valor + 1);
      }
    }
  }

  return (
    <section aria-labelledby="titulo-de-solicitudes-recibidas" aria-busy={cargando || idOcupado !== null}>
      <h2 id="titulo-de-solicitudes-recibidas" className="sr-only">Solicitudes pendientes</h2>
      {cargando && <p className="mt-3 text-xs text-muted" role="status">Consultando solicitudes…</p>}
      {errorDeCarga &&
        <div className="mt-4">
          <p className="text-sm text-danger" role="alert">{errorDeCarga}</p>
          <button
            type="button"
            onClick={() => setIntento((valor) => valor + 1)}
            disabled={cargando || idOcupado !== null}
            className="mt-3 min-h-11 cursor-pointer rounded-field bg-field px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
          >Reintentar</button>
        </div>}
      {mensaje &&
        <p
          className={`mt-4 text-sm ${accionFallida ? 'text-danger' : 'text-muted'}`}
          role={accionFallida ? 'alert' : 'status'}
        >
          {mensaje}
        </p>}
      {!cargando && solicitudes?.length === 0 && <p className="mt-4 text-sm text-muted" role="status">No tenés solicitudes pendientes.</p>}
      {solicitudes && solicitudes.length > 0 &&
        (
          <ul className="list" aria-label="Solicitudes pendientes">
            {solicitudes.map((solicitud) => (
              <li key={solicitud.id} className="tarjeta-de-solicitud">
                <div className="cabecera-de-solicitud">
                  <span className="iniciales iniciales-grandes" aria-hidden="true">
                    {solicitud.alumno.nombre.slice(0, 1)}
                    {solicitud.alumno.apellido.slice(0, 1)}
                  </span>
                  <div className="row-copy">
                    <p className="row-title">{solicitud.alumno.nombre} {solicitud.alumno.apellido}</p>
                    <p className="row-meta">Quiere ser tu alumno</p>
                  </div>
                </div>
                <div className="acciones-de-solicitud">
                  {(['rechazar', 'aceptar'] as const).map((accion) => (
                    <button
                      key={accion}
                      type="button"
                      disabled={idOcupado !== null || cargando}
                      onClick={() => responder(solicitud.id, accion)}
                      className={accion === 'aceptar' ? 'primary' : 'secondary'}
                    >
                      {idOcupado === solicitud.id && accionEnCurso === accion
                        ? (accion === 'aceptar' ? 'Aceptando…' : 'Rechazando…')
                        : (accion === 'aceptar' ? 'Aceptar' : 'Rechazar')}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
