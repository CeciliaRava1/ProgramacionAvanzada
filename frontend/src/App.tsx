import { useEffect, useLayoutEffect, useState } from 'react';
import { checkBackendHealth } from './health.ts';
import { RegistrationForm } from './registration/RegistrationForm.tsx';
import { LoginForm } from './auth/LoginForm.tsx';
import { SessionScreen } from './auth/SessionScreen.tsx';
import { getSession, type SessionUser } from './auth/session.ts';
import { readThemePreference, saveThemePreference, type Theme } from './ui/theme.ts';

type ConnectionStatus = 'checking' | 'connected' | 'unavailable';

const messages: Record<ConnectionStatus, string> = {
  checking: 'Comprobando servicio…',
  connected: 'Servicio disponible',
  unavailable: 'Servicio no disponible',
};

export default function App() {
  const [theme, setTheme] = useState<Theme>(readThemePreference);
  const [preferenceSaved, setPreferenceSaved] = useState(true);
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [view, setView] = useState<'login' | 'register'>('login');
  const [sessionState, setSessionState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sessionAttempt, setSessionAttempt] = useState(0);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function changeTheme(next: Theme) {
    setTheme(next);
    setPreferenceSaved(saveThemePreference(next));
  }

  useEffect(() => {
    const controller = new AbortController();
    // La comprobación en segundo plano conserva el formulario abierto.
    setSessionState((current) => current === 'ready' ? current : 'loading');
    getSession(controller.signal).then(
      (current) => { if (!controller.signal.aborted) { setUser(current); setSessionState('ready'); } },
      () => { if (!controller.signal.aborted) setSessionState('error'); },
    );
    return () => controller.abort();
  }, [sessionAttempt]);

  useEffect(() => {
    if (!user) return;
    const resume = () => { if (document.visibilityState === 'visible') setSessionAttempt(attempt => attempt + 1); };
    document.addEventListener('visibilitychange', resume);
    return () => document.removeEventListener('visibilitychange', resume);
  }, [user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('checking');
    checkBackendHealth(controller.signal).then(
      () => { if (!controller.signal.aborted) setStatus('connected'); },
      () => { if (!controller.signal.aborted) setStatus('unavailable'); },
    );
    return () => controller.abort();
  }, [user?.id, sessionAttempt]);

  return <div className="app-stage">
    {sessionState === 'ready' && user ? <SessionScreen user={user} backendStatus={status} theme={theme} preferenceSaved={preferenceSaved} onThemeChange={changeTheme} onSignedOut={() => { setUser(null); setView('login'); }} /> :
      <div className="app-shell"><header className="app-top"><span className="wordmark">Gym<span>Helper</span></span></header><main className="auth-stage"><div className="auth">
        {sessionState === 'loading' && <p role="status" className="muted">Comprobando sesión…</p>}
        {sessionState === 'error' && <div><p role="alert" className="text-danger">No se pudo consultar tu sesión. Revisá la conexión.</p><button type="button" className="primary" onClick={() => setSessionAttempt(value => value + 1)}>Reintentar</button></div>}
        {sessionState === 'ready' && <>
          {view === 'login' ? <LoginForm onSignedIn={setUser} /> : <RegistrationForm />}
          <button type="button" className="text-button auth-switch" onClick={() => setView(view === 'login' ? 'register' : 'login')}>{view === 'login' ? 'Crear una cuenta de alumno' : 'Ya tengo cuenta · Iniciar sesión'}</button>
        </>}
        {status !== 'connected' && <p className={'notice small ' + (status === 'unavailable' ? 'text-danger' : 'muted')} role="status">{messages[status]}</p>}
      </div></main></div>}
  </div>;
}
