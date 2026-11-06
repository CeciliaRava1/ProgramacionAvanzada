import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getTrainingRoutineFieldErrors, type TrainingRoutine, type TrainingRoutineInput, type TrainingRoutineFieldErrors } from './training-routines.ts';

export function TrainingRoutineEditor({ routine, saving, canSave, onSave, onClose }: {
  routine: TrainingRoutine | null;
  saving: boolean;
  canSave: boolean;
  onSave: (input: TrainingRoutineInput) => Promise<void>;
  onClose: () => void;
}) {
  const [input, setInput] = useState({ name: routine?.name || '', description: routine?.description || '' });
  const [fieldErrors, setFieldErrors] = useState<TrainingRoutineFieldErrors>({});
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || !canSave) {
      return;
    }

    const errors = getTrainingRoutineFieldErrors(input);
    setFieldErrors(errors);
    setError('');

    if (Object.keys(errors).length) {
      document.getElementById('routine-' + Object.keys(errors)[0])?.focus();

      return;
    }

    try {
      await onSave(input);
    }
    catch (failure: unknown) {
      if (mounted.current) {
        setError(failure instanceof Error ? failure.message : 'No se pudo confirmar el guardado de la rutina.');
      }
    }
  }

  return <form className="edit-form" onSubmit={submit} noValidate aria-busy={saving}>
    <fieldset disabled={saving} className="form-fields">
      <legend className="sr-only">Datos de la rutina</legend>
      {(['name', 'description'] as const).map(field => <div key={field}>
        <label htmlFor={'routine-' + field}>{field === 'name' ? 'Nombre de la rutina' : 'Descripción (opcional)'}</label>
        {field === 'name'
          ? <input
            id="routine-name"
            name={field}
            required
            maxLength={200}
            value={input.name}
            onChange={event => setInput(value => ({ ...value, name: event.target.value }))}
            className="field"
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'routine-name-error' : undefined}
          />
          :
          <textarea
            id="routine-description"
            name={field}
            maxLength={5000}
            rows={3}
            value={input.description}
            onChange={event => setInput(value => ({ ...value, description: event.target.value }))}
            className="field"
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={fieldErrors.description ? 'routine-description-error' : undefined}
          />}
        {fieldErrors[field] && <p className="field-error" id={'routine-' + field + '-error'}>{fieldErrors[field]}</p>}
      </div>)}
    </fieldset>
    {error && <p role="alert" className="notice text-danger">{error}</p>}
    <div className="form-actions">
      <button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button>
      <button type="submit" className="primary" disabled={saving || !canSave}>
        {saving ? 'Guardando…' : routine ? 'Guardar rutina' : 'Crear rutina'}
      </button>
    </div>
  </form>;
}
