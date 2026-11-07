import { Icono } from './Icono.tsx';
import type { Tema } from './tema.ts';

export function ConfiguracionDeApariencia({ tema, preferenciaGuardada, alCambiarTema, alVolver }: {
  tema: Tema; preferenciaGuardada: boolean; alCambiarTema: (tema: Tema) => void; alVolver: () => void;
}) {
  return <section aria-labelledby="page-title" className="configuracion-de-apariencia">
    <button type="button" className="back" onClick={alVolver}><Icono nombre="atras" />Inicio</button>
    <header className="page-head"><h1 id="page-title" tabIndex={-1}>Configuración</h1></header>
    <h2>Apariencia</h2>
    <label className="opcion-de-apariencia" htmlFor="apariencia-modo-oscuro">
      <span className="texto-de-apariencia"><span className="etiqueta-de-apariencia">Modo oscuro</span><span className="paleta-de-apariencia">{tema === 'oscuro' ? 'Petróleo y lima' : 'Gris claro y verde marino'}</span></span>
      <input id="apariencia-modo-oscuro" name="modoOscuro" className="interruptor-de-apariencia" type="checkbox" role="switch" checked={tema === 'oscuro'} aria-describedby="apariencia-ayuda" onChange={evento => alCambiarTema(evento.target.checked ? 'oscuro' : 'claro')} />
    </label>
    <p id="apariencia-ayuda" className="small muted">El cambio se aplica al instante y se recuerda en este navegador.</p>
    {!preferenciaGuardada && <p role="status" className="notice text-danger">El tema está aplicado, pero el navegador no permitió recordarlo para próximas visitas.</p>}
  </section>;
}
