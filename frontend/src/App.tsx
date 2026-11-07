import { useEffect, useLayoutEffect, useState } from 'react';
import { comprobarSaludDelBackend } from './salud.ts';
import { FormularioDeInicioDeSesion } from './autenticacion/FormularioDeInicioDeSesion.tsx';
import { PantallaDeSesion } from './autenticacion/PantallaDeSesion.tsx';
import { obtenerSesion, type UsuarioDeSesion } from './autenticacion/sesion.ts';
import { guardarPreferenciaDeTema, leerPreferenciaDeTema, type Tema } from './interfaz/tema.ts';

type EstadoDeConexion = 'comprobando' | 'conectado' | 'no_disponible';

const mensajes: Record<EstadoDeConexion, string> = {
  comprobando: 'Comprobando servicio…',
  conectado: 'Servicio disponible',
  no_disponible: 'Servicio no disponible',
};

// Se llama App y vive en App.tsx por convención del arranque de React/Vite (main.tsx la importa).
export default function App() {
  const [tema, setTema] = useState<Tema>(leerPreferenciaDeTema);
  const [preferenciaGuardada, setPreferenciaGuardada] = useState(true);
  const [estado, setEstado] = useState<EstadoDeConexion>('comprobando');
  const [usuario, setUsuario] = useState<UsuarioDeSesion | null>(null);
  const [estadoDeSesion, setEstadoDeSesion] = useState<'cargando' | 'lista' | 'error'>('cargando');
  const [intentoDeSesion, setIntentoDeSesion] = useState(0);

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
        {estadoDeSesion === 'lista' && <FormularioDeInicioDeSesion alIniciarSesion={setUsuario} />}
        {estado !== 'conectado' && <p className={'notice small ' + (estado === 'no_disponible' ? 'text-danger' : 'muted')} role="status">{mensajes[estado]}</p>}
      </div></main></div>}
  </div>;
}
