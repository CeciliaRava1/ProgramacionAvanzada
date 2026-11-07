import { useEffect, useRef, useState } from 'react';
import { createTrainingRoutine, updateTrainingRoutine, getTrainingRoutines, TrainingRoutineError, type TrainingRoutine, type TrainingRoutineInput } from './training-routines.ts';
import { TrainingRoutineEditor } from './TrainingRoutineEditor.tsx';
import { RoutineExercisesPanel } from './RoutineExercisesPanel.tsx';
import type { RutaDelEntrenador, NavegarEntrenador } from '../entrenadores/navegacion-del-entrenador.ts';
import { Icono } from '../interfaz/Icono.tsx';

export function TrainingRoutinesPanel({ studentId, studentName, planId, programId, programName, disabled, route, onNavigate, onSavingChange }: {
  studentId: number;
  studentName: string;
  planId: number;
  programId: number;
  programName: string;
  disabled: boolean;
  route: RutaDelEntrenador;
  onNavigate: NavegarEntrenador;
  onSavingChange: (saving: boolean) => void;
}) {
  const [routines, setRoutines] = useState<TrainingRoutine[] | null>(null);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState(''),
    [uncertain, setUncertain] = useState(false);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => {
    operation.current?.abort();
    onSavingChange(false);
  }, [onSavingChange]);
  useEffect(() => {
    if (route.screen !== 'routine-form') {
      setUncertain(false);
    }
  }, [route.screen]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    getTrainingRoutines(studentId, planId, programId, controller.signal).then(
      value => {
        if (!controller.signal.aborted) {
          setRoutines(value);
        }
      },
      error => {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : 'No se pudieron consultar las rutinas.');
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
  }, [studentId, planId, programId, attempt]);

  const selected = routines?.find(routine => routine.id === route.routineId);
  const back = () => onNavigate(route.routineId ? { screen: 'routine', studentId, routineId: route.routineId } : { screen: 'student', studentId });

  async function save(input: TrainingRoutineInput) {
    if (operation.current || disabled || loading || loadError || routines === null || uncertain || route.routineId && !selected) {
      return;
    }

    const controller = new AbortController(),
      id = selected?.id;
    operation.current = controller;
    setSaving(true);
    onSavingChange(true);

    try {
      const saved = id === undefined
        ? await createTrainingRoutine(studentId, planId, programId, input, controller.signal)
        : await updateTrainingRoutine(studentId, planId, programId, id, input, controller.signal);

      if (!controller.signal.aborted) {
        setRoutines(value => id === undefined ? [...(value || []), saved] : (value || []).map(routine => routine.id === id ? saved : routine));
        setMessage(id === undefined ? 'Rutina creada.' : 'Rutina actualizada.');
        onSavingChange(false);
        onNavigate({ screen: 'routine', studentId, routineId: saved.id });
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setUncertain(error instanceof TrainingRoutineError && (error.status === 0 || error.status >= 500));
      }

      throw error;
    } finally {
      operation.current = null;

      if (!controller.signal.aborted) {
        setSaving(false);
        onSavingChange(false);
        setLoading(true);
        setAttempt(value => value + 1);
      }
    }
  }

  const unavailable = disabled || loading || Boolean(loadError),
    overview = route.screen === 'student',
    form = route.screen === 'routine-form';

  return <section aria-label="Rutinas" aria-busy={loading || saving}>
    {overview &&
      <div className="section-head">
        <h2>Rutinas{routines && <span className="muted small"> · {routines.length}</span>}</h2>
        <button
          type="button"
          className="primary"
          disabled={unavailable || routines === null}
          onClick={() => {
            setMessage('');
            onNavigate({ screen: 'routine-form', studentId });
          }}
        ><Icono nombre="mas" />Crear rutina</button>
      </div>}
    {loading && routines === null && <p role="status" className="notice muted">Consultando rutinas…</p>}
    {loadError &&
      <div className="notice">
        <p role="alert" className="text-danger">{loadError}</p>
        <button
          type="button"
          className="secondary"
          disabled={loading || disabled}
          onClick={() => setAttempt(value => value + 1)}
        >Reintentar</button>
      </div>}
    {overview && !loading && !loadError && routines?.length === 0 && <div className="empty"><p>Todavía no hay rutinas en este programa.</p></div>}
    {overview && routines &&
      <ul aria-label="Rutinas del programa" className="list">
        {routines.map(routine => <li key={routine.id}>
          <button
            type="button"
            className="routine-row"
            disabled={unavailable}
            onClick={() => {
              setMessage('');
              onNavigate({ screen: 'routine', studentId, routineId: routine.id });
            }}
          >
            <span className="row-copy">
              <span className="row-title">{routine.name}</span>
              {routine.description && <span className="row-meta">{routine.description}</span>}
            </span>
            <Icono nombre="flecha" />
          </button>
        </li>)}
      </ul>}
    {form && (!route.routineId || selected) &&
      <>
        <button type="button" className="back" disabled={saving} onClick={back}>
          <Icono nombre="atras" />
          {selected ? selected.name : 'Rutinas'}
        </button>
        <header className="page-head">
          <div>
            <h1 id="page-title" tabIndex={-1}>{selected ? 'Editar rutina' : 'Crear rutina'}</h1>
            <p className="context">{studentName} · {programName}</p>
          </div>
        </header>
        <TrainingRoutineEditor
          key={selected?.id ?? 'new'}
          routine={selected ?? null}
          saving={saving}
          canSave={!unavailable && routines !== null && !uncertain}
          onSave={save}
          onClose={back}
        />
        {uncertain && <p role="alert" className="notice text-danger">Volvé a las rutinas y revisá el resultado antes de guardar otra vez.</p>}
      </>}
    {!overview && route.routineId && !selected && !loading && !loadError &&
      <div className="empty">
        <h1 id="page-title" tabIndex={-1}>Rutina no disponible</h1>
        <button type="button" className="secondary" onClick={() => onNavigate({ screen: 'student', studentId })}>Volver a las rutinas</button>
      </div>}
    {!overview && !form && selected &&
      <>
        <button type="button" className="back" onClick={() => onNavigate({ screen: 'student', studentId })}><Icono nombre="atras" />Rutinas</button>
        <header className="page-head">
          <div>
            <h1 id="page-title" tabIndex={-1}>{selected.name}</h1>
            <p className="context">{studentName}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Editar rutina"
            disabled={unavailable}
            onClick={() => onNavigate({ screen: 'routine-form', studentId, routineId: selected.id })}
          >
            <Icono nombre="editar" />
          </button>
        </header>
        {selected.description && <p className="routine-description">{selected.description}</p>}
        {message && <p role="status" className="notice text-brand">{message}</p>}
        <RoutineExercisesPanel
          key={selected.id}
          context={{ studentId, planId, programId, routineId: selected.id }}
          studentName={studentName}
          routineName={selected.name}
          disabled={unavailable || saving}
          route={route}
          onNavigate={onNavigate}
          onBusyChange={onSavingChange}
        />
      </>}
  </section>;
}
