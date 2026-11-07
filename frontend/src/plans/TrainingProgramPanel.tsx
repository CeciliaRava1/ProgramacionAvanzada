import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createTrainingProgram, getTrainingPrograms, getTrainingProgramFieldErrors, parseProgramDate, formatProgramDate, type TrainingProgram, type TrainingProgramFieldErrors } from './training-programs.ts';
import { TrainingRoutinesPanel } from './TrainingRoutinesPanel.tsx';
import type { RutaDelEntrenador, NavegarEntrenador } from '../entrenadores/navegacion-del-entrenador.ts';
import { Icono } from '../interfaz/Icono.tsx';

export function TrainingProgramPanel({ studentId, studentName, planId, disabled, route, onNavigate, onSavingChange }: {
  studentId: number;
  studentName: string;
  planId: number;
  disabled: boolean;
  route: RutaDelEntrenador;
  onNavigate: NavegarEntrenador;
  onSavingChange: (saving: boolean) => void;
}) {
  const [programs, setPrograms] = useState<TrainingProgram[] | null>(null);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [input, setInput] = useState({ name: '', startDate: '', endDate: '' });
  const [fieldErrors, setFieldErrors] = useState<TrainingProgramFieldErrors>({});
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState(''),
    [failed, setFailed] = useState(false);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => {
    operation.current?.abort();
    onSavingChange(false);
  }, [onSavingChange]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    getTrainingPrograms(studentId, planId, controller.signal).then(
      value => {
        if (!controller.signal.aborted) {
          setPrograms(value);
        }
      },
      error => {
        if (!controller.signal.aborted) {
          setPrograms(null);
          setLoadError(error instanceof Error ? error.message : 'No se pudo consultar el programa.');
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
  }, [studentId, planId, attempt]);
  const back = () => onNavigate({ screen: 'student', studentId });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (operation.current || disabled || loading || loadError || programs?.length !== 0) {
      return;
    }

    const values = { ...input, startDate: parseProgramDate(input.startDate), endDate: parseProgramDate(input.endDate) };
    const errors = getTrainingProgramFieldErrors(values);
    setFieldErrors(errors);
    setMessage('');

    if (Object.keys(errors).length) {
      document.getElementById('program-' + Object.keys(errors)[0])?.focus();

      return;
    }

    const controller = new AbortController();
    operation.current = controller;
    setSaving(true);
    onSavingChange(true);
    setFailed(false);

    try {
      const saved = await createTrainingProgram(studentId, planId, values, controller.signal);

      if (!controller.signal.aborted) {
        setPrograms([saved]);
        setMessage('Programa creado.');
        onSavingChange(false);
        back();
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : 'No se pudo confirmar la creación del programa.');
      }
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

  const program = programs?.[0],
    form = route.screen === 'program-form',
    overview = route.screen === 'student';

  return <section aria-label="Programa de entrenamiento" aria-busy={loading || saving}>
    {form &&
      <>
        <button type="button" className="back" disabled={saving} onClick={back}>
          <Icono nombre="atras" />
          {studentName}
        </button>
        <header className="page-head">
          <div>
            <h1 id="page-title" tabIndex={-1}>Crear programa</h1>
            <p className="context">{studentName}</p>
          </div>
        </header>
      </>}
    {loading && programs === null && <p role="status" className="notice muted">Consultando programa…</p>}
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
    {message && (overview || form) &&
      <p role={failed ? 'alert' : 'status'} className={'notice ' + (failed ? 'text-danger' : 'text-brand')}>{message}</p>}
    {overview && program &&
      <div className="program-line">
        <div>
          <p className="section-label">Programa</p>
          <h2>{program.name}</h2>
          <p><time dateTime={program.startDate}>{formatProgramDate(program.startDate)}</time> — <time dateTime={program.endDate}>{formatProgramDate(program.endDate)}</time></p>
        </div>
        <span className="status-label">Vigente</span>
      </div>}
    {!form && !loading && programs?.length === 0 &&
      <div className="empty">
        <h2>Sin programa</h2>
        <p>Agregá el período de trabajo para comenzar con las rutinas.</p>
        <button
          type="button"
          className="primary"
          disabled={disabled}
          onClick={() => onNavigate({ screen: 'program-form', studentId })}
        ><Icono nombre="mas" />Crear programa</button>
      </div>}
    {form && programs !== null &&
      <form onSubmit={submit} noValidate className="edit-form">
        <fieldset disabled={saving || loading || disabled || programs.length > 0} className="form-fields">
          <legend className="sr-only">Datos del programa</legend>
          {(['name', 'startDate', 'endDate'] as const).map(field => <div key={field}>
            <label htmlFor={'program-' + field}>
              {field === 'name' ? 'Nombre del programa' : field === 'startDate' ? 'Fecha de inicio' : 'Fecha de fin'}
            </label>
            {field === 'name'
              ? <input
                id="program-name"
                name={field}
                required
                value={input.name}
                maxLength={200}
                onChange={event => setInput(value => ({ ...value, name: event.target.value }))}
                className="field"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'program-name-error' : undefined}
              />
              :
              <div className="date-field">
                <input
                  id={'program-' + field}
                  name={field}
                  type="text"
                  inputMode="numeric"
                  placeholder="dd/mm/aaaa"
                  required
                  value={input[field]}
                  maxLength={10}
                  onChange={event => setInput(value => ({ ...value, [field]: event.target.value }))}
                  onBlur={() => {
                    const date = parseProgramDate(input[field]);

                    if (date) {
                      setInput(value => ({ ...value, [field]: formatProgramDate(date) }));
                    }
                  }}
                  className="field"
                  aria-invalid={Boolean(fieldErrors[field])}
                  aria-describedby={fieldErrors[field] ? 'program-' + field + '-error' : undefined}
                />
                <span className="date-picker">
                  <svg
                    className="icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4M8 3v4M3 11h18" />
                  </svg>
                </span>
                <input
                  className="date-calendar"
                  type="date"
                  value={parseProgramDate(input[field])}
                  min={field === 'endDate' ? parseProgramDate(input.startDate) || '1000-01-01' : '1000-01-01'}
                  max="9999-12-31"
                  aria-label={field === 'startDate' ? 'Elegir fecha de inicio en el calendario' : 'Elegir fecha de fin en el calendario'}
                  onChange={event => setInput(value => ({ ...value, [field]: formatProgramDate(event.target.value) }))}
                  onClick={event => event.currentTarget.showPicker?.()}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.currentTarget.showPicker?.();
                    }
                  }}
                />
              </div>}
            {fieldErrors[field] && <p id={'program-' + field + '-error'} className="field-error">{fieldErrors[field]}</p>}
          </div>)}
        </fieldset>
        <p className="notice muted small">Queda vigente al guardarlo, independientemente de las fechas.</p>
        {program && <p role="alert" className="notice text-danger">Ya hay un programa. Volvé al alumno para consultar el resultado.</p>}
        <div className="form-actions">
          <button type="button" className="secondary" disabled={saving} onClick={back}>Cancelar</button>
          <button
            type="submit"
            className="primary"
            disabled={saving || loading || disabled || Boolean(loadError) || programs.length > 0}
          >
            {saving ? 'Guardando…' : 'Guardar programa'}
          </button>
        </div>
      </form>}
    {!form && program &&
      <TrainingRoutinesPanel
        key={program.id}
        studentId={studentId}
        studentName={studentName}
        planId={planId}
        programId={program.id}
        programName={program.name}
        disabled={disabled || loading || saving || Boolean(loadError)}
        route={route}
        onNavigate={onNavigate}
        onSavingChange={onSavingChange}
      />}
  </section>;
}
