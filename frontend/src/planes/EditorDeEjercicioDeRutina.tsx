import { useState, type FormEvent } from 'react';
import { Icono } from '../interfaz/Icono.tsx';
import {
  formatearTiempoDeDescanso, interpretarTiempoDeDescanso, obtenerErroresDeEjercicioDeRutina,
  type Ejercicio, type EjercicioDeRutina, type DatosDeEjercicioDeRutina, type ErroresDeEjercicioDeRutina,
} from './ejercicios-de-rutina.ts';

type Campo = 'cantidadDeSeries' | 'repeticionesRecomendadas' | 'pesoRecomendadoKg' | 'descansoEnSegundos' | 'rirRecomendado';
const CAMPOS: Campo[] = ['cantidadDeSeries', 'repeticionesRecomendadas', 'pesoRecomendadoKg', 'descansoEnSegundos', 'rirRecomendado'];
const ETIQUETAS: Record<Campo, string> = {
  cantidadDeSeries: 'Series',
  repeticionesRecomendadas: 'Repeticiones',
  pesoRecomendadoKg: 'Peso (kg)',
  descansoEnSegundos: 'Descanso entre series',
  rirRecomendado: 'RIR',
};

export function EditorDeEjercicioDeRutina({ ejercicio, elemento, guardando, bloqueado, error, alVolver, alGuardar }: {
  ejercicio: Ejercicio;
  elemento?: EjercicioDeRutina;
  guardando: boolean;
  bloqueado: boolean;
  error: string;
  alVolver: () => void;
  alGuardar: (datos: DatosDeEjercicioDeRutina) => Promise<void>;
}) {
  const [datos, setDatos] = useState<Record<Campo, string>>({
    cantidadDeSeries: elemento ? String(elemento.cantidadDeSeries) : '',
    repeticionesRecomendadas: elemento ? String(elemento.repeticionesRecomendadas) : '',
    pesoRecomendadoKg: elemento?.pesoRecomendadoKg == null ? '' : String(elemento.pesoRecomendadoKg).replace('.', ','),
    descansoEnSegundos: elemento?.descansoEnSegundos == null ? '' : formatearTiempoDeDescanso(elemento.descansoEnSegundos),
    rirRecomendado: elemento?.rirRecomendado == null ? '' : String(elemento.rirRecomendado),
  });
  const [errores, setErrores] = useState<ErroresDeEjercicioDeRutina>({});

  function interpretarDatos(): DatosDeEjercicioDeRutina {
    const numero = (valor: string) => valor.trim() ? Number(valor.replace(',', '.')) : NaN;

    return {
      cantidadDeSeries: numero(datos.cantidadDeSeries),
      repeticionesRecomendadas: numero(datos.repeticionesRecomendadas),
      pesoRecomendadoKg: datos.pesoRecomendadoKg.trim() ? numero(datos.pesoRecomendadoKg) : null,
      descansoEnSegundos: datos.descansoEnSegundos.trim() ? interpretarTiempoDeDescanso(datos.descansoEnSegundos) : null,
      rirRecomendado: datos.rirRecomendado.trim() ? numero(datos.rirRecomendado) : null,
    };
  }

  function erroresDeCampo(valores: DatosDeEjercicioDeRutina) {
    const invalidos = obtenerErroresDeEjercicioDeRutina(valores);

    if (Number.isNaN(valores.descansoEnSegundos)) {
      invalidos.descansoEnSegundos = 'Usá minutos:segundos, por ejemplo 1:30.';
    }

    return invalidos;
  }

  function ajustar(campo: Campo, direccion: number) {
    if (guardando || bloqueado) {
      return;
    }

    const valores = interpretarDatos(),
      invalidos = erroresDeCampo(valores);

    if (datos[campo].trim() && invalidos[campo]) {
      setErrores({ [campo]: invalidos[campo] });
      document.getElementById('ejercicio-' + campo)?.focus();

      return;
    }

    const minimo = campo === 'cantidadDeSeries' || campo === 'repeticionesRecomendadas' ? 1 : 0;
    const maximo = campo === 'pesoRecomendadoKg' ? 999999.99 : 65535;
    const actual = datos[campo].trim() ? valores[campo] ?? 0 : 0;
    const siguiente = Math.max(minimo, Math.min(maximo, Math.round((actual + direccion * (campo === 'descansoEnSegundos' ? 15 : 1)) * 100) / 100));
    setDatos(valor => ({ ...valor, [campo]: campo === 'descansoEnSegundos' ? formatearTiempoDeDescanso(siguiente) : String(siguiente).replace('.', ',') }));
    setErrores(valor => ({ ...valor, [campo]: undefined }));
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();

    if (guardando || bloqueado) {
      return;
    }

    const interpretados = interpretarDatos(),
      invalidos = erroresDeCampo(interpretados);
    setErrores(invalidos);

    if (Object.keys(invalidos).length) {
      document.getElementById('ejercicio-' + Object.keys(invalidos)[0])?.focus();

      return;
    }

    await alGuardar(interpretados);
  }

  return <section aria-label="Indicaciones del ejercicio">
    <p className="muted small">{ejercicio.musculoObjetivo} · {ejercicio.equipamiento}</p>
    <details className="descripcion-del-ejercicio">
      <summary><Icono nombre="flecha" />Cómo se realiza</summary>
      <p>{ejercicio.instrucciones}</p>
    </details>
    <form onSubmit={enviar} noValidate className="edit-form" aria-busy={guardando}>
      <fieldset disabled={guardando || bloqueado}>
        <legend className="sr-only">Indicaciones</legend>
        <p className="ayuda-de-obligatorios">* Series y repeticiones obligatorias.</p>
        <div className="campos-del-ejercicio">
          {CAMPOS.map(campo => {
            const obligatorio = campo === 'cantidadDeSeries' || campo === 'repeticionesRecomendadas';
            const etiqueta = ETIQUETAS[campo];
            const ayuda = campo === 'descansoEnSegundos' ? 'Minutos:segundos' : campo === 'rirRecomendado' ? 'Repeticiones en reserva' : '';

            return <div
              key={campo}
              className={'campo-del-ejercicio' + (campo === 'descansoEnSegundos' ? ' descanso' : campo === 'rirRecomendado' ? ' rir' : '')}
            >
              <label htmlFor={'ejercicio-' + campo}>
                {etiqueta}
                {obligatorio && <span aria-hidden="true"> *</span>}
              </label>
              <div className="selector-numerico">
                <button
                  type="button"
                  onClick={() => ajustar(campo, -1)}
                  aria-label={campo === 'descansoEnSegundos' ? 'Restar 15 segundos de descanso' : 'Disminuir ' + etiqueta}
                >
                  {campo === 'descansoEnSegundos' ? '−15 s' : '−'}
                </button>
                <input
                  id={'ejercicio-' + campo}
                  name={campo}
                  required={obligatorio}
                  placeholder="—"
                  type="text"
                  inputMode={campo === 'descansoEnSegundos' ? 'text' : campo === 'pesoRecomendadoKg' ? 'decimal' : 'numeric'}
                  value={datos[campo]}
                  onChange={evento => {
                    setDatos(valor => ({ ...valor, [campo]: evento.target.value }));
                    setErrores(valor => ({ ...valor, [campo]: undefined }));
                  }}
                  aria-invalid={Boolean(errores[campo])}
                  aria-describedby={[ayuda ? 'ejercicio-' + campo + '-ayuda' : '', errores[campo] ? 'ejercicio-' + campo + '-error' : ''].filter(Boolean).join(' ') || undefined}
                />
                <button
                  type="button"
                  onClick={() => ajustar(campo, 1)}
                  aria-label={campo === 'descansoEnSegundos' ? 'Agregar 15 segundos de descanso' : 'Aumentar ' + etiqueta}
                >
                  {campo === 'descansoEnSegundos' ? '+15 s' : '+'}
                </button>
              </div>
              {ayuda && <p id={'ejercicio-' + campo + '-ayuda'} className="field-hint">{ayuda}</p>}
              {errores[campo] && <p id={'ejercicio-' + campo + '-error'} className="field-error">{errores[campo]}</p>}
            </div>;
          })}
        </div>
      </fieldset>
      {error && <p role="alert" className="notice text-danger">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary" disabled={guardando} onClick={alVolver}>Cancelar</button>
        <button type="submit" className="primary" disabled={guardando || bloqueado}>
          {guardando ? 'Guardando…' : elemento ? 'Guardar indicaciones' : 'Agregar a la rutina'}
        </button>
      </div>
    </form>
  </section>;
}
