import { useCallback, useEffect, useRef, useState } from 'react';
import { cerrarSesion, type UsuarioDeSesion } from './sesion.ts';
import { PanelDeCuentas } from '../administracion/PanelDeCuentas.tsx';
import { PanelDeEntrenadorDelAlumno } from '../entrenadores/PanelDeEntrenadorDelAlumno.tsx';
import { PanelDeAlumnosDelEntrenador } from '../entrenadores/PanelDeAlumnosDelEntrenador.tsx';
import { PanelDePlanificacionDelAlumno } from '../planes/PanelDePlanificacionDelAlumno.tsx';
import { interpretarRutaDelAlumno, hrefDelAlumno, type RutaDelAlumno } from '../planes/navegacion-del-alumno.ts';
import { esFormularioDelEntrenador, hrefDelEntrenador, interpretarRutaDelEntrenador, type NavegarEntrenador } from '../entrenadores/navegacion-del-entrenador.ts';
import { Icono } from '../interfaz/Icono.tsx';
import { ConfiguracionDeApariencia } from '../interfaz/ConfiguracionDeApariencia.tsx';
import type { Tema } from '../interfaz/tema.ts';

export function PantallaDeSesion({ usuario, estadoDelBackend, tema, preferenciaGuardada, alCambiarTema, alCerrarSesion }: {
  usuario: UsuarioDeSesion;
  estadoDelBackend: 'comprobando' | 'conectado' | 'no_disponible';
  alCerrarSesion: () => void;
  tema: Tema;
  preferenciaGuardada: boolean;
  alCambiarTema: (tema: Tema) => void;
}) {
  const [ruta, setRuta] = useState(() => interpretarRutaDelEntrenador(location.hash));
  // La navegación del alumno (inicio, entrenadores, configuración y una rutina) es del módulo de planes.
  const [rutaDelAlumno, setRutaDelAlumno] = useState(() => interpretarRutaDelAlumno(location.hash));
  const referenciaDeRuta = useRef(ruta);
  referenciaDeRuta.current = ruta;
  const estadoDeRuta = useRef<unknown>(history.state);
  // Durante un guardado se bloquea la navegación para no perder el formulario.
  const referenciaDeOcupado = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const alCambiarOcupado = useCallback((valor: boolean) => {
    referenciaDeOcupado.current = valor;
    setOcupado(valor);
  }, []);
  const [cerrando, setCerrando] = useState(false),
    [mensaje, setMensaje] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cuenta = useRef<HTMLDivElement>(null);
  const [vista, setVista] = useState<'inicio' | 'entrenadores' | 'alumnos'>('inicio');
  const [puedeElegirEntrenador, setPuedeElegirEntrenador] = useState(false);
  const pedido = useRef<AbortController | null>(null);
  useEffect(() => () => pedido.current?.abort(), []);

  const navegar: NavegarEntrenador = useCallback((siguiente, ejercicio) => {
    if (referenciaDeOcupado.current) {
      return;
    }

    const hash = hrefDelEntrenador(siguiente);

    if (location.hash !== hash) {
      location.hash = hash;
    }

    estadoDeRuta.current = ejercicio ? { ejercicio } : null;
    history.replaceState(estadoDeRuta.current, '', hash);
    setRuta(siguiente);
  }, []);
  const navegarComoAlumno = useCallback((siguiente: RutaDelAlumno) => {
    const hash = hrefDelAlumno(siguiente);

    if (location.hash !== hash) {
      location.hash = hash;
    }

    history.replaceState(null, '', hash);
    setRutaDelAlumno(siguiente);
  }, []);
  const cambiarVistaDelAlumno = useCallback((mostrarLista: boolean) => navegarComoAlumno({ pantalla: mostrarLista ? 'entrenadores' : 'inicio' }), [navegarComoAlumno]);
  useEffect(() => {
    if (usuario.rol === 'entrenador' && !location.hash) {
      history.replaceState(null, '', '#alumnos');
    }

    const cambio = () => {
      if (usuario.rol === 'alumno') {
        setRutaDelAlumno(interpretarRutaDelAlumno(location.hash));

        return;
      }

      if (referenciaDeOcupado.current) {
        history.replaceState(estadoDeRuta.current, '', hrefDelEntrenador(referenciaDeRuta.current));

        return;
      }

      estadoDeRuta.current = history.state;
      setRuta(interpretarRutaDelEntrenador(location.hash));
    };
    window.addEventListener('hashchange', cambio);

    return () => window.removeEventListener('hashchange', cambio);
  }, [usuario.rol]);
  const esAlumno = usuario.rol === 'alumno';
  const idDeRutinaDelAlumno = rutaDelAlumno.pantalla === 'rutina' ? rutaDelAlumno.rutinaId : undefined;
  const pantallaActual = esAlumno ? rutaDelAlumno.pantalla : ruta.pantalla === 'catalogo' || ruta.pantalla === 'ejercicio' ? 'rutina' : ruta.pantalla;
  useEffect(() => {
    const cuadro = requestAnimationFrame(() => {
      if (!esAlumno && (referenciaDeRuta.current.pantalla === 'catalogo' || referenciaDeRuta.current.pantalla === 'ejercicio')) {
        return;
      }

      document.getElementById('page-title')?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });

    return () => cancelAnimationFrame(cuadro);
  }, [pantallaActual, ruta.alumnoId, ruta.rutinaId, idDeRutinaDelAlumno, esAlumno, vista]);
  useEffect(() => {
    if (!menuAbierto) {
      return;
    }

    const fuera = (evento: PointerEvent) => {
      if (!cuenta.current?.contains(evento.target as Node)) {
        setMenuAbierto(false);
      }
    };
    const escape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setMenuAbierto(false);
        cuenta.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', escape);

    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [menuAbierto]);

  async function cerrar() {
    if (pedido.current || referenciaDeOcupado.current) {
      return;
    }

    const controlador = new AbortController();
    pedido.current = controlador;
    setCerrando(true);
    setMensaje('');

    try {
      await cerrarSesion(controlador.signal);

      if (!controlador.signal.aborted) {
        history.replaceState(null, '', location.pathname);
        alCerrarSesion();
      }
    }
    catch (error: unknown) {
      if (!controlador.signal.aborted) {
        setMensaje(error instanceof Error ? error.message : 'No se pudo cerrar sesión.');
      }
    }
    finally {
      pedido.current = null;

      if (!controlador.signal.aborted) {
        setCerrando(false);
      }
    }
  }

  const esEntrenador = usuario.rol === 'entrenador';
  const enConfiguracion = esAlumno ? rutaDelAlumno.pantalla === 'configuracion' : ruta.pantalla === 'configuracion';
  const esAdministrador = usuario.rol === 'administrador';
  const enFormulario = !enConfiguracion && esEntrenador && esFormularioDelEntrenador(ruta);
  const enInicio = !enConfiguracion && (esAlumno ? rutaDelAlumno.pantalla === 'inicio' : esEntrenador ? ruta.pantalla === 'inicio' : vista === 'inicio');
  const etiquetaDelDestino = esEntrenador ? 'Alumnos' : 'Entrenadores';
  const irAlInicio = () => {
    if (esAlumno) {
      navegarComoAlumno({ pantalla: 'inicio' });
    } else {
      if (esEntrenador || enConfiguracion) {
        navegar({ pantalla: 'inicio' });
      }

      if (!esEntrenador) {
        setVista('inicio');
      }
    }
  };
  const irAlDestino = () => {
    if (esAlumno) {
      navegarComoAlumno({ pantalla: 'entrenadores' });
    } else if (esEntrenador) {
      navegar({ pantalla: 'alumnos' });
    }
  };
  const irAVistaDeAdministrador = (siguiente: 'entrenadores' | 'alumnos') => {
    if (enConfiguracion) {
      navegar({ pantalla: 'inicio' });
    }

    setVista(siguiente);
  };
  const irAConfiguracion = () => {
    setMenuAbierto(false);

    if (esAlumno) {
      navegarComoAlumno({ pantalla: 'configuracion' });
    } else {
      navegar({ pantalla: 'configuracion' });
    }
  };
  const navegacion = <>
    <button
      type="button"
      className="elemento-de-navegacion"
      disabled={ocupado}
      aria-current={enInicio ? 'page' : esAlumno && rutaDelAlumno.pantalla === 'rutina' ? 'true' : undefined}
      onClick={irAlInicio}
    ><Icono nombre="inicio" />Inicio</button>
    {esAdministrador && <>
      <button
        type="button"
        className="elemento-de-navegacion"
        aria-current={!enConfiguracion && vista === 'entrenadores' ? 'page' : undefined}
        onClick={() => irAVistaDeAdministrador('entrenadores')}
      ><Icono nombre="usuarios" />Entrenadores</button>
      <button
        type="button"
        className="elemento-de-navegacion"
        aria-current={!enConfiguracion && vista === 'alumnos' ? 'page' : undefined}
        onClick={() => irAVistaDeAdministrador('alumnos')}
      ><Icono nombre="usuarios" />Alumnos</button>
    </>}
    {!esAdministrador && (!esAlumno || puedeElegirEntrenador) &&
      <button
        type="button"
        className="elemento-de-navegacion"
        disabled={ocupado}
        aria-current={(esAlumno ? rutaDelAlumno.pantalla === 'entrenadores' : !enInicio && !enConfiguracion) ? 'page' : undefined}
        onClick={irAlDestino}
      >
        <Icono nombre="usuarios" />
        {etiquetaDelDestino}
      </button>}
  </>;

  return <div className="armazon-de-la-app">
    <header className="barra-superior">
      <button
        type="button"
        className="marca"
        onClick={esAlumno || esAdministrador ? irAlInicio : irAlDestino}
        disabled={ocupado}
        aria-label="GymHelper, inicio"
      >Gym<span>Helper</span></button>
      <div className="acciones-de-cabecera">
        <div className="contenedor-de-cuenta" ref={cuenta}>
          <button
            type="button"
            className="boton-de-cuenta"
            aria-expanded={menuAbierto}
            aria-controls="menu-de-cuenta"
            onClick={() => setMenuAbierto(valor => !valor)}
          >
            <span className="iniciales" aria-hidden="true">
              {usuario.nombre.slice(0, 1)}
              {usuario.apellido.slice(0, 1)}
            </span>
            <span className="nombre-de-cuenta">{usuario.nombre}</span>
            <Icono nombre="abajo" />
          </button>
          {menuAbierto &&
            <div id="menu-de-cuenta" className="menu-de-cuenta">
              <p className="small muted">{usuario.nombre} {usuario.apellido}</p>
              <button type="button" onClick={cerrar} disabled={cerrando || ocupado}>
                <Icono nombre="salir" />
                {cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
              {estadoDelBackend !== 'conectado' &&
                <p role="status" className={estadoDelBackend === 'no_disponible' ? 'text-danger small' : 'muted small'}>
                  {estadoDelBackend === 'comprobando' ? 'Comprobando servicio…' : 'Servicio no disponible'}
                </p>}
            </div>}
        </div>
        {enInicio &&
          <button
            type="button"
            className="icon-button boton-de-configuracion"
            aria-label="Configuración"
            disabled={ocupado || cerrando}
            onClick={irAConfiguracion}
          >
            <Icono nombre="configuracion" />
          </button>}
      </div>
    </header>
    <div className="cuerpo-de-la-app">
      <nav aria-label="Navegación principal" className="navegacion-lateral">{navegacion}</nav>
      <main className={'principal' + (enFormulario ? ' pantalla-de-formulario' : '')}>
        {estadoDelBackend === 'no_disponible' && <p role="status" className="notice text-danger">Servicio no disponible. Revisá la conexión.</p>}
        {mensaje && <p role="alert" className="notice text-danger">{mensaje}</p>}
        {enConfiguracion &&
          <ConfiguracionDeApariencia
            tema={tema}
            preferenciaGuardada={preferenciaGuardada}
            alCambiarTema={alCambiarTema}
            alVolver={irAlInicio}
          />}
        {esEntrenador && !enConfiguracion &&
          (enInicio
            ? <>
              <header className="page-head"><h1 id="page-title" tabIndex={-1}>Hola, {usuario.nombre}</h1></header>
              <div className="enlaces-de-inicio">
                <button className="fila-de-rutina" onClick={() => navegar({ pantalla: 'alumnos' })}>
                  <span className="row-copy">
                    <span className="row-title">Mis alumnos</span>
                    <span className="row-meta">Planes y rutinas</span>
                  </span>
                  <Icono nombre="flecha" />
                </button>
                <button className="fila-de-rutina" onClick={() => navegar({ pantalla: 'solicitudes' })}>
                  <span className="row-copy">
                    <span className="row-title">Solicitudes</span>
                    <span className="row-meta">Vinculación con alumnos</span>
                  </span>
                  <Icono nombre="flecha" />
                </button>
              </div>
            </>
            :
            <PanelDeAlumnosDelEntrenador ruta={ruta} alNavegar={navegar} alCambiarOcupado={alCambiarOcupado} />)}
        {esAdministrador && !enConfiguracion &&
          (vista === 'inicio'
            ? <>
              <header className="page-head"><h1 id="page-title" tabIndex={-1}>Hola, {usuario.nombre}</h1></header>
              <div className="enlaces-de-inicio">
                <button className="fila-de-rutina" onClick={() => irAVistaDeAdministrador('entrenadores')}>
                  <span className="row-copy">
                    <span className="row-title">Entrenadores</span>
                    <span className="row-meta">Alta, modificación y baja de cuentas</span>
                  </span>
                  <Icono nombre="flecha" />
                </button>
                <button className="fila-de-rutina" onClick={() => irAVistaDeAdministrador('alumnos')}>
                  <span className="row-copy">
                    <span className="row-title">Alumnos</span>
                    <span className="row-meta">Alta, modificación y baja de cuentas</span>
                  </span>
                  <Icono nombre="flecha" />
                </button>
              </div>
            </>
            : <PanelDeCuentas key={vista} tipo={vista} />)}
        {esAlumno && !enConfiguracion &&
          <>
            {rutaDelAlumno.pantalla !== 'rutina' &&
              <header className="page-head"><h1 id="page-title" tabIndex={-1}>{enInicio ? 'Hola, ' + usuario.nombre : 'Entrenadores'}</h1></header>}
            {rutaDelAlumno.pantalla !== 'entrenadores' &&
              <PanelDePlanificacionDelAlumno
                key={idDeRutinaDelAlumno ?? 'planificacion'}
                alumnoId={usuario.id}
                rutinaId={idDeRutinaDelAlumno}
                alAbrirRutina={id => navegarComoAlumno({ pantalla: 'rutina', rutinaId: id })}
                alVolver={irAlInicio}
              />}
            {rutaDelAlumno.pantalla !== 'rutina' &&
              <PanelDeEntrenadorDelAlumno
                mostrarLista={rutaDelAlumno.pantalla === 'entrenadores'}
                alCambiarMostrarLista={cambiarVistaDelAlumno}
                alCambiarPuedeElegir={setPuedeElegirEntrenador}
              />}
          </>}
      </main>
    </div>
    {!enFormulario && <nav aria-label="Navegación móvil" className="navegacion-inferior">{navegacion}</nav>}
  </div>;
}
