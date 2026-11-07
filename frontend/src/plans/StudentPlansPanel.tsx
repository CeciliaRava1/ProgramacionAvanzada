import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AlumnoAsignado } from '../entrenadores/alumnos-asignados.ts';
import type { RutaDelEntrenador, NavegarEntrenador } from '../entrenadores/navegacion-del-entrenador.ts';
import { Icono } from '../interfaz/Icono.tsx';
import { createTrainingPlan, updateTrainingPlan, deleteTrainingPlan, getTrainingPlans, getTrainingPlanFieldErrors, type TrainingPlan, type TrainingPlanFieldErrors } from './training-plans.ts';
import { TrainingProgramPanel } from './TrainingProgramPanel.tsx';

export function StudentPlansPanel({ student, route, onNavigate, onBusyChange }: {
  student: AlumnoAsignado;
  route: RutaDelEntrenador;
  onNavigate: NavegarEntrenador;
  onBusyChange: (busy: boolean) => void;
}) {
  const [plans, setPlans] = useState<TrainingPlan[] | null>(null);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [input, setInput] = useState({ name: '', objective: '' });
  const [fieldErrors, setFieldErrors] = useState<TrainingPlanFieldErrors>({});
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState(''),
    [failed, setFailed] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null),
    [deletingId, setDeletingId] = useState<number | null>(null);
  const opened = useRef('');
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => {
    operation.current?.abort();
    onBusyChange(false);
  }, [onBusyChange]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    getTrainingPlans(student.id, controller.signal).then(
      value => {
        if (!controller.signal.aborted) {
          setPlans(value);
        }
      },
      error => {
        if (!controller.signal.aborted) {
          setPlans(null);
          setLoadError(error instanceof Error ? error.message : 'No se pudieron consultar los planes.');
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
  }, [student.id, attempt]);
  useEffect(() => {
    const form = route.screen === 'plan-form' || route.screen === 'delete-plan';

    if (!form) {
      opened.current = '';

      return;
    }

    if (plans === null || opened.current === route.screen) {
      return;
    }

    opened.current = route.screen;
    setMessage('');
    setFieldErrors({});
    setFailed(false);

    if (route.screen === 'plan-form') {
      setEditingId(plans[0]?.id ?? null);
      setInput({ name: plans[0]?.name ?? '', objective: plans[0]?.objective ?? '' });
    } else {
      setDeletingId(plans[0]?.id ?? null);
    }
  }, [route.screen, plans]);

  const back = () => onNavigate({ screen: 'student', studentId: student.id });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (operation.current || loading || loadError || plans === null || (editingId === null && plans.length !== 0)) {
      return;
    }

    const errors = getTrainingPlanFieldErrors(input);
    setFieldErrors(errors);
    setMessage('');

    if (Object.keys(errors).length) {
      document.getElementById('plan-' + Object.keys(errors)[0])?.focus();

      return;
    }

    const controller = new AbortController();
    operation.current = controller;
    setSaving(true);
    onBusyChange(true);
    setFailed(false);

    try {
      const saved = editingId === null ? await createTrainingPlan(student.id, input, controller.signal) : await updateTrainingPlan(student.id, editingId, input, controller.signal);

      if (!controller.signal.aborted) {
        setPlans([saved]);
        setMessage(editingId === null ? 'Plan creado.' : 'Plan actualizado.');
        onBusyChange(false);
        back();
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : 'No se pudo confirmar el guardado del plan.');
      }
    } finally {
      operation.current = null;

      if (!controller.signal.aborted) {
        setSaving(false);
        onBusyChange(false);
        setLoading(true);
        setAttempt(value => value + 1);
      }
    }
  }

  async function remove() {
    if (operation.current || loading || loadError || deletingId === null || plans?.[0]?.id !== deletingId) {
      return;
    }

    const controller = new AbortController();
    operation.current = controller;
    setSaving(true);
    onBusyChange(true);
    setMessage('');
    setFailed(false);

    try {
      await deleteTrainingPlan(student.id, deletingId, controller.signal);

      if (!controller.signal.aborted) {
        setPlans([]);
        setMessage('Plan eliminado.');
        onBusyChange(false);
        back();
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : 'No se pudo confirmar la eliminación del plan.');
      }
    } finally {
      operation.current = null;

      if (!controller.signal.aborted) {
        setSaving(false);
        onBusyChange(false);
        setLoading(true);
        setAttempt(value => value + 1);
      }
    }
  }

  const plan = plans?.[0],
    form = route.screen === 'plan-form',
    deleting = route.screen === 'delete-plan',
    overview = route.screen === 'student';
  const studentName = student.nombre + ' ' + student.apellido;

  return <section aria-busy={saving}>
    {(overview || form || deleting || !plan) &&
      <>
        <button
          type="button"
          className="back"
          disabled={saving}
          onClick={overview || !plan && !form && !deleting ? () => onNavigate({ screen: 'alumnos' }) : back}
        >
          <Icono nombre="atras" />
          {overview || !plan && !form && !deleting ? 'Alumnos' : studentName}
        </button>
        <header className="page-head">
          <div>
            <h1 id="page-title" tabIndex={-1}>{form ? editingId === null ? 'Crear plan' : 'Editar plan' : deleting ? 'Eliminar plan' : studentName}</h1>
            {(form || deleting) && <p className="context">{studentName}</p>}
          </div>
        </header>
      </>}
    {loading && plans === null && <p role="status" className="notice muted">Consultando plan…</p>}
    {loadError &&
      <div className="notice">
        <p role="alert" className="text-danger">{loadError}</p>
        <button
          type="button"
          className="secondary"
          disabled={loading || saving}
          onClick={() => setAttempt(value => value + 1)}
        >Reintentar</button>
      </div>}
    {message && (overview || form || deleting) &&
      <p role={failed ? 'alert' : 'status'} className={'notice ' + (failed ? 'text-danger' : 'text-brand')}>{message}</p>}
    {overview && plan &&
      <div className="plan-summary">
        <p className="section-label">Plan de entrenamiento</p>
        <div className="plan-heading">
          <h2>{plan.name}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Editar plan"
            disabled={loading}
            onClick={() => onNavigate({ screen: 'plan-form', studentId: student.id })}
          >
            <Icono nombre="editar" />
          </button>
        </div>
        <p className="objective">{plan.objective}</p>
        <details className="plan-options">
          <summary><Icono nombre="abajo" />Más opciones del plan</summary>
          <button
            type="button"
            className="text-button danger"
            disabled={loading}
            onClick={() => onNavigate({ screen: 'delete-plan', studentId: student.id })}
          >Eliminar plan</button>
        </details>
      </div>}
    {!form && !deleting && !loading && plans?.length === 0 &&
      <div className="empty">
        <h2>Sin plan de entrenamiento</h2>
        <p>Creá un plan para organizar el programa y sus rutinas.</p>
        <button
          type="button"
          className="primary"
          onClick={() => onNavigate({ screen: 'plan-form', studentId: student.id })}
        ><Icono nombre="mas" />Crear plan</button>
      </div>}
    {form && plans !== null &&
      <form onSubmit={submit} noValidate className="edit-form">
        <fieldset disabled={saving || loading || Boolean(loadError)} className="form-fields">
          <legend className="sr-only">Datos del plan</legend>
          {(['name', 'objective'] as const).map(field => <div key={field}>
            <label htmlFor={'plan-' + field}>{field === 'name' ? 'Nombre del plan' : 'Objetivo'}</label>
            {field === 'name'
              ? <input
                id="plan-name"
                name={field}
                value={input.name}
                required
                maxLength={200}
                onChange={event => setInput(value => ({ ...value, name: event.target.value }))}
                className="field"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'plan-name-error' : undefined}
              />
              :
              <textarea
                id="plan-objective"
                name={field}
                value={input.objective}
                required
                maxLength={5000}
                rows={4}
                onChange={event => setInput(value => ({ ...value, objective: event.target.value }))}
                className="field"
                aria-invalid={Boolean(fieldErrors.objective)}
                aria-describedby={fieldErrors.objective ? 'plan-objective-error' : undefined}
              />}
            {fieldErrors[field] && <p id={'plan-' + field + '-error'} className="field-error">{fieldErrors[field]}</p>}
          </div>)}
        </fieldset>
        {editingId === null && plans.length > 0 &&
          <p role="alert" className="notice text-danger">Ya hay un plan. Volvé al alumno para consultar el resultado antes de guardar otra vez.</p>}
        <div className="form-actions">
          <button type="button" className="secondary" disabled={saving} onClick={back}>Cancelar</button>
          <button
            type="submit"
            className="primary"
            disabled={saving || loading || Boolean(loadError) || editingId === null && plans.length > 0}
          >
            {saving ? 'Guardando…' : 'Guardar plan'}
          </button>
        </div>
      </form>}
    {deleting &&
      <div className="edit-form">
        <h2>¿Eliminar {plan?.name ?? 'este plan'}?</h2>
        <p className="notice muted">Dejará de estar disponible para entrenar. Su registro se conservará para el historial.</p>
        <div className="form-actions">
          <button type="button" className="secondary" disabled={saving} onClick={back}>Cancelar</button>
          <button
            type="button"
            className="danger-button"
            disabled={saving || loading || Boolean(loadError) || deletingId === null || plan?.id !== deletingId}
            onClick={remove}
          >
            {saving ? 'Eliminando…' : 'Eliminar plan'}
          </button>
        </div>
      </div>}
    {!form && !deleting && plan &&
      <TrainingProgramPanel
        key={plan.id}
        studentId={student.id}
        studentName={studentName}
        planId={plan.id}
        disabled={loading || saving || Boolean(loadError)}
        route={route}
        onNavigate={onNavigate}
        onSavingChange={onBusyChange}
      />}
  </section>;
}
