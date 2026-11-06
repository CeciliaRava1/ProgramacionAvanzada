import { useCallback, useEffect, useState } from 'react';
import { getAssignedStudents, type AssignedStudent } from './assigned-students.ts';
import { TrainerRequestsPanel } from './TrainerRequestsPanel.tsx';
import { StudentPlansPanel } from '../plans/StudentPlansPanel.tsx';
import type { TrainerRoute, NavigateTrainer } from './trainer-navigation.ts';
import { Icon } from '../ui/Icon.tsx';

export function TrainerStudentsPanel({ route, onNavigate, onBusyChange }: {
  route: TrainerRoute;
  onNavigate: NavigateTrainer;
  onBusyChange: (busy: boolean) => void;
}) {
  const [students, setStudents] = useState<AssignedStudent[] | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [requestCount, setRequestCount] = useState<number | null>(null);
  const accepted = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getAssignedStudents(controller.signal).then(
      value => {
        if (!controller.signal.aborted) {
          setStudents(value);
        }
      },
      reason => {
        if (!controller.signal.aborted) {
          setStudents(null);
          setError(reason instanceof Error ? reason.message : 'No se pudo consultar el listado de alumnos.');
        }
      },
    ).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    });
    const resume = () => {
      if (document.visibilityState === 'visible') {
        setAttempt(value => value + 1);
      }
    };
    document.addEventListener('visibilitychange', resume);

    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', resume);
    };
  }, [attempt]);

  const selected = students?.find(student => student.id === route.studentId);

  if (route.studentId !== undefined) {
    if (selected) {
      return <StudentPlansPanel
        key={selected.id}
        student={selected}
        route={route}
        onNavigate={onNavigate}
        onBusyChange={onBusyChange}
      />;
    }

    return <>
      <button type="button" className="back" onClick={() => onNavigate({ screen: 'students' })}><Icon name="back" />Alumnos</button>
      <h1 id="page-title" tabIndex={-1}>Alumno</h1>
      {loading
        ? <p role="status" className="notice muted">Consultando alumno…</p>
        : <p role="alert" className="notice text-danger">{error || 'Este alumno no está disponible entre tus alumnos vinculados.'}</p>}
      {error && <button className="secondary" onClick={accepted}>Reintentar</button>}
    </>;
  }

  return <section>
    <header className="page-head"><h1 id="page-title" tabIndex={-1}>Mis alumnos</h1></header>
    <nav aria-label="Alumnos y solicitudes" className="tabs">
      <button
        type="button"
        aria-current={route.screen === 'students' ? 'page' : undefined}
        onClick={() => onNavigate({ screen: 'students' })}
      >Alumnos{students && <span className="badge">{students.length}</span>}</button>
      <button
        type="button"
        aria-current={route.screen === 'requests' ? 'page' : undefined}
        onClick={() => onNavigate({ screen: 'requests' })}
      >Solicitudes{requestCount !== null && <span className="badge">{requestCount}</span>}</button>
    </nav>
    <div hidden={route.screen !== 'requests'}>
      <TrainerRequestsPanel onAccepted={accepted} onCountChange={setRequestCount} onBusyChange={onBusyChange} />
    </div>
    <section hidden={route.screen !== 'students'} aria-label="Alumnos vinculados" aria-busy={loading}>
      {loading && <p className="notice muted" role="status">Consultando alumnos…</p>}
      {error &&
        <div className="notice">
          <p className="text-danger" role="alert">{error}</p>
          <button className="secondary" disabled={loading} onClick={accepted}>Reintentar</button>
        </div>}
      {!loading && students?.length === 0 &&
        <div className="empty">
          <h2>Todavía no tenés alumnos vinculados</h2>
          <p>Las solicitudes de alumnos se reciben en Solicitudes.</p>
        </div>}
      {students &&
        <ul className="list" aria-label="Alumnos vinculados">
          {students.map(student => <li key={student.id}>
            <button
              type="button"
              className="person-row"
              onClick={() => onNavigate({ screen: 'student', studentId: student.id })}
            >
              <span className="avatar" aria-hidden="true">
                {student.firstName.slice(0, 1)}
                {student.lastName.slice(0, 1)}
              </span>
              <span className="row-copy"><span className="row-title">{student.firstName} {student.lastName}</span></span>
              <Icon name="chevron" />
            </button>
          </li>)}
        </ul>}
    </section>
  </section>;
}
