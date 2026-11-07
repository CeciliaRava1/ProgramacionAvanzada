import { useEffect, useState } from 'react';
import {
  consultarPlanificacion, consultarRutinaDelAlumno, ErrorDePlanificacion,
  type VistaDePlanificacion, type VistaDeRutinaDelAlumno,
} from './planificacion-del-alumno.ts';
import { formatearTiempoDeDescanso, resumenDeEjercicioDeRutina } from './ejercicios-de-rutina.ts';
import { Icono } from '../interfaz/Icono.tsx';

/** Vista del alumno: su plan, sus rutinas y los ejercicios de cada una (solo lectura). */
export function PanelDePlanificacionDelAlumno({ alumnoId, rutinaId, alAbrirRutina, alVolver }: {
  alumnoId: number;
  rutinaId?: number;
  alAbrirRutina: (id: number) => void;
  alVolver: () => void;
}) {
  const [planificacion, setPlanificacion] = useState<VistaDePlanificacion | null>(null);
  const [detalle, setDetalle] = useState<VistaDeRutinaDelAlumno | null>(null);
  const [cargando, setCargando] = useState(true),
    [error, setError] = useState<ErrorDePlanificacion | null>(null),
    [intento, setIntento] = useState(0);
  useEffect(() => {
    const controlador = new AbortController();
    setCargando(true);
    setError(null);
    setPlanificacion(null);
    setDetalle(null);

    async function cargar() {
      try {
        const valor = await consultarPlanificacion(alumnoId, controlador.signal);

        if (controlador.signal.aborted) {
          return;
        }

        setPlanificacion(valor);

        if (rutinaId !== undefined) {
          if (!valor.plan || !valor.rutinas.some(rutina => rutina.id === rutinaId)) {
            throw new ErrorDePlanificacion('La rutina ya no está disponible.', 404);
          }

          const rutina = await consultarRutinaDelAlumno(rutinaId, valor.plan.id, controlador.signal);

          if (!controlador.signal.aborted) {
            setDetalle(rutina);
          }
        }
      } catch (falla: unknown) {
        if (!controlador.signal.aborted) {
          setError(falla instanceof ErrorDePlanificacion ? falla : new ErrorDePlanificacion('No se pudo consultar tu planificación. Intentá nuevamente.'));
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    void cargar();
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
  }, [alumnoId, rutinaId, intento]);

  const comentarios = <>
    {cargando && <p role="status" className="notice muted">{rutinaId === undefined ? 'Consultando tu plan…' : 'Consultando rutina…'}</p>}
    {error &&
      <div className="notice">
        <p role="alert" className="text-danger">{error.message}</p>
        {error.estado !== 400 && error.estado !== 404 &&
          <button type="button" className="secondary" disabled={cargando} onClick={() => setIntento(valor => valor + 1)}>Reintentar</button>}
      </div>}
  </>;

  if (rutinaId !== undefined) {
    return <section aria-label="Consulta de rutina" className="planificacion-del-alumno" aria-busy={cargando}>
      <button type="button" className="back" onClick={alVolver}><Icono nombre="atras" />Mi plan</button>
      <header className="page-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>{error?.estado === 404 ? 'Rutina no disponible' : detalle?.rutina.nombre ?? 'Rutina'}</h1>
          {planificacion?.plan && <p className="context">{planificacion.plan.nombre}</p>}
        </div>
      </header>
      {comentarios}
      {!cargando && !error && detalle &&
        <>
          {detalle.rutina.descripcion && <p className="descripcion-de-la-rutina">{detalle.rutina.descripcion}</p>}
          <div className="section-head"><h2>Ejercicios <span className="muted small">· {detalle.ejercicios.length}</span></h2></div>
          {detalle.ejercicios.length === 0 && <div className="empty"><p>Todavía no hay ejercicios en esta rutina.</p></div>}
          <ul className="list" aria-label="Ejercicios de la rutina">
            {detalle.ejercicios.map(elemento => <li key={elemento.id}>
              <article className="ejercicio-del-alumno" aria-labelledby={'ejercicio-del-alumno-' + elemento.id}>
                <h3 id={'ejercicio-del-alumno-' + elemento.id} className="row-title">{elemento.ejercicio.nombre}</h3>
                <p className="row-meta">{elemento.ejercicio.musculoObjetivo} · {elemento.ejercicio.equipamiento}</p>
                <p className="resumen-del-ejercicio-del-alumno">{resumenDeEjercicioDeRutina(elemento)}</p>
                {(elemento.descansoEnSegundos !== null || elemento.rirRecomendado !== null) &&
                  <p className="row-meta">
                    {[elemento.descansoEnSegundos === null ? '' : 'Descanso ' + formatearTiempoDeDescanso(elemento.descansoEnSegundos), elemento.rirRecomendado === null ? '' : 'RIR ' + elemento.rirRecomendado].filter(Boolean).join(' · ')}
                  </p>}
                <details className="descripcion-del-ejercicio">
                  <summary><Icono nombre="flecha" />Cómo se realiza</summary>
                  <p>{elemento.ejercicio.instrucciones}</p>
                </details>
              </article>
            </li>)}
          </ul>
        </>}
    </section>;
  }

  return <section aria-label="Mi plan" className="planificacion-del-alumno" aria-busy={cargando}>
    <h2 className="titulo-de-seccion-del-alumno">Mi plan</h2>
    {comentarios}
    {!cargando && !error && planificacion &&
      (planificacion.plan === null
        ? <div className="empty"><p>Todavía no tenés un plan cargado.</p></div>
        : <>
          <div className="resumen-del-plan">
            <h3 className="nombre-del-plan-del-alumno">{planificacion.plan.nombre}</h3>
            <p className="objetivo-del-plan">{planificacion.plan.objetivo}</p>
          </div>
          <div className="section-head"><h3>Rutinas <span className="muted small">· {planificacion.rutinas.length}</span></h3></div>
          {planificacion.rutinas.length === 0 && <div className="empty"><p>Tu plan todavía no tiene rutinas.</p></div>}
          <ul className="list" aria-label="Mis rutinas">
            {planificacion.rutinas.map(rutina => <li key={rutina.id}>
              <button type="button" className="fila-de-rutina" onClick={() => alAbrirRutina(rutina.id)}>
                <span className="row-copy">
                  <span className="row-title">{rutina.nombre}</span>
                  {rutina.descripcion && <span className="row-meta">{rutina.descripcion}</span>}
                </span>
                <Icono nombre="flecha" />
              </button>
            </li>)}
          </ul>
        </>)}
  </section>;
}
