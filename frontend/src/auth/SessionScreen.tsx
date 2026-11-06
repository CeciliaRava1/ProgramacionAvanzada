import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut, type SessionUser } from './session.ts';
import { RegistrationForm } from '../registration/RegistrationForm.tsx';
import { StudentTrainerPanel } from '../trainers/StudentTrainerPanel.tsx';
import { TrainerStudentsPanel } from '../trainers/TrainerStudentsPanel.tsx';
import { StudentPlanningPanel } from '../plans/StudentPlanningPanel.tsx';
import { parseStudentRoute, studentHref, type StudentRoute } from '../plans/student-navigation.ts';
import { isTrainerForm, parseTrainerRoute, trainerHref, type NavigateTrainer } from '../trainers/trainer-navigation.ts';
import { Icon } from '../ui/Icon.tsx';
import { AppearanceSettings } from '../ui/AppearanceSettings.tsx';
import type { Theme } from '../ui/theme.ts';

export function SessionScreen({ user, backendStatus, theme, preferenceSaved, onThemeChange, onSignedOut }: {
  user: SessionUser;
  backendStatus: 'checking' | 'connected' | 'unavailable';
  onSignedOut: () => void;
  theme: Theme;
  preferenceSaved: boolean;
  onThemeChange: (theme: Theme) => void;
}) {
  const [route, setRoute] = useState(() => parseTrainerRoute(location.hash));
  const [studentRoute, setStudentRoute] = useState(() => parseStudentRoute(location.hash));
  const routeRef = useRef(route);
  routeRef.current = route;
  const routeStateRef = useRef<unknown>(history.state);
  // Durante un guardado se bloquea la navegación para no perder el formulario.
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const onBusyChange = useCallback((value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  }, []);
  const [closing, setClosing] = useState(false),
    [message, setMessage] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const account = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'home' | 'create-trainer'>('home');
  const [canChooseTrainer, setCanChooseTrainer] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const navigate: NavigateTrainer = useCallback((next, exercise) => {
    if (busyRef.current) {
      return;
    }

    const hash = trainerHref(next);

    if (location.hash !== hash) {
      location.hash = hash;
    }

    routeStateRef.current = exercise ? { exercise } : null;
    history.replaceState(routeStateRef.current, '', hash);
    setRoute(next);
  }, []);
  const navigateStudent = useCallback((next: StudentRoute) => {
    const hash = studentHref(next);

    if (location.hash !== hash) {
      location.hash = hash;
    }

    history.replaceState(null, '', hash);
    setStudentRoute(next);
  }, []);
  const changeStudentView = useCallback((showList: boolean) => navigateStudent({ screen: showList ? 'trainers' : 'home' }), [navigateStudent]);
  useEffect(() => {
    if (user.role === 'trainer' && !location.hash) {
      history.replaceState(null, '', '#students');
    }

    const changed = () => {
      if (user.role === 'student') {
        setStudentRoute(parseStudentRoute(location.hash));

        return;
      }

      if (busyRef.current) {
        history.replaceState(routeStateRef.current, '', trainerHref(routeRef.current));

        return;
      }

      routeStateRef.current = history.state;
      setRoute(parseTrainerRoute(location.hash));
    };
    window.addEventListener('hashchange', changed);

    return () => window.removeEventListener('hashchange', changed);
  }, [user.role]);
  const student = user.role === 'student';
  const studentRoutineId = studentRoute.screen === 'routine' ? studentRoute.routineId : undefined;
  const pageScreen = student ? studentRoute.screen : route.screen === 'catalog' || route.screen === 'exercise' ? 'routine' : route.screen;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!student && (routeRef.current.screen === 'catalog' || routeRef.current.screen === 'exercise')) {
        return;
      }

      document.getElementById('page-title')?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });

    return () => cancelAnimationFrame(frame);
  }, [pageScreen, route.studentId, route.routineId, studentRoutineId, student, view]);
  useEffect(() => {
    if (!accountOpen) {
      return;
    }

    const outside = (event: PointerEvent) => {
      if (!account.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        account.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);

    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [accountOpen]);

  async function close() {
    if (request.current || busyRef.current) {
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setClosing(true);
    setMessage('');

    try {
      await signOut(controller.signal);

      if (!controller.signal.aborted) {
        history.replaceState(null, '', location.pathname);
        onSignedOut();
      }
    }
    catch (error: unknown) {
      if (!controller.signal.aborted) {
        setMessage(error instanceof Error ? error.message : 'No se pudo cerrar sesión.');
      }
    }
    finally {
      request.current = null;

      if (!controller.signal.aborted) {
        setClosing(false);
      }
    }
  }

  const trainer = user.role === 'trainer';
  const settings = student ? studentRoute.screen === 'settings' : route.screen === 'settings';
  const form = !settings && (trainer ? isTrainerForm(route) : view === 'create-trainer');
  const home = !settings && (student ? studentRoute.screen === 'home' : trainer ? route.screen === 'home' : view === 'home');
  const destinationLabel = user.role === 'admin' ? 'Crear entrenador' : trainer ? 'Alumnos' : 'Entrenadores';
  const goHome = () => {
    if (student) {
      navigateStudent({ screen: 'home' });
    } else {
      if (trainer || settings) {
        navigate({ screen: 'home' });
      }

      if (!trainer) {
        setView('home');
      }
    }
  };
  const goDestination = () => {
    if (student) {
      navigateStudent({ screen: 'trainers' });
    } else if (trainer) {
      navigate({ screen: 'students' });
    } else {
      if (settings) {
        navigate({ screen: 'home' });
      }

      setView('create-trainer');
    }
  };
  const goSettings = () => {
    setAccountOpen(false);

    if (student) {
      navigateStudent({ screen: 'settings' });
    } else {
      navigate({ screen: 'settings' });
    }
  };
  const navigation = <>
    <button
      type="button"
      className="nav-item"
      disabled={busy}
      aria-current={home ? 'page' : student && studentRoute.screen === 'routine' ? 'true' : undefined}
      onClick={goHome}
    ><Icon name="home" />Inicio</button>
    {(!student || canChooseTrainer) &&
      <button
        type="button"
        className="nav-item"
        disabled={busy}
        aria-current={(student ? studentRoute.screen === 'trainers' : !home && !settings) ? 'page' : undefined}
        onClick={goDestination}
      >
        <Icon name="users" />
        {destinationLabel}
      </button>}
  </>;

  return <div className="app-shell">
    <header className="app-top">
      <button
        type="button"
        className="wordmark"
        onClick={student ? goHome : goDestination}
        disabled={busy}
        aria-label="GymHelper, inicio"
      >Gym<span>Helper</span></button>
      <div className="header-actions">
        <div className="account-wrap" ref={account}>
          <button
            type="button"
            className="account"
            aria-expanded={accountOpen}
            aria-controls="account-menu"
            onClick={() => setAccountOpen(value => !value)}
          >
            <span className="avatar" aria-hidden="true">
              {user.firstName.slice(0, 1)}
              {user.lastName.slice(0, 1)}
            </span>
            <span className="account-name">{user.firstName}</span>
            <Icon name="down" />
          </button>
          {accountOpen &&
            <div id="account-menu" className="account-menu">
              <p className="small muted">{user.firstName} {user.lastName}</p>
              <button type="button" onClick={close} disabled={closing || busy}>
                <Icon name="exit" />
                {closing ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
              {backendStatus !== 'connected' &&
                <p role="status" className={backendStatus === 'unavailable' ? 'text-danger small' : 'muted small'}>
                  {backendStatus === 'checking' ? 'Comprobando servicio…' : 'Servicio no disponible'}
                </p>}
            </div>}
        </div>
        {home &&
          <button
            type="button"
            className="icon-button settings-trigger"
            aria-label="Configuración"
            disabled={busy || closing}
            onClick={goSettings}
          >
            <Icon name="settings" />
          </button>}
      </div>
    </header>
    <div className="app-body">
      <nav aria-label="Navegación principal" className="side-nav">{navigation}</nav>
      <main className={'main' + (form ? ' form-screen' : '')}>
        {backendStatus === 'unavailable' && <p role="status" className="notice text-danger">Servicio no disponible. Revisá la conexión.</p>}
        {message && <p role="alert" className="notice text-danger">{message}</p>}
        {settings &&
          <AppearanceSettings
            theme={theme}
            preferenceSaved={preferenceSaved}
            onThemeChange={onThemeChange}
            onBack={goHome}
          />}
        {trainer && !settings &&
          (home
            ? <>
              <header className="page-head"><h1 id="page-title" tabIndex={-1}>Hola, {user.firstName}</h1></header>
              <div className="home-links">
                <button className="routine-row" onClick={() => navigate({ screen: 'students' })}>
                  <span className="row-copy">
                    <span className="row-title">Mis alumnos</span>
                    <span className="row-meta">Planes y rutinas</span>
                  </span>
                  <Icon name="chevron" />
                </button>
                <button className="routine-row" onClick={() => navigate({ screen: 'requests' })}>
                  <span className="row-copy">
                    <span className="row-title">Solicitudes</span>
                    <span className="row-meta">Vinculación con alumnos</span>
                  </span>
                  <Icon name="chevron" />
                </button>
              </div>
            </>
            :
            <TrainerStudentsPanel route={route} onNavigate={navigate} onBusyChange={onBusyChange} />)}
        {!trainer && !settings && user.role === 'admin' &&
          (view === 'create-trainer'
            ? <RegistrationForm accountType="trainer" />
            : <>
              <header className="page-head"><h1 id="page-title" tabIndex={-1}>Hola, {user.firstName}</h1></header>
              <button className="primary" onClick={goDestination}>Crear entrenador</button>
            </>)}
        {student && !settings &&
          <>
            {studentRoute.screen !== 'routine' &&
              <header className="page-head"><h1 id="page-title" tabIndex={-1}>{home ? 'Hola, ' + user.firstName : 'Entrenadores'}</h1></header>}
            {studentRoute.screen !== 'trainers' &&
              <StudentPlanningPanel
                key={studentRoutineId ?? 'planning'}
                studentId={user.id}
                routineId={studentRoutineId}
                onOpenRoutine={id => navigateStudent({ screen: 'routine', routineId: id })}
                onBack={goHome}
              />}
            {studentRoute.screen !== 'routine' &&
              <StudentTrainerPanel
                showList={studentRoute.screen === 'trainers'}
                onShowListChange={changeStudentView}
                onCanChooseChange={setCanChooseTrainer}
              />}
          </>}
      </main>
    </div>
    {!form && <nav aria-label="Navegación móvil" className="bottom-nav">{navigation}</nav>}
  </div>;
}
