import { useState, type FormEvent } from 'react';
import { Icon } from '../ui/Icon.tsx';
import { formatRestTime, parseRestTime, getRoutineExerciseFieldErrors, type Exercise, type RoutineExercise, type RoutineExerciseInput, type RoutineExerciseFieldErrors } from './routine-exercises.ts';

export function RoutineExerciseEditor({ exercise, entry, saving, blocked, error, onBack, onSave }: {
  exercise: Exercise;
  entry?: RoutineExercise;
  saving: boolean;
  blocked: boolean;
  error: string;
  onBack: () => void;
  onSave: (input: RoutineExerciseInput) => Promise<void>;
}) {
  const [input, setInput] = useState({
    setCount: entry ? String(entry.setCount) : '',
    recommendedRepetitions: entry ? String(entry.recommendedRepetitions) : '',
    recommendedWeightKg: entry?.recommendedWeightKg == null ? '' : String(entry.recommendedWeightKg).replace('.', ','),
    restSeconds: entry?.restSeconds == null ? '' : formatRestTime(entry.restSeconds),
    recommendedRir: entry?.recommendedRir == null ? '' : String(entry.recommendedRir)
  });
  const [errors, setErrors] = useState<RoutineExerciseFieldErrors>({});

  function parseInput(): RoutineExerciseInput {
    const number = (value: string) => value.trim() ? Number(value.replace(',', '.')) : NaN;

    return {
      setCount: number(input.setCount),
      recommendedRepetitions: number(input.recommendedRepetitions),
      recommendedWeightKg: input.recommendedWeightKg.trim() ? number(input.recommendedWeightKg) : null,
      restSeconds: input.restSeconds.trim() ? parseRestTime(input.restSeconds) : null,
      recommendedRir: input.recommendedRir.trim() ? number(input.recommendedRir) : null
    };
  }

  function fieldErrors(values: RoutineExerciseInput) {
    const invalid = getRoutineExerciseFieldErrors(values);

    if (Number.isNaN(values.restSeconds)) {
      invalid.restSeconds = 'Usá minutos:segundos, por ejemplo 1:30.';
    }

    return invalid;
  }

  function adjust(field: keyof typeof input, direction: number) {
    if (saving || blocked) {
      return;
    }

    const values = parseInput(),
      invalid = fieldErrors(values);

    if (input[field].trim() && invalid[field]) {
      setErrors({ [field]: invalid[field] });
      document.getElementById('exercise-' + field)?.focus();

      return;
    }

    const minimum = field === 'setCount' || field === 'recommendedRepetitions' ? 1 : 0;
    const maximum = field === 'recommendedWeightKg' ? 999999.99 : 65535;
    const current = input[field].trim() ? values[field] ?? 0 : 0;
    const next = Math.max(minimum, Math.min(maximum, Math.round((current + direction * (field === 'restSeconds' ? 15 : 1)) * 100) / 100));
    setInput(value => ({ ...value, [field]: field === 'restSeconds' ? formatRestTime(next) : String(next).replace('.', ',') }));
    setErrors(value => ({ ...value, [field]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (saving || blocked) {
      return;
    }

    const parsed = parseInput(),
      invalid = fieldErrors(parsed);
    setErrors(invalid);

    if (Object.keys(invalid).length) {
      document.getElementById('exercise-' + Object.keys(invalid)[0])?.focus();

      return;
    }

    await onSave(parsed);
  }

  return <section aria-label="Indicaciones del ejercicio">
    <p className="muted small">{exercise.target} · {exercise.equipment}</p>
    <details className="exercise-description">
      <summary><Icon name="chevron" />Cómo se realiza</summary>
      <p>{exercise.instructions}</p>
    </details>
    <form onSubmit={submit} noValidate className="edit-form" aria-busy={saving}>
      <fieldset disabled={saving || blocked}>
        <legend className="sr-only">Indicaciones</legend>
        <p className="required-hint">* Series y repeticiones obligatorias.</p>
        <div className="exercise-fields">
          {(['setCount', 'recommendedRepetitions', 'recommendedWeightKg', 'restSeconds', 'recommendedRir'] as const).map(field => {
            const required = field === 'setCount' || field === 'recommendedRepetitions';
            const label = {
              setCount: 'Series',
              recommendedRepetitions: 'Repeticiones',
              recommendedWeightKg: 'Peso (kg)',
              restSeconds: 'Descanso entre series',
              recommendedRir: 'RIR'
            }[field];
            const hint = field === 'restSeconds' ? 'Minutos:segundos' : field === 'recommendedRir' ? 'Repeticiones en reserva' : '';

            return <div
              key={field}
              className={'exercise-field' + (field === 'restSeconds' ? ' rest' : field === 'recommendedRir' ? ' rir' : '')}
            >
              <label htmlFor={'exercise-' + field}>
                {label}
                {required && <span aria-hidden="true"> *</span>}
              </label>
              <div className="stepper">
                <button
                  type="button"
                  onClick={() => adjust(field, -1)}
                  aria-label={field === 'restSeconds' ? 'Restar 15 segundos de descanso' : 'Disminuir ' + label}
                >
                  {field === 'restSeconds' ? '−15 s' : '−'}
                </button>
                <input
                  id={'exercise-' + field}
                  name={field}
                  required={required}
                  placeholder="—"
                  type="text"
                  inputMode={field === 'restSeconds' ? 'text' : field === 'recommendedWeightKg' ? 'decimal' : 'numeric'}
                  value={input[field]}
                  onChange={event => {
                    setInput(value => ({ ...value, [field]: event.target.value }));
                    setErrors(value => ({ ...value, [field]: undefined }));
                  }}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={[hint ? 'exercise-' + field + '-hint' : '', errors[field] ? 'exercise-' + field + '-error' : ''].filter(Boolean).join(' ') || undefined}
                />
                <button
                  type="button"
                  onClick={() => adjust(field, 1)}
                  aria-label={field === 'restSeconds' ? 'Agregar 15 segundos de descanso' : 'Aumentar ' + label}
                >
                  {field === 'restSeconds' ? '+15 s' : '+'}
                </button>
              </div>
              {hint && <p id={'exercise-' + field + '-hint'} className="field-hint">{hint}</p>}
              {errors[field] && <p id={'exercise-' + field + '-error'} className="field-error">{errors[field]}</p>}
            </div>;
          })}
        </div>
      </fieldset>
      {error && <p role="alert" className="notice text-danger">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary" disabled={saving} onClick={onBack}>Cancelar</button>
        <button type="submit" className="primary" disabled={saving || blocked}>
          {saving ? 'Guardando…' : entry ? 'Guardar indicaciones' : 'Agregar a la rutina'}
        </button>
      </div>
    </form>
  </section>;
}
