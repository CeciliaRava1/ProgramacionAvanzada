import { useEffect, useState } from 'react';
import { searchExercises, type Exercise, type ExercisePage, type ExerciseFilters } from './routine-exercises.ts';
import { Icono } from '../interfaz/Icono.tsx';

export function ExercisePicker({ active, disabled, onPick }: {
  active: boolean;
  disabled: boolean;
  onPick: (exercise: Exercise) => void;
}) {
  const [filters, setFilters] = useState<ExerciseFilters>({ q: '', bodyPart: '', equipment: '', offset: 0 });
  const [page, setPage] = useState<ExercisePage | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');
    // La espera agrupa las pulsaciones antes de consultar el cat?logo.
    const timer = setTimeout(() => {
      searchExercises(filters, controller.signal).then(
        value => {
          if (!controller.signal.aborted) {
            setPage(value);
          }
        },
        failure => {
          if (!controller.signal.aborted) {
            setError(failure instanceof Error ? failure.message : 'No se pudo consultar el catálogo.');
          }
        },
      ).finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, attempt, active]);
  const unavailable = disabled || loading || Boolean(error);

  return <section aria-label="Catálogo de ejercicios" aria-busy={loading}>
    <label htmlFor="exercise-catalog-search">Buscar ejercicio</label>
    <div className="search-field">
      <Icono nombre="buscar" />
      <input
        id="exercise-catalog-search"
        type="search"
        maxLength={100}
        value={filters.q}
        disabled={disabled}
        onChange={event => setFilters(value => ({ ...value, q: event.target.value, offset: 0 }))}
        className="field"
        placeholder="Nombre, músculo o equipamiento"
      />
    </div>
    <details className="filters">
      <summary><Icono nombre="abajo" />Filtros{(filters.bodyPart || filters.equipment) && <span className="badge">Activos</span>}</summary>
      <div className="filters-grid">
        {(['bodyPart', 'equipment'] as const).map(field => <div key={field}>
          <label htmlFor={'catalog-' + field}>{field === 'bodyPart' ? 'Grupo corporal' : 'Equipamiento'}</label>
          <select
            id={'catalog-' + field}
            value={filters[field]}
            disabled={disabled}
            onChange={event => setFilters(value => ({ ...value, [field]: event.target.value, offset: 0 }))}
            className="field"
          >
            <option value="">Todos</option>
            {(field === 'bodyPart' ? page?.bodyParts : page?.equipment)?.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>)}
      </div>
    </details>
    {loading && <p role="status" className="notice muted">Buscando ejercicios…</p>}
    {error &&
      <div className="notice">
        <p role="alert" className="text-danger">{error}</p>
        <button
          type="button"
          disabled={disabled || loading}
          className="secondary"
          onClick={() => setAttempt(value => value + 1)}
        >Reintentar</button>
      </div>}
    {!loading && !error && page &&
      <p role="status" className="result-count">
        {page.total === 0 ? 'No se encontraron ejercicios.' : page.total + ' ejercicios · ' + (filters.offset + 1) + '–' + (filters.offset + page.items.length)}
      </p>}
    {page &&
      <ul className="list">
        {page.items.map(exercise => <li key={exercise.id}>
          <button type="button" className="catalog-row" disabled={unavailable} onClick={() => onPick(exercise)}>
            <span className="row-copy">
              <span className="row-title">{exercise.name}</span>
              <span className="row-meta">{exercise.target} · {exercise.equipment}</span>
            </span>
            <span className="catalog-add"><Icono nombre="mas" /></span>
          </button>
        </li>)}
      </ul>}
    {page && page.total > 20 &&
      <nav aria-label="Páginas de ejercicios" className="pagination">
        <button
          type="button"
          className="secondary"
          disabled={unavailable || filters.offset === 0}
          onClick={() => setFilters(value => ({ ...value, offset: Math.max(0, value.offset - 20) }))}
        >Anterior</button>
        <button
          type="button"
          className="secondary"
          disabled={unavailable || filters.offset + page.items.length >= page.total}
          onClick={() => setFilters(value => ({ ...value, offset: value.offset + 20 }))}
        >Siguiente</button>
      </nav>}
  </section>;
}
