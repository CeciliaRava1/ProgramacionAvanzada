import { useEffect, useRef, useState, type FormEvent } from 'react';
import { obtenerErroresDeRutina, type Rutina, type DatosDeRutina, type ErroresDeRutina } from './rutinas.ts';

export function EditorDeRutina({ rutina, guardando, puedeGuardar, alGuardar, alCerrar }: {
  rutina: Rutina | null;
  guardando: boolean;
  puedeGuardar: boolean;
  alGuardar: (datos: DatosDeRutina) => Promise<void>;
  alCerrar: () => void;
}) {
  const [datos, setDatos] = useState({ nombre: rutina?.nombre || '', descripcion: rutina?.descripcion || '' });
  const [erroresDeCampo, setErroresDeCampo] = useState<ErroresDeRutina>({});
  const [error, setError] = useState('');
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;

    return () => {
      montado.current = false;
    };
  }, []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (guardando || !puedeGuardar) {
      return;
    }

    const errores = obtenerErroresDeRutina(datos);
    setErroresDeCampo(errores);
    setError('');

    if (Object.keys(errores).length) {
      document.getElementById('rutina-' + Object.keys(errores)[0])?.focus();

      return;
    }

    try {
      await alGuardar(datos);
    }
    catch (falla: unknown) {
      if (montado.current) {
        setError(falla instanceof Error ? falla.message : 'No se pudo confirmar el guardado de la rutina.');
      }
    }
  }

  return <form className="edit-form" onSubmit={enviar} noValidate aria-busy={guardando}>
    <fieldset disabled={guardando} className="form-fields">
      <legend className="sr-only">Datos de la rutina</legend>
      {(['nombre', 'descripcion'] as const).map(campo => <div key={campo}>
        <label htmlFor={'rutina-' + campo}>{campo === 'nombre' ? 'Nombre de la rutina' : 'Descripción (opcional)'}</label>
        {campo === 'nombre'
          ? <input
            id="rutina-nombre"
            name={campo}
            required
            maxLength={200}
            value={datos.nombre}
            onChange={evento => setDatos(valor => ({ ...valor, nombre: evento.target.value }))}
            className="field"
            aria-invalid={Boolean(erroresDeCampo.nombre)}
            aria-describedby={erroresDeCampo.nombre ? 'rutina-nombre-error' : undefined}
          />
          :
          <textarea
            id="rutina-descripcion"
            name={campo}
            maxLength={5000}
            rows={3}
            value={datos.descripcion}
            onChange={evento => setDatos(valor => ({ ...valor, descripcion: evento.target.value }))}
            className="field"
            aria-invalid={Boolean(erroresDeCampo.descripcion)}
            aria-describedby={erroresDeCampo.descripcion ? 'rutina-descripcion-error' : undefined}
          />}
        {erroresDeCampo[campo] && <p className="field-error" id={'rutina-' + campo + '-error'}>{erroresDeCampo[campo]}</p>}
      </div>)}
    </fieldset>
    {error && <p role="alert" className="notice text-danger">{error}</p>}
    <div className="form-actions">
      <button type="button" className="secondary" disabled={guardando} onClick={alCerrar}>Cancelar</button>
      <button type="submit" className="primary" disabled={guardando || !puedeGuardar}>
        {guardando ? 'Guardando…' : rutina ? 'Guardar rutina' : 'Crear rutina'}
      </button>
    </div>
  </form>;
}
