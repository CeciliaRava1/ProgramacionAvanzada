import { ETIQUETAS_DE_TURNO, TURNOS, ordenarTurnos, type Turno } from './turnos.ts';

/** Casillas de turno (mañana, tarde, noche); sin ninguna marcada significa horario sin cargar. */
export function SelectorDeTurnos({ prefijoDeId, valor, alCambiar, error }: {
  prefijoDeId: string;
  valor: Turno[];
  alCambiar: (valor: Turno[]) => void;
  error?: string;
}) {
  const idDelError = `${prefijoDeId}-error`;

  return <fieldset className="grupo-de-casillas" aria-describedby={error ? idDelError : undefined}>
    <legend>Horario (opcional)</legend>
    <div className="opciones-de-casillas">
      {TURNOS.map((turno) => <label key={turno} className="opcion-de-casilla" htmlFor={`${prefijoDeId}-${turno}`}>
        <input
          id={`${prefijoDeId}-${turno}`}
          type="checkbox"
          name="horario"
          value={turno}
          checked={valor.includes(turno)}
          onChange={(evento) => alCambiar(ordenarTurnos(evento.target.checked ? [...valor, turno] : valor.filter((elemento) => elemento !== turno)))}
        />
        {ETIQUETAS_DE_TURNO[turno]}
      </label>)}
    </div>
    {error && <p className="field-error" id={idDelError}>{error}</p>}
  </fieldset>;
}
