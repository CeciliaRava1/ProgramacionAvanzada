import { useEffect, useRef, useState } from 'react';
import { crearRutina, modificarRutina, consultarRutinas, ErrorDeRutina, type Rutina, type DatosDeRutina } from './rutinas.ts';
import { EditorDeRutina } from './EditorDeRutina.tsx';
import { PanelDeEjerciciosDeRutina } from './PanelDeEjerciciosDeRutina.tsx';
import type { RutaDelEntrenador, NavegarEntrenador } from '../entrenadores/navegacion-del-entrenador.ts';
import { Icono } from '../interfaz/Icono.tsx';

export function PanelDeRutinas({ alumnoId, nombreDelAlumno, planId, nombreDelPlan, deshabilitado, ruta, alNavegar, alCambiarGuardando }: {
  alumnoId: number;
  nombreDelAlumno: string;
  planId: number;
  nombreDelPlan: string;
  deshabilitado: boolean;
  ruta: RutaDelEntrenador;
  alNavegar: NavegarEntrenador;
  alCambiarGuardando: (guardando: boolean) => void;
}) {
  const [rutinas, setRutinas] = useState<Rutina[] | null>(null);
  const [cargando, setCargando] = useState(true),
    [errorDeCarga, setErrorDeCarga] = useState(''),
    [intento, setIntento] = useState(0);
  const [guardando, setGuardando] = useState(false),
    [mensaje, setMensaje] = useState(''),
    [incierto, setIncierto] = useState(false);
  const operacion = useRef<AbortController | null>(null);
  useEffect(() => () => {
    operacion.current?.abort();
    alCambiarGuardando(false);
  }, [alCambiarGuardando]);
  useEffect(() => {
    if (ruta.pantalla !== 'formulario-de-rutina') {
      setIncierto(false);
    }
  }, [ruta.pantalla]);
  useEffect(() => {
    const controlador = new AbortController();
    setCargando(true);
    setErrorDeCarga('');
    consultarRutinas(alumnoId, planId, controlador.signal).then(
      valor => {
        if (!controlador.signal.aborted) {
          setRutinas(valor);
        }
      },
      error => {
        if (!controlador.signal.aborted) {
          setErrorDeCarga(error instanceof Error ? error.message : 'No se pudieron consultar las rutinas.');
        }
      },
    ).finally(() => {
      if (!controlador.signal.aborted) {
        setCargando(false);
      }
    });
    const retomar = () => {
      if (document.visibilityState === 'visible') {
        setIntento(valor => valor + 1);
      }
    };
    document.addEventListener('visibilitychange', retomar);

    return () => {
      controlador.abort();
      document.removeEventListener('visibilitychange', retomar);
    };
  }, [alumnoId, planId, intento]);

  const seleccionada = rutinas?.find(rutina => rutina.id === ruta.rutinaId);
  const volver = () => alNavegar(ruta.rutinaId ? { pantalla: 'rutina', alumnoId, rutinaId: ruta.rutinaId } : { pantalla: 'alumno', alumnoId });

  async function guardar(datos: DatosDeRutina) {
    if (operacion.current || deshabilitado || cargando || errorDeCarga || rutinas === null || incierto || ruta.rutinaId && !seleccionada) {
      return;
    }

    const controlador = new AbortController(),
      id = seleccionada?.id;
    operacion.current = controlador;
    setGuardando(true);
    alCambiarGuardando(true);

    try {
      const guardada = id === undefined
        ? await crearRutina(alumnoId, planId, datos, controlador.signal)
        : await modificarRutina(alumnoId, planId, id, datos, controlador.signal);

      if (!controlador.signal.aborted) {
        setRutinas(valor => id === undefined ? [...(valor || []), guardada] : (valor || []).map(rutina => rutina.id === id ? guardada : rutina));
        setMensaje(id === undefined ? 'Rutina creada.' : 'Rutina actualizada.');
        alCambiarGuardando(false);
        alNavegar({ pantalla: 'rutina', alumnoId, rutinaId: guardada.id });
      }
    } catch (error: unknown) {
      if (!controlador.signal.aborted) {
        setIncierto(error instanceof ErrorDeRutina && (error.estado === 0 || error.estado >= 500));
      }

      throw error;
    } finally {
      operacion.current = null;

      if (!controlador.signal.aborted) {
        setGuardando(false);
        alCambiarGuardando(false);
        setCargando(true);
        setIntento(valor => valor + 1);
      }
    }
  }

  const noDisponible = deshabilitado || cargando || Boolean(errorDeCarga),
    resumen = ruta.pantalla === 'alumno',
    formulario = ruta.pantalla === 'formulario-de-rutina';

  return <section aria-label="Rutinas" aria-busy={cargando || guardando}>
    {resumen &&
      <div className="section-head">
        <h2>Rutinas{rutinas && <span className="muted small"> · {rutinas.length}</span>}</h2>
        <button
          type="button"
          className="primary"
          disabled={noDisponible || rutinas === null}
          onClick={() => {
            setMensaje('');
            alNavegar({ pantalla: 'formulario-de-rutina', alumnoId });
          }}
        ><Icono nombre="mas" />Crear rutina</button>
      </div>}
    {cargando && rutinas === null && <p role="status" className="notice muted">Consultando rutinas…</p>}
    {errorDeCarga &&
      <div className="notice">
        <p role="alert" className="text-danger">{errorDeCarga}</p>
        <button
          type="button"
          className="secondary"
          disabled={cargando || deshabilitado}
          onClick={() => setIntento(valor => valor + 1)}
        >Reintentar</button>
      </div>}
    {resumen && !cargando && !errorDeCarga && rutinas?.length === 0 && <div className="empty"><p>Todavía no hay rutinas en este plan.</p></div>}
    {resumen && rutinas &&
      <ul aria-label="Rutinas del plan" className="list">
        {rutinas.map(rutina => <li key={rutina.id}>
          <button
            type="button"
            className="fila-de-rutina"
            disabled={noDisponible}
            onClick={() => {
              setMensaje('');
              alNavegar({ pantalla: 'rutina', alumnoId, rutinaId: rutina.id });
            }}
          >
            <span className="row-copy">
              <span className="row-title">{rutina.nombre}</span>
              {rutina.descripcion && <span className="row-meta">{rutina.descripcion}</span>}
            </span>
            <Icono nombre="flecha" />
          </button>
        </li>)}
      </ul>}
    {formulario && (!ruta.rutinaId || seleccionada) &&
      <>
        <button type="button" className="back" disabled={guardando} onClick={volver}>
          <Icono nombre="atras" />
          {seleccionada ? seleccionada.nombre : 'Rutinas'}
        </button>
        <header className="page-head">
          <div>
            <h1 id="page-title" tabIndex={-1}>{seleccionada ? 'Editar rutina' : 'Crear rutina'}</h1>
            <p className="context">{nombreDelAlumno} · {nombreDelPlan}</p>
          </div>
        </header>
        <EditorDeRutina
          key={seleccionada?.id ?? 'nueva'}
          rutina={seleccionada ?? null}
          guardando={guardando}
          puedeGuardar={!noDisponible && rutinas !== null && !incierto}
          alGuardar={guardar}
          alCerrar={volver}
        />
        {incierto && <p role="alert" className="notice text-danger">Volvé a las rutinas y revisá el resultado antes de guardar otra vez.</p>}
      </>}
    {!resumen && ruta.rutinaId && !seleccionada && !cargando && !errorDeCarga &&
      <div className="empty">
        <h1 id="page-title" tabIndex={-1}>Rutina no disponible</h1>
        <button type="button" className="secondary" onClick={() => alNavegar({ pantalla: 'alumno', alumnoId })}>Volver a las rutinas</button>
      </div>}
    {!resumen && !formulario && seleccionada &&
      <>
        <button type="button" className="back" onClick={() => alNavegar({ pantalla: 'alumno', alumnoId })}><Icono nombre="atras" />Rutinas</button>
        <header className="page-head">
          <div>
            <h1 id="page-title" tabIndex={-1}>{seleccionada.nombre}</h1>
            <p className="context">{nombreDelAlumno}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Editar rutina"
            disabled={noDisponible}
            onClick={() => alNavegar({ pantalla: 'formulario-de-rutina', alumnoId, rutinaId: seleccionada.id })}
          >
            <Icono nombre="editar" />
          </button>
        </header>
        {seleccionada.descripcion && <p className="descripcion-de-la-rutina">{seleccionada.descripcion}</p>}
        {mensaje && <p role="status" className="notice text-brand">{mensaje}</p>}
        <PanelDeEjerciciosDeRutina
          key={seleccionada.id}
          contexto={{ alumnoId, planId, rutinaId: seleccionada.id }}
          nombreDelAlumno={nombreDelAlumno}
          nombreDeLaRutina={seleccionada.nombre}
          deshabilitado={noDisponible || guardando}
          ruta={ruta}
          alNavegar={alNavegar}
          alCambiarOcupado={alCambiarGuardando}
        />
      </>}
  </section>;
}
