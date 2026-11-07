import { useCallback, useEffect, useState } from 'react';
import { obtenerAlumnosAsignados, type AlumnoAsignado } from './alumnos-asignados.ts';
import { PanelDeSolicitudes } from './PanelDeSolicitudes.tsx';
import { StudentPlansPanel } from '../plans/StudentPlansPanel.tsx';
import type { RutaDelEntrenador, NavegarEntrenador } from './navegacion-del-entrenador.ts';
import { Icono } from '../interfaz/Icono.tsx';

export function PanelDeAlumnosDelEntrenador({ ruta, alNavegar, alCambiarOcupado }: {
  ruta: RutaDelEntrenador;
  alNavegar: NavegarEntrenador;
  alCambiarOcupado: (ocupado: boolean) => void;
}) {
  const [alumnos, setAlumnos] = useState<AlumnoAsignado[] | null>(null);
  const [cargando, setCargando] = useState(true),
    [error, setError] = useState(''),
    [intento, setIntento] = useState(0);
  const [cantidadDeSolicitudes, setCantidadDeSolicitudes] = useState<number | null>(null);
  const alAceptar = useCallback(() => setIntento(valor => valor + 1), []);
  useEffect(() => {
    const controlador = new AbortController();
    setCargando(true);
    setError('');
    obtenerAlumnosAsignados(controlador.signal).then(
      valor => {
        if (!controlador.signal.aborted) {
          setAlumnos(valor);
        }
      },
      motivo => {
        if (!controlador.signal.aborted) {
          setAlumnos(null);
          setError(motivo instanceof Error ? motivo.message : 'No se pudo consultar el listado de alumnos.');
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
  }, [intento]);

  const seleccionado = alumnos?.find(alumno => alumno.id === ruta.studentId);

  if (ruta.studentId !== undefined) {
    if (seleccionado) {
      return <StudentPlansPanel
        key={seleccionado.id}
        student={seleccionado}
        route={ruta}
        onNavigate={alNavegar}
        onBusyChange={alCambiarOcupado}
      />;
    }

    return <>
      <button type="button" className="back" onClick={() => alNavegar({ screen: 'alumnos' })}><Icono nombre="atras" />Alumnos</button>
      <h1 id="page-title" tabIndex={-1}>Alumno</h1>
      {cargando
        ? <p role="status" className="notice muted">Consultando alumno…</p>
        : <p role="alert" className="notice text-danger">{error || 'Este alumno no está disponible entre tus alumnos vinculados.'}</p>}
      {error && <button className="secondary" onClick={alAceptar}>Reintentar</button>}
    </>;
  }

  return <section>
    <header className="page-head"><h1 id="page-title" tabIndex={-1}>Mis alumnos</h1></header>
    <nav aria-label="Alumnos y solicitudes" className="pestanas">
      <button
        type="button"
        aria-current={ruta.screen === 'alumnos' ? 'page' : undefined}
        onClick={() => alNavegar({ screen: 'alumnos' })}
      >Alumnos{alumnos && <span className="badge">{alumnos.length}</span>}</button>
      <button
        type="button"
        aria-current={ruta.screen === 'solicitudes' ? 'page' : undefined}
        onClick={() => alNavegar({ screen: 'solicitudes' })}
      >Solicitudes{cantidadDeSolicitudes !== null && <span className="badge">{cantidadDeSolicitudes}</span>}</button>
    </nav>
    <div hidden={ruta.screen !== 'solicitudes'}>
      <PanelDeSolicitudes alAceptar={alAceptar} alCambiarCantidad={setCantidadDeSolicitudes} alCambiarOcupado={alCambiarOcupado} />
    </div>
    <section hidden={ruta.screen !== 'alumnos'} aria-label="Alumnos vinculados" aria-busy={cargando}>
      {cargando && <p className="notice muted" role="status">Consultando alumnos…</p>}
      {error &&
        <div className="notice">
          <p className="text-danger" role="alert">{error}</p>
          <button className="secondary" disabled={cargando} onClick={alAceptar}>Reintentar</button>
        </div>}
      {!cargando && alumnos?.length === 0 &&
        <div className="empty">
          <h2>Todavía no tenés alumnos vinculados</h2>
          <p>Las solicitudes de alumnos se reciben en Solicitudes.</p>
        </div>}
      {alumnos &&
        <ul className="list" aria-label="Alumnos vinculados">
          {alumnos.map(alumno => <li key={alumno.id}>
            <button
              type="button"
              className="fila-de-persona"
              onClick={() => alNavegar({ screen: 'student', studentId: alumno.id })}
            >
              <span className="iniciales" aria-hidden="true">
                {alumno.nombre.slice(0, 1)}
                {alumno.apellido.slice(0, 1)}
              </span>
              <span className="row-copy"><span className="row-title">{alumno.nombre} {alumno.apellido}</span></span>
              <Icono nombre="flecha" />
            </button>
          </li>)}
        </ul>}
    </section>
  </section>;
}
