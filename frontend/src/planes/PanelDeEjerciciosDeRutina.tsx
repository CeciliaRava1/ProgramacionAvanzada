import { useEffect, useRef, useState } from 'react';
import { SelectorDeEjercicios } from './SelectorDeEjercicios.tsx';
import { EditorDeEjercicioDeRutina } from './EditorDeEjercicioDeRutina.tsx';
import {
  consultarEjerciciosDeRutina, guardarEjercicioDeRutina, resumenDeEjercicioDeRutina, formatearTiempoDeDescanso, esEjercicio,
  ErrorDeEjercicioDeRutina, type ContextoDeRutina, type EjercicioDeRutina, type DatosDeEjercicioDeRutina,
} from './ejercicios-de-rutina.ts';
import { hrefDelEntrenador, type RutaDelEntrenador, type NavegarEntrenador } from '../entrenadores/navegacion-del-entrenador.ts';
import { Icono } from '../interfaz/Icono.tsx';
import { Dialogo } from '../interfaz/Dialogo.tsx';

export function PanelDeEjerciciosDeRutina({ contexto, nombreDelAlumno, nombreDeLaRutina, deshabilitado, ruta, alNavegar, alCambiarOcupado }: {
  contexto: ContextoDeRutina;
  nombreDelAlumno: string;
  nombreDeLaRutina: string;
  deshabilitado: boolean;
  ruta: RutaDelEntrenador;
  alNavegar: NavegarEntrenador;
  alCambiarOcupado: (ocupado: boolean) => void;
}) {
  const [elementos, setElementos] = useState<EjercicioDeRutina[] | null>(null);
  const [cargando, setCargando] = useState(true),
    [errorDeCarga, setErrorDeCarga] = useState(''),
    [intento, setIntento] = useState(0);
  const [guardando, setGuardando] = useState(false),
    [errorDeGuardado, setErrorDeGuardado] = useState(''),
    [incierto, setIncierto] = useState(false),
    [mensaje, setMensaje] = useState('');
  const operacion = useRef<AbortController | null>(null);
  const anterior = useRef(ruta.pantalla);
  const { alumnoId, planId, rutinaId } = contexto;
  useEffect(() => () => {
    operacion.current?.abort();
    alCambiarOcupado(false);
  }, [alCambiarOcupado]);
  const claveDeRuta = hrefDelEntrenador(ruta);
  useEffect(() => {
    setErrorDeGuardado('');
    setIncierto(false);
  }, [claveDeRuta]);
  useEffect(() => {
    if (ruta.pantalla === 'rutina' && anterior.current !== 'rutina' && incierto) {
      setIntento(valor => valor + 1);
    }

    anterior.current = ruta.pantalla;
  }, [ruta.pantalla, incierto]);
  useEffect(() => {
    const controlador = new AbortController();
    setCargando(true);
    setErrorDeCarga('');
    consultarEjerciciosDeRutina({ alumnoId, planId, rutinaId }, controlador.signal).then(
      valor => {
        if (!controlador.signal.aborted) {
          setElementos(valor);
        }
      },
      falla => {
        if (!controlador.signal.aborted) {
          setErrorDeCarga(falla instanceof Error ? falla.message : 'No se pudieron consultar los ejercicios.');
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
  }, [alumnoId, planId, rutinaId, intento]);
  const elemento = elementos?.find(valor => valor.id === ruta.ejercicioDeRutinaId);
  const guardado: unknown = history.state?.ejercicio;
  const ejercicio = elemento?.ejercicio ?? (ruta.ejercicioId && esEjercicio(guardado) && guardado.id === ruta.ejercicioId ? guardado : undefined);
  const volver = () => alNavegar({ pantalla: 'rutina', alumnoId, rutinaId });
  const abrirCatalogo = () => {
    setMensaje('');
    alNavegar({ pantalla: 'catalogo', alumnoId, rutinaId });
  };

  async function guardar(datos: DatosDeEjercicioDeRutina) {
    if (!ejercicio || deshabilitado || cargando || errorDeCarga || incierto || operacion.current || elementos === null) {
      return;
    }

    const controlador = new AbortController();
    operacion.current = controlador;
    setGuardando(true);
    alCambiarOcupado(true);
    setErrorDeGuardado('');

    try {
      const guardadoEnServidor = await guardarEjercicioDeRutina(contexto, ejercicio.id, datos, controlador.signal, elemento?.id);

      if (!controlador.signal.aborted) {
        setElementos(valor => elemento ? (valor || []).map(item => item.id === guardadoEnServidor.id ? guardadoEnServidor : item) : [...(valor || []), guardadoEnServidor]);
        setMensaje(elemento ? 'Indicaciones guardadas.' : 'Ejercicio agregado.');
        alCambiarOcupado(false);
        volver();
      }
    } catch (falla: unknown) {
      if (!controlador.signal.aborted) {
        setErrorDeGuardado(falla instanceof Error ? falla.message : 'No se pudo guardar el ejercicio.');
        setIncierto(falla instanceof ErrorDeEjercicioDeRutina && falla.incierto);
      }
    } finally {
      operacion.current = null;

      if (!controlador.signal.aborted) {
        setGuardando(false);
        alCambiarOcupado(false);
      }
    }
  }

  const resumen = ruta.pantalla === 'rutina',
    configurando = ruta.pantalla === 'ejercicio';
  const noDisponible = deshabilitado || cargando || guardando || Boolean(errorDeCarga) || elementos === null || incierto;
  const lista = <ul aria-label="Ejercicios guardados en la rutina" className="list">
    {elementos?.map(item => <li key={item.id}>
      <button
        type="button"
        className="fila-de-ejercicio"
        disabled={noDisponible}
        aria-current={ruta.ejercicioDeRutinaId === item.id ? 'true' : undefined}
        onClick={() => {
          setMensaje('');
          alNavegar({ pantalla: 'ejercicio', alumnoId, rutinaId, ejercicioDeRutinaId: item.id });
        }}
      >
        <span className="row-copy">
          <span className="row-title">{item.ejercicio.nombre}</span>
          <span className="row-meta">{resumenDeEjercicioDeRutina(item)}</span>
          {(item.descansoEnSegundos !== null || item.rirRecomendado !== null) &&
            <span className="row-meta">
              {[item.descansoEnSegundos === null ? '' : 'Descanso ' + formatearTiempoDeDescanso(item.descansoEnSegundos), item.rirRecomendado === null ? '' : 'RIR ' + item.rirRecomendado].filter(Boolean).join(' · ')}
            </span>}
        </span>
        <Icono nombre="flecha" />
      </button>
    </li>)}
  </ul>;

  return <section aria-busy={cargando || guardando}>
    {cargando && elementos === null && <p role="status" className="notice muted">Consultando ejercicios…</p>}
    {errorDeCarga &&
      <div className="notice">
        <p role="alert" className="text-danger">{errorDeCarga}</p>
        <button
          type="button"
          className="secondary"
          disabled={deshabilitado || guardando}
          onClick={() => setIntento(valor => valor + 1)}
        >Reintentar</button>
      </div>}
    <div className="section-head">
      <h2>Ejercicios{elementos && <span className="muted small"> · {elementos.length}</span>}</h2>
      <button type="button" className="primary" disabled={noDisponible} onClick={abrirCatalogo}><Icono nombre="mas" />Agregar ejercicio</button>
    </div>
    {mensaje && <p role="status" className="notice text-brand">{mensaje}</p>}
    {!cargando && !errorDeCarga && elementos?.length === 0 && <div className="empty"><p>Todavía no hay ejercicios en esta rutina.</p></div>}
    {lista}
    <Dialogo
      abierto={!resumen}
      titulo={configurando ? ruta.ejercicioDeRutinaId ? 'Editar indicaciones' : 'Indicaciones' : 'Agregar ejercicio'}
      ocupado={guardando}
      alCerrar={volver}
    >
      <p className="contexto-del-dialogo">{nombreDeLaRutina} · {nombreDelAlumno}</p>
      {errorDeCarga &&
        <div className="notice">
          <p role="alert" className="text-danger">{errorDeCarga}</p>
          <button
            type="button"
            className="secondary"
            disabled={deshabilitado || guardando}
            onClick={() => setIntento(valor => valor + 1)}
          >Reintentar</button>
        </div>}
      <div hidden={ruta.pantalla !== 'catalogo'}>
        <SelectorDeEjercicios
          activo={ruta.pantalla === 'catalogo'}
          deshabilitado={noDisponible}
          alElegir={elegido => alNavegar({ pantalla: 'ejercicio', alumnoId, rutinaId, ejercicioId: elegido.id }, elegido)}
        />
      </div>
      {configurando && ejercicio &&
        <>
          {!elemento && !incierto && <button type="button" className="back" disabled={guardando} onClick={abrirCatalogo}><Icono nombre="atras" />Catálogo</button>}
          <h3 className="nombre-del-ejercicio-del-dialogo">{ejercicio.nombre}</h3>
          <EditorDeEjercicioDeRutina
            key={claveDeRuta}
            ejercicio={ejercicio}
            elemento={elemento}
            guardando={guardando}
            bloqueado={noDisponible}
            error={errorDeGuardado}
            alVolver={volver}
            alGuardar={guardar}
          />
        </>}
      {configurando && !ejercicio && !cargando && !errorDeCarga &&
        <div className="empty">
          <p role="alert">
            {ruta.ejercicioDeRutinaId ? 'Este ejercicio ya no está disponible en la rutina.' : 'Volvé a seleccionar el ejercicio en el catálogo.'}
          </p>
          <button type="button" className="secondary" onClick={abrirCatalogo}>Abrir catálogo</button>
        </div>}
      {incierto &&
        <p role="alert" className="notice text-danger">Cerrá esta ventana y comprobá el resultado en la rutina antes de guardar otra vez.</p>}
    </Dialogo>
  </section>;
}
