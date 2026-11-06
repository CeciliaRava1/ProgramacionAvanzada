import { useEffect, useState } from 'react';
import { getStudentPlanning, getStudentRoutine, StudentPlanningError, type StudentPlanningView, type StudentRoutineView } from './student-planning.ts';
import { formatProgramDate } from './training-programs.ts';
import { formatRestTime, routineExerciseSummary } from './routine-exercises.ts';
import { Icon } from '../ui/Icon.tsx';

export function StudentPlanningPanel({ studentId, routineId, onOpenRoutine, onBack }: {
  studentId: number;
  routineId?: number;
  onOpenRoutine: (id: number) => void;
  onBack: () => void;
}) {
  const [planning, setPlanning] = useState<StudentPlanningView | null>(null);
  const [details, setDetails] = useState<StudentRoutineView | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<StudentPlanningError | null>(null),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPlanning(null);
    setDetails(null);

    async function load() {
      try {
        const value = await getStudentPlanning(studentId, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setPlanning(value);

        if (routineId !== undefined) {
          if (!value.program || !value.routines.some(routine => routine.id === routineId)) {
            throw new StudentPlanningError('La rutina ya no está disponible.', 404);
          }

          const routine = await getStudentRoutine(routineId, value.program.id, controller.signal);

          if (!controller.signal.aborted) {
            setDetails(routine);
          }
        }
      } catch (failure: unknown) {
        if (!controller.signal.aborted) {
          setError(failure instanceof StudentPlanningError ? failure : new StudentPlanningError('No se pudo consultar tu planificación. Intentá nuevamente.'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();
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
  }, [studentId, routineId, attempt]);

  const feedback = <>
    {loading && <p role="status" className="notice muted">{routineId === undefined ? 'Consultando tu plan…' : 'Consultando rutina…'}</p>}
    {error &&
      <div className="notice">
        <p role="alert" className="text-danger">{error.message}</p>
        {error.status !== 400 && error.status !== 404 &&
          <button type="button" className="secondary" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Reintentar</button>}
      </div>}
  </>;

  if (routineId !== undefined) {
    return <section aria-label="Consulta de rutina" className="student-planning" aria-busy={loading}>
      <button type="button" className="back" onClick={onBack}><Icon name="back" />Mi plan</button>
      <header className="page-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>{error?.status === 404 ? 'Rutina no disponible' : details?.routine.name ?? 'Rutina'}</h1>
          {planning?.program && <p className="context">{planning.program.name}</p>}
        </div>
      </header>
      {feedback}
      {!loading && !error && details &&
        <>
          {details.routine.description && <p className="routine-description">{details.routine.description}</p>}
          <div className="section-head"><h2>Ejercicios <span className="muted small">· {details.exercises.length}</span></h2></div>
          {details.exercises.length === 0 && <div className="empty"><p>Todavía no hay ejercicios en esta rutina.</p></div>}
          <ul className="list" aria-label="Ejercicios de la rutina">
            {details.exercises.map(entry => <li key={entry.id}>
              <article className="student-exercise" aria-labelledby={'student-exercise-' + entry.id}>
                <h3 id={'student-exercise-' + entry.id} className="row-title">{entry.exercise.name}</h3>
                <p className="row-meta">{entry.exercise.target} · {entry.exercise.equipment}</p>
                <p className="student-exercise-summary">{routineExerciseSummary(entry)}</p>
                {(entry.restSeconds !== null || entry.recommendedRir !== null) &&
                  <p className="row-meta">
                    {[entry.restSeconds === null ? '' : 'Descanso ' + formatRestTime(entry.restSeconds), entry.recommendedRir === null ? '' : 'RIR ' + entry.recommendedRir].filter(Boolean).join(' · ')}
                  </p>}
                <details className="exercise-description">
                  <summary><Icon name="chevron" />Cómo se realiza</summary>
                  <p>{entry.exercise.instructions}</p>
                </details>
              </article>
            </li>)}
          </ul>
        </>}
    </section>;
  }

  return <section aria-label="Mi plan" className="student-planning" aria-busy={loading}>
    <h2 className="student-section-title">Mi plan</h2>
    {feedback}
    {!loading && !error && planning &&
      (planning.plan === null
        ? <div className="empty"><p>Todavía no tenés un plan cargado.</p></div>
        : <>
          <div className="plan-summary">
            <h3 className="student-plan-name">{planning.plan.name}</h3>
            <p className="objective">{planning.plan.objective}</p>
          </div>
          {planning.program === null
            ? <div className="empty"><p>El plan todavía no tiene un programa cargado.</p></div>
            : <>
              <div className="program-line">
                <div>
                  <p className="section-label">Programa</p>
                  <h3>{planning.program.name}</h3>
                  <p><time dateTime={planning.program.startDate}>{formatProgramDate(planning.program.startDate)}</time> — <time dateTime={planning.program.endDate}>{formatProgramDate(planning.program.endDate)}</time></p>
                </div>
                <span className="status-label">Vigente</span>
              </div>
              <div className="section-head"><h3>Rutinas <span className="muted small">· {planning.routines.length}</span></h3></div>
              {planning.routines.length === 0 && <div className="empty"><p>Este programa todavía no tiene rutinas.</p></div>}
              <ul className="list" aria-label="Mis rutinas">
                {planning.routines.map(routine => <li key={routine.id}>
                  <button type="button" className="routine-row" onClick={() => onOpenRoutine(routine.id)}>
                    <span className="row-copy">
                      <span className="row-title">{routine.name}</span>
                      {routine.description && <span className="row-meta">{routine.description}</span>}
                    </span>
                    <Icon name="chevron" />
                  </button>
                </li>)}
              </ul>
            </>}
        </>)}
  </section>;
}
