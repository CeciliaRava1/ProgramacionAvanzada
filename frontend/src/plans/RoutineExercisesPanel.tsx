import { useEffect, useRef, useState } from 'react';
import { ExercisePicker } from './ExercisePicker.tsx';
import { RoutineExerciseEditor } from './RoutineExerciseEditor.tsx';
import { getRoutineExercises, saveRoutineExercise, routineExerciseSummary, formatRestTime, isExercise, RoutineExerciseError, type RoutineContext, type RoutineExercise, type RoutineExerciseInput } from './routine-exercises.ts';
import { hrefDelEntrenador, type RutaDelEntrenador, type NavegarEntrenador } from '../entrenadores/navegacion-del-entrenador.ts';
import { Icono } from '../interfaz/Icono.tsx';
import { Dialogo } from '../interfaz/Dialogo.tsx';

export function RoutineExercisesPanel({ context, studentName, routineName, disabled, route, onNavigate, onBusyChange }: {
  context: RoutineContext;
  studentName: string;
  routineName: string;
  disabled: boolean;
  route: RutaDelEntrenador;
  onNavigate: NavegarEntrenador;
  onBusyChange: (saving: boolean) => void;
}) {
  const [entries, setEntries] = useState<RoutineExercise[] | null>(null);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(''),
    [uncertain, setUncertain] = useState(false),
    [message, setMessage] = useState('');
  const operation = useRef<AbortController | null>(null);
  const previous = useRef(route.screen);
  const { studentId, planId, programId, routineId } = context;
  useEffect(() => () => {
    operation.current?.abort();
    onBusyChange(false);
  }, [onBusyChange]);
  const routeKey = hrefDelEntrenador(route);
  useEffect(() => {
    setSaveError('');
    setUncertain(false);
  }, [routeKey]);
  useEffect(() => {
    if (route.screen === 'routine' && previous.current !== 'routine' && uncertain) {
      setAttempt(value => value + 1);
    }

    previous.current = route.screen;
  }, [route.screen, uncertain]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    getRoutineExercises({ studentId, planId, programId, routineId }, controller.signal).then(
      value => {
        if (!controller.signal.aborted) {
          setEntries(value);
        }
      },
      failure => {
        if (!controller.signal.aborted) {
          setLoadError(failure instanceof Error ? failure.message : 'No se pudieron consultar los ejercicios.');
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
  }, [studentId, planId, programId, routineId, attempt]);
  const entry = entries?.find(value => value.id === route.entryId);
  const cached: unknown = history.state?.exercise;
  const exercise = entry?.exercise ?? (route.exerciseId && isExercise(cached) && cached.id === route.exerciseId ? cached : undefined);
  const back = () => onNavigate({ screen: 'routine', studentId, routineId });
  const catalog = () => {
    setMessage('');
    onNavigate({ screen: 'catalog', studentId, routineId });
  };

  async function save(input: RoutineExerciseInput) {
    if (!exercise || disabled || loading || loadError || uncertain || operation.current || entries === null) {
      return;
    }

    const controller = new AbortController();
    operation.current = controller;
    setSaving(true);
    onBusyChange(true);
    setSaveError('');

    try {
      const saved = await saveRoutineExercise(context, exercise.id, input, controller.signal, entry?.id);

      if (!controller.signal.aborted) {
        setEntries(value => entry ? (value || []).map(item => item.id === saved.id ? saved : item) : [...(value || []), saved]);
        setMessage(entry ? 'Indicaciones guardadas.' : 'Ejercicio agregado.');
        onBusyChange(false);
        back();
      }
    } catch (failure: unknown) {
      if (!controller.signal.aborted) {
        setSaveError(failure instanceof Error ? failure.message : 'No se pudo guardar el ejercicio.');
        setUncertain(failure instanceof RoutineExerciseError && failure.uncertain);
      }
    } finally {
      operation.current = null;

      if (!controller.signal.aborted) {
        setSaving(false);
        onBusyChange(false);
      }
    }
  }

  const overview = route.screen === 'routine',
    configuring = route.screen === 'exercise';
  const unavailable = disabled || loading || saving || Boolean(loadError) || entries === null || uncertain;
  const list = <ul aria-label="Ejercicios guardados en la rutina" className="list">
    {entries?.map(item => <li key={item.id}>
      <button
        type="button"
        className="exercise-row"
        disabled={unavailable}
        aria-current={route.entryId === item.id ? 'true' : undefined}
        onClick={() => {
          setMessage('');
          onNavigate({ screen: 'exercise', studentId, routineId, entryId: item.id });
        }}
      >
        <span className="row-copy">
          <span className="row-title">{item.exercise.name}</span>
          <span className="row-meta">{routineExerciseSummary(item)}</span>
          {(item.restSeconds !== null || item.recommendedRir !== null) &&
            <span className="row-meta">
              {[item.restSeconds === null ? '' : 'Descanso ' + formatRestTime(item.restSeconds), item.recommendedRir === null ? '' : 'RIR ' + item.recommendedRir].filter(Boolean).join(' · ')}
            </span>}
        </span>
        <Icono nombre="flecha" />
      </button>
    </li>)}
  </ul>;

  return <section aria-busy={loading || saving}>
    {loading && entries === null && <p role="status" className="notice muted">Consultando ejercicios…</p>}
    {loadError &&
      <div className="notice">
        <p role="alert" className="text-danger">{loadError}</p>
        <button
          type="button"
          className="secondary"
          disabled={disabled || saving}
          onClick={() => setAttempt(value => value + 1)}
        >Reintentar</button>
      </div>}
    <div className="section-head">
      <h2>Ejercicios{entries && <span className="muted small"> · {entries.length}</span>}</h2>
      <button type="button" className="primary" disabled={unavailable} onClick={catalog}><Icono nombre="mas" />Agregar ejercicio</button>
    </div>
    {message && <p role="status" className="notice text-brand">{message}</p>}
    {!loading && !loadError && entries?.length === 0 && <div className="empty"><p>Todavía no hay ejercicios en esta rutina.</p></div>}
    {list}
    <Dialogo
      abierto={!overview}
      titulo={configuring ? route.entryId ? 'Editar indicaciones' : 'Indicaciones' : 'Agregar ejercicio'}
      ocupado={saving}
      alCerrar={back}
    >
      <p className="dialog-context">{routineName} · {studentName}</p>
      {loadError &&
        <div className="notice">
          <p role="alert" className="text-danger">{loadError}</p>
          <button
            type="button"
            className="secondary"
            disabled={disabled || saving}
            onClick={() => setAttempt(value => value + 1)}
          >Reintentar</button>
        </div>}
      <div hidden={route.screen !== 'catalog'}>
        <ExercisePicker
          active={route.screen === 'catalog'}
          disabled={unavailable}
          onPick={selected => onNavigate({ screen: 'exercise', studentId, routineId, exerciseId: selected.id }, selected)}
        />
      </div>
      {configuring && exercise &&
        <>
          {!entry && !uncertain && <button type="button" className="back" disabled={saving} onClick={catalog}><Icono nombre="atras" />Catálogo</button>}
          <h3 className="dialog-exercise-name">{exercise.name}</h3>
          <RoutineExerciseEditor
            key={routeKey}
            exercise={exercise}
            entry={entry}
            saving={saving}
            blocked={unavailable}
            error={saveError}
            onBack={back}
            onSave={save}
          />
        </>}
      {configuring && !exercise && !loading && !loadError &&
        <div className="empty">
          <p role="alert">
            {route.entryId ? 'Este ejercicio ya no está disponible en la rutina.' : 'Volvé a seleccionar el ejercicio en el catálogo.'}
          </p>
          <button type="button" className="secondary" onClick={catalog}>Abrir catálogo</button>
        </div>}
      {uncertain &&
        <p role="alert" className="notice text-danger">Cerrá esta ventana y comprobá el resultado en la rutina antes de guardar otra vez.</p>}
    </Dialogo>
  </section>;
}
