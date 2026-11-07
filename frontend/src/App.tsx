import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { comprobarSaludDelBackend } from './salud.ts';
import { FormularioDeInicioDeSesion } from './autenticacion/FormularioDeInicioDeSesion.tsx';
import { PantallaDeSesion } from './autenticacion/PantallaDeSesion.tsx';
import { PantallaDePedirRecuperacion } from './autenticacion/PantallaDePedirRecuperacion.tsx';
import { PantallaDeRestablecer } from './autenticacion/PantallaDeRestablecer.tsx';
import { interpretarRutaDeAcceso, type RutaDeAcceso } from './autenticacion/recuperacion.ts';
import { obtenerSesion, type UsuarioDeSesion } from './autenticacion/sesion.ts';
import { AvisoFlotante } from './interfaz/AvisoFlotante.tsx';
import { guardarPreferenciaDeTema, leerPreferenciaDeTema, type Tema } from './interfaz/tema.ts';

type EstadoDeConexion = 'comprobando' | 'conectado' | 'no_disponible';

const mensajes: Record<EstadoDeConexion, string> = {
  comprobando: 'Comprobando servicio…',
  conectado: 'Servicio disponible',
  no_disponible: 'Servicio no disponible',
};

/** Lee el hash de la URL. El token del enlace se pasa a memoria y se quita de la barra de direcciones. */
function leerRutaDeAcceso(previa: RutaDeAcceso | null): RutaDeAcceso {
  const ruta = interpretarRutaDeAcceso(location.hash);

  if (ruta.pantalla === 'restablecer') {
    if (ruta.token) {
      history.replaceState(null, '', '#/restablecer');
    } else if (previa?.pantalla === 'restablecer' && previa.token) {
      return previa;
    }
  }

  return ruta;
}

// Se llama App y vive en App.tsx por convención del arranque de React/Vite (main.tsx la importa).
export default function App() {
  const [tema, setTema] = useState<Tema>(leerPreferenciaDeTema);
  const [preferenciaGuardada, setPreferenciaGuardada] = useState(true);
  const [estado, setEstado] = useState<EstadoDeConexion>('comprobando');
  const [usuario, setUsuario] = useState<UsuarioDeSesion | null>(null);
  const [estadoDeSesion, setEstadoDeSesion] = useState<'cargando' | 'lista' | 'error'>('cargando');
  const [intentoDeSesion, setIntentoDeSesion] = useState(0);
  const [rutaDeAcceso, setRutaDeAcceso] = useState<RutaDeAcceso>(() => leerRutaDeAcceso(null));
  const [aviso, setAviso] = useState('');
  const cerrarAviso = useCallback(() => setAviso(''), []);

  useEffect(() => {
    const cambio = () => setRutaDeAcceso((previa) => leerRutaDeAcceso(previa));
    window.addEventListener('hashchange', cambio);

    return () => window.removeEventListener('hashchange', cambio);
  }, []);

  function terminarRestablecimiento() {
    setAviso('Cambiaste tu contraseña. Ya podés iniciar sesión.');
    history.replaceState(null, '', location.pathname);
    setRutaDeAcceso({ pantalla: 'inicio' });
  }

  useLayoutEffect(() => {
    document.documentElement.dataset.tema = tema;
  }, [tema]);

  function cambiarTema(siguiente: Tema) {
    setTema(siguiente);
    setPreferenciaGuardada(guardarPreferenciaDeTema(siguiente));
  }

  useEffect(() => {
    const controlador = new AbortController();
    // La comprobación en segundo plano conserva el formulario abierto.
    setEstadoDeSesion((actual) => actual === 'lista' ? actual : 'cargando');
    obtenerSesion(controlador.signal).then(
      (actual) => { if (!controlador.signal.aborted) { setUsuario(actual); setEstadoDeSesion('lista'); } },
      () => { if (!controlador.signal.aborted) setEstadoDeSesion('error'); },
    );
    return () => controlador.abort();
  }, [intentoDeSesion]);

  useEffect(() => {
    if (!usuario) return;
    const retomar = () => { if (document.visibilityState === 'visible') setIntentoDeSesion(intento => intento + 1); };
    document.addEventListener('visibilitychange', retomar);
    return () => document.removeEventListener('visibilitychange', retomar);
  }, [usuario?.id]);

  useEffect(() => {
    const controlador = new AbortController();
    setEstado('comprobando');
    comprobarSaludDelBackend(controlador.signal).then(
      () => { if (!controlador.signal.aborted) setEstado('conectado'); },
      () => { if (!controlador.signal.aborted) setEstado('no_disponible'); },
    );
    return () => controlador.abort();
  }, [usuario?.id, intentoDeSesion]);

  return <div className="escenario-de-la-app">
    {estadoDeSesion === 'lista' && usuario ? <PantallaDeSesion usuario={usuario} estadoDelBackend={estado} tema={tema} preferenciaGuardada={preferenciaGuardada} alCambiarTema={cambiarTema} alCerrarSesion={() => setUsuario(null)} /> :
      <div className="armazon-de-la-app"><header className="barra-superior"><span className="marca">Gym<span>Helper</span></span></header><main className="escenario-de-acceso"><div className="acceso">
        {estadoDeSesion === 'cargando' && <p role="status" className="muted">Comprobando sesión…</p>}
        {estadoDeSesion === 'error' && <div><p role="alert" className="text-danger">No se pudo consultar tu sesión. Revisá la conexión.</p><button type="button" className="primary" onClick={() => setIntentoDeSesion(valor => valor + 1)}>Reintentar</button></div>}
        {estadoDeSesion === 'lista' && rutaDeAcceso.pantalla === 'inicio' && <FormularioDeInicioDeSesion alIniciarSesion={(actual) => { history.replaceState(null, '', location.pathname); setUsuario(actual); }} />}
        {estadoDeSesion === 'lista' && rutaDeAcceso.pantalla === 'recuperar' && <PantallaDePedirRecuperacion />}
        {estadoDeSesion === 'lista' && rutaDeAcceso.pantalla === 'restablecer' &&
          <PantallaDeRestablecer token={rutaDeAcceso.token} alRestablecer={terminarRestablecimiento} />}
        {estado !== 'conectado' && <p className={'notice small ' + (estado === 'no_disponible' ? 'text-danger' : 'muted')} role="status">{mensajes[estado]}</p>}
      </div></main><AvisoFlotante mensaje={aviso} alCerrar={cerrarAviso} /></div>}
  </div>;
}
