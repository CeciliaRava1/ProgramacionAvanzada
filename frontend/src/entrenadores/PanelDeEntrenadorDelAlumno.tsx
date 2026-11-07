import { useEffect, useRef, useState } from 'react';
import { ListaDeEntrenadores } from './ListaDeEntrenadores.tsx';
import { obtenerEstadoDelAlumno, responderSolicitud, type EstadoDelAlumno } from './solicitudes-de-entrenador.ts';
import { formatearTurnos } from './turnos.ts';

export function PanelDeEntrenadorDelAlumno({ mostrarLista, alCambiarMostrarLista, alCambiarPuedeElegir }: {
  mostrarLista: boolean;
  alCambiarMostrarLista: (mostrar: boolean) => void;
  alCambiarPuedeElegir: (puedeElegir: boolean) => void;
}) {
  const [vinculacion, setVinculacion] = useState<EstadoDelAlumno | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [errorDeCarga, setErrorDeCarga] = useState('');
  const [mensajeDeAccion, setMensajeDeAccion] = useState('');
  const [accionFallida, setAccionFallida] = useState(false);
  const [intento, setIntento] = useState(0);
  const operacion = useRef<AbortController | null>(null);
  const hayInteraccion = useRef(false);
  useEffect(() => () => operacion.current?.abort(), []);

  // Volver de una lista confirma el estado aunque se haya interrumpido un envío.
  useEffect(() => {
    const controlador = new AbortController();
    setCargando(true);
    setErrorDeCarga('');
    obtenerEstadoDelAlumno(controlador.signal).then(
      (valor) => {
        if (!controlador.signal.aborted) {
          setVinculacion(valor);
          alCambiarPuedeElegir(valor.estado === 'sin_asignar');

          if (valor.estado !== 'sin_asignar') {
            alCambiarMostrarLista(false);
          }
        }
      },
      (error: unknown) => {
        if (!controlador.signal.aborted) {
          setVinculacion(null);
          alCambiarPuedeElegir(false);
          setErrorDeCarga(error instanceof Error ? error.message : 'No se pudo consultar el estado.');
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
  }, [intento, mostrarLista, alCambiarPuedeElegir, alCambiarMostrarLista]);

  useEffect(() => {
    if (mostrarLista) {
      hayInteraccion.current = true;
    }

    if (!hayInteraccion.current) {
      return;
    }

    if (mostrarLista) {
      document.getElementById('titulo-de-entrenadores')?.focus();
    }
    else if (vinculacion?.estado === 'sin_asignar') {
      document.getElementById('ver-entrenadores')?.focus();
    }
    else {
      document.getElementById('titulo-del-entrenador-del-alumno')?.focus();
    }
  }, [mostrarLista, vinculacion?.estado]);

  async function cancelar(id: number) {
    if (operacion.current) {
      return;
    }

    hayInteraccion.current = true;
    const controlador = new AbortController();
    operacion.current = controlador;
    setOcupado(true);
    setMensajeDeAccion('');
    setAccionFallida(false);

    try {
      await responderSolicitud(id, 'cancelar', controlador.signal);

      if (!controlador.signal.aborted) {
        setVinculacion(null);
        setMensajeDeAccion('Solicitud cancelada.');
      }
    } catch (error: unknown) {
      if (!controlador.signal.aborted) {
        setAccionFallida(true);
        setMensajeDeAccion(error instanceof Error ? error.message : 'No se pudo cancelar la solicitud.');
      }
    } finally {
      operacion.current = null;

      if (!controlador.signal.aborted) {
        setOcupado(false);
        setIntento((valor) => valor + 1);
      }
    }
  }

  if (errorDeCarga) {
    return (
      <div className="tarjeta-de-superficie p-6 sm:p-8">
        <p className="text-sm text-danger" role="alert">{errorDeCarga}</p>
        <button
          type="button"
          onClick={() => setIntento((valor) => valor + 1)}
          className="mt-4 min-h-11 w-full cursor-pointer rounded-field bg-brand p-3 font-semibold text-brand-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >Reintentar</button>
      </div>
    );
  }

  if (!vinculacion) {
    return <p className="mt-6 text-sm text-muted" role="status">Consultando entrenador…</p>;
  }

  if (vinculacion.estado === 'sin_asignar' && mostrarLista) {
    return (
      <div>
        <ListaDeEntrenadores alSolicitar={() => {
          setVinculacion(null);
          alCambiarPuedeElegir(false);
          alCambiarMostrarLista(false);
          setMensajeDeAccion('');
          setIntento((valor) => valor + 1);
        }} />
      </div>
    );
  }

  return (
    <section aria-label="Vinculación con entrenador" aria-busy={cargando || ocupado}>
      {vinculacion.estado === 'sin_asignar'
        ? (
          <div className="tarjeta-de-superficie p-6 sm:p-8">
            <h3 className="text-xl font-semibold">Tu entrenador</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Elegí a quién enviar tu solicitud.</p>
            <button
              id="ver-entrenadores"
              type="button"
              disabled={cargando}
              onClick={() => {
                setMensajeDeAccion('');
                alCambiarMostrarLista(true);
              }}
              className="mt-6 min-h-12 w-full cursor-pointer rounded-field bg-brand px-5 py-3 font-semibold text-brand-foreground outline-hidden hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 sm:w-auto"
            >Ver entrenadores <span aria-hidden="true" className="ml-5">→</span></button>
          </div>
        )
        : (
          <div className="tarjeta-de-superficie p-6 [overflow-wrap:anywhere] sm:p-8">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-brand">
              {vinculacion.estado === 'pendiente' ? 'Solicitud enviada' : 'Acompañamiento'}
            </p>
            <h3 id="titulo-del-entrenador-del-alumno" tabIndex={-1} className="text-xl font-semibold">
              {vinculacion.estado === 'pendiente' ? 'Pendiente de aceptación' : 'Mi entrenador'}
            </h3>
            <p className="mt-5 text-lg">{vinculacion.entrenador.nombre} {vinculacion.entrenador.apellido}</p>
            {vinculacion.entrenador.horario.length > 0 && <p className="mt-2 text-sm text-muted">Horario: {formatearTurnos(vinculacion.entrenador.horario)}</p>}
            {vinculacion.estado === 'pendiente' &&
              (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => cancelar(vinculacion.solicitudId)}
                    disabled={ocupado || cargando}
                    className="min-h-11 w-full cursor-pointer rounded-field bg-panel p-3 text-sm text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 sm:w-auto"
                  >
                    {ocupado ? 'Cancelando…' : 'Cancelar solicitud'}
                  </button>
                </div>
              )}
          </div>
        )}
      {cargando && <p className="mt-3 text-xs text-muted" role="status">Consultando entrenador…</p>}
      {mensajeDeAccion &&
        <p
          className={`mt-4 text-sm ${accionFallida ? 'text-danger' : 'text-muted'}`}
          role={accionFallida ? 'alert' : 'status'}
        >
          {mensajeDeAccion}
        </p>}
    </section>
  );
}
