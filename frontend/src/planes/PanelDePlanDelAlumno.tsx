import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AlumnoAsignado } from '../entrenadores/alumnos-asignados.ts';
import type { RutaDelEntrenador, NavegarEntrenador } from '../entrenadores/navegacion-del-entrenador.ts';
import { Icono } from '../interfaz/Icono.tsx';
import {
  crearPlan, modificarPlan, eliminarPlan, consultarPlanes, obtenerErroresDePlan,
  type PlanDeEntrenamiento, type ErroresDePlan,
} from './planes.ts';
import { PanelDeRutinas } from './PanelDeRutinas.tsx';

/** Plan del alumno (uno por alumno) y, debajo, sus rutinas; lo gestiona el entrenador asignado. */
export function PanelDePlanDelAlumno({ alumno, ruta, alNavegar, alCambiarOcupado }: {
  alumno: AlumnoAsignado;
  ruta: RutaDelEntrenador;
  alNavegar: NavegarEntrenador;
  alCambiarOcupado: (ocupado: boolean) => void;
}) {
  const [planes, setPlanes] = useState<PlanDeEntrenamiento[] | null>(null);
  const [cargando, setCargando] = useState(true),
    [errorDeCarga, setErrorDeCarga] = useState(''),
    [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState({ nombre: '', objetivo: '' });
  const [erroresDeCampo, setErroresDeCampo] = useState<ErroresDePlan>({});
  const [guardando, setGuardando] = useState(false),
    [mensaje, setMensaje] = useState(''),
    [fallo, setFallo] = useState(false);
  const [idEnEdicion, setIdEnEdicion] = useState<number | null>(null),
    [idAEliminar, setIdAEliminar] = useState<number | null>(null);
  const abierto = useRef('');
  const operacion = useRef<AbortController | null>(null);
  useEffect(() => () => {
    operacion.current?.abort();
    alCambiarOcupado(false);
  }, [alCambiarOcupado]);
  useEffect(() => {
    const controlador = new AbortController();
    setCargando(true);
    setErrorDeCarga('');
    consultarPlanes(alumno.id, controlador.signal).then(
      valor => {
        if (!controlador.signal.aborted) {
          setPlanes(valor);
        }
      },
      error => {
        if (!controlador.signal.aborted) {
          setPlanes(null);
          setErrorDeCarga(error instanceof Error ? error.message : 'No se pudieron consultar los planes.');
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
  }, [alumno.id, intento]);
  useEffect(() => {
    const enFormulario = ruta.pantalla === 'formulario-de-plan' || ruta.pantalla === 'eliminar-plan';

    if (!enFormulario) {
      abierto.current = '';

      return;
    }

    if (planes === null || abierto.current === ruta.pantalla) {
      return;
    }

    abierto.current = ruta.pantalla;
    setMensaje('');
    setErroresDeCampo({});
    setFallo(false);

    if (ruta.pantalla === 'formulario-de-plan') {
      setIdEnEdicion(planes[0]?.id ?? null);
      setDatos({ nombre: planes[0]?.nombre ?? '', objetivo: planes[0]?.objetivo ?? '' });
    } else {
      setIdAEliminar(planes[0]?.id ?? null);
    }
  }, [ruta.pantalla, planes]);

  const volver = () => alNavegar({ pantalla: 'alumno', alumnoId: alumno.id });

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (operacion.current || cargando || errorDeCarga || planes === null || (idEnEdicion === null && planes.length !== 0)) {
      return;
    }

    const errores = obtenerErroresDePlan(datos);
    setErroresDeCampo(errores);
    setMensaje('');

    if (Object.keys(errores).length) {
      document.getElementById('plan-' + Object.keys(errores)[0])?.focus();

      return;
    }

    const controlador = new AbortController();
    operacion.current = controlador;
    setGuardando(true);
    alCambiarOcupado(true);
    setFallo(false);

    try {
      const guardado = idEnEdicion === null ? await crearPlan(alumno.id, datos, controlador.signal) : await modificarPlan(alumno.id, idEnEdicion, datos, controlador.signal);

      if (!controlador.signal.aborted) {
        setPlanes([guardado]);
        setMensaje(idEnEdicion === null ? 'Plan creado.' : 'Plan actualizado.');
        alCambiarOcupado(false);
        volver();
      }
    } catch (error: unknown) {
      if (!controlador.signal.aborted) {
        setFallo(true);
        setMensaje(error instanceof Error ? error.message : 'No se pudo confirmar el guardado del plan.');
      }
    } finally {
      operacion.current = null;

      if (!controlador.signal.aborted) {
        setGuardando(false);
        alCambiarOcupado(false);
        setCargando(true);
        setIntento(valor => valor + 1);
      }
    }
  }

  async function eliminar() {
    if (operacion.current || cargando || errorDeCarga || idAEliminar === null || planes?.[0]?.id !== idAEliminar) {
      return;
    }

    const controlador = new AbortController();
    operacion.current = controlador;
    setGuardando(true);
    alCambiarOcupado(true);
    setMensaje('');
    setFallo(false);

    try {
      await eliminarPlan(alumno.id, idAEliminar, controlador.signal);

      if (!controlador.signal.aborted) {
        setPlanes([]);
        setMensaje('Plan eliminado.');
        alCambiarOcupado(false);
        volver();
      }
    } catch (error: unknown) {
      if (!controlador.signal.aborted) {
        setFallo(true);
        setMensaje(error instanceof Error ? error.message : 'No se pudo confirmar la eliminación del plan.');
      }
    } finally {
      operacion.current = null;

      if (!controlador.signal.aborted) {
        setGuardando(false);
        alCambiarOcupado(false);
        setCargando(true);
        setIntento(valor => valor + 1);
      }
    }
  }

  const plan = planes?.[0],
    formulario = ruta.pantalla === 'formulario-de-plan',
    eliminando = ruta.pantalla === 'eliminar-plan',
    resumen = ruta.pantalla === 'alumno';
  const nombreDelAlumno = alumno.nombre + ' ' + alumno.apellido;

  return <section aria-busy={guardando}>
    {(resumen || formulario || eliminando || !plan) &&
      <>
        <button
          type="button"
          className="back"
          disabled={guardando}
          onClick={resumen || !plan && !formulario && !eliminando ? () => alNavegar({ pantalla: 'alumnos' }) : volver}
        >
          <Icono nombre="atras" />
          {resumen || !plan && !formulario && !eliminando ? 'Alumnos' : nombreDelAlumno}
        </button>
        <header className="page-head">
          <div>
            <h1 id="page-title" tabIndex={-1}>{formulario ? idEnEdicion === null ? 'Crear plan' : 'Editar plan' : eliminando ? 'Eliminar plan' : nombreDelAlumno}</h1>
            {(formulario || eliminando) && <p className="context">{nombreDelAlumno}</p>}
          </div>
        </header>
      </>}
    {cargando && planes === null && <p role="status" className="notice muted">Consultando plan…</p>}
    {errorDeCarga &&
      <div className="notice">
        <p role="alert" className="text-danger">{errorDeCarga}</p>
        <button
          type="button"
          className="secondary"
          disabled={cargando || guardando}
          onClick={() => setIntento(valor => valor + 1)}
        >Reintentar</button>
      </div>}
    {mensaje && (resumen || formulario || eliminando) &&
      <p role={fallo ? 'alert' : 'status'} className={'notice ' + (fallo ? 'text-danger' : 'text-brand')}>{mensaje}</p>}
    {resumen && plan &&
      <div className="resumen-del-plan">
        <p className="etiqueta-de-seccion">Plan de entrenamiento</p>
        <div className="encabezado-del-plan">
          <h2>{plan.nombre}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Editar plan"
            disabled={cargando}
            onClick={() => alNavegar({ pantalla: 'formulario-de-plan', alumnoId: alumno.id })}
          >
            <Icono nombre="editar" />
          </button>
        </div>
        <p className="objetivo-del-plan">{plan.objetivo}</p>
        <details className="opciones-del-plan">
          <summary><Icono nombre="abajo" />Más opciones del plan</summary>
          <button
            type="button"
            className="text-button danger"
            disabled={cargando}
            onClick={() => alNavegar({ pantalla: 'eliminar-plan', alumnoId: alumno.id })}
          >Eliminar plan</button>
        </details>
      </div>}
    {!formulario && !eliminando && !cargando && planes?.length === 0 &&
      <div className="empty">
        <h2>Sin plan de entrenamiento</h2>
        <p>Creá un plan para organizar sus rutinas.</p>
        <button
          type="button"
          className="primary"
          onClick={() => alNavegar({ pantalla: 'formulario-de-plan', alumnoId: alumno.id })}
        ><Icono nombre="mas" />Crear plan</button>
      </div>}
    {formulario && planes !== null &&
      <form onSubmit={enviar} noValidate className="edit-form">
        <fieldset disabled={guardando || cargando || Boolean(errorDeCarga)} className="form-fields">
          <legend className="sr-only">Datos del plan</legend>
          {(['nombre', 'objetivo'] as const).map(campo => <div key={campo}>
            <label htmlFor={'plan-' + campo}>{campo === 'nombre' ? 'Nombre del plan' : 'Objetivo'}</label>
            {campo === 'nombre'
              ? <input
                id="plan-nombre"
                name={campo}
                value={datos.nombre}
                required
                maxLength={200}
                onChange={evento => setDatos(valor => ({ ...valor, nombre: evento.target.value }))}
                className="field"
                aria-invalid={Boolean(erroresDeCampo.nombre)}
                aria-describedby={erroresDeCampo.nombre ? 'plan-nombre-error' : undefined}
              />
              :
              <textarea
                id="plan-objetivo"
                name={campo}
                value={datos.objetivo}
                required
                maxLength={5000}
                rows={4}
                onChange={evento => setDatos(valor => ({ ...valor, objetivo: evento.target.value }))}
                className="field"
                aria-invalid={Boolean(erroresDeCampo.objetivo)}
                aria-describedby={erroresDeCampo.objetivo ? 'plan-objetivo-error' : undefined}
              />}
            {erroresDeCampo[campo] && <p id={'plan-' + campo + '-error'} className="field-error">{erroresDeCampo[campo]}</p>}
          </div>)}
        </fieldset>
        {idEnEdicion === null && planes.length > 0 &&
          <p role="alert" className="notice text-danger">Ya hay un plan. Volvé al alumno para consultar el resultado antes de guardar otra vez.</p>}
        <div className="form-actions">
          <button type="button" className="secondary" disabled={guardando} onClick={volver}>Cancelar</button>
          <button
            type="submit"
            className="primary"
            disabled={guardando || cargando || Boolean(errorDeCarga) || idEnEdicion === null && planes.length > 0}
          >
            {guardando ? 'Guardando…' : 'Guardar plan'}
          </button>
        </div>
      </form>}
    {eliminando &&
      <div className="edit-form">
        <h2>¿Eliminar {plan?.nombre ?? 'este plan'}?</h2>
        <p className="notice muted">Dejará de estar disponible para entrenar. Su registro se conservará para el historial.</p>
        <div className="form-actions">
          <button type="button" className="secondary" disabled={guardando} onClick={volver}>Cancelar</button>
          <button
            type="button"
            className="danger-button"
            disabled={guardando || cargando || Boolean(errorDeCarga) || idAEliminar === null || plan?.id !== idAEliminar}
            onClick={eliminar}
          >
            {guardando ? 'Eliminando…' : 'Eliminar plan'}
          </button>
        </div>
      </div>}
    {!formulario && !eliminando && plan &&
      <PanelDeRutinas
        key={plan.id}
        alumnoId={alumno.id}
        nombreDelAlumno={nombreDelAlumno}
        planId={plan.id}
        nombreDelPlan={plan.nombre}
        deshabilitado={cargando || guardando || Boolean(errorDeCarga)}
        ruta={ruta}
        alNavegar={alNavegar}
        alCambiarGuardando={alCambiarOcupado}
      />}
  </section>;
}
