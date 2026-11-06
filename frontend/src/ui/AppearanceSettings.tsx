import { Icon } from './Icon.tsx';
import type { Theme } from './theme.ts';

export function AppearanceSettings({ theme, preferenceSaved, onThemeChange, onBack }: {
  theme: Theme; preferenceSaved: boolean; onThemeChange: (theme: Theme) => void; onBack: () => void;
}) {
  return <section aria-labelledby="page-title" className="appearance-settings">
    <button type="button" className="back" onClick={onBack}><Icon name="back" />Inicio</button>
    <header className="page-head"><h1 id="page-title" tabIndex={-1}>Configuración</h1></header>
    <h2>Apariencia</h2>
    <label className="appearance-option" htmlFor="appearance-dark-mode">
      <span className="appearance-copy"><span className="appearance-label">Modo oscuro</span><span className="appearance-palette">{theme === 'dark' ? 'Petróleo y lima' : 'Gris claro y verde marino'}</span></span>
      <input id="appearance-dark-mode" name="darkMode" className="appearance-switch" type="checkbox" role="switch" checked={theme === 'dark'} aria-describedby="appearance-hint" onChange={event => onThemeChange(event.target.checked ? 'dark' : 'light')} />
    </label>
    <p id="appearance-hint" className="small muted">El cambio se aplica al instante y se recuerda en este navegador.</p>
    {!preferenceSaved && <p role="status" className="notice text-danger">El tema está aplicado, pero el navegador no permitió recordarlo para próximas visitas.</p>}
  </section>;
}
