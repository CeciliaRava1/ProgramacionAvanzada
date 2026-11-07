import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ErrorDeCuenta, modificarCuenta, type CuentaGestionada, type ErroresDeCampoDeCuenta, type TipoDeCuenta } from './cuentas.ts';
import { obtenerErroresDeDatosDeCuenta } from '../registro/registro-de-usuario.ts';
import { SelectorDeTurnos } from '../entrenadores/SelectorDeTurnos.tsx';
import type { Turno } from '../entrenadores/turnos.ts';
import { Icono } from '../interfaz/Icono.tsx';

const camposDeTexto = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text' },
  { nombre: 'apellido', etiqueta: 'Apellido', tipo: 'text' },
  { nombre: 'correo', etiqueta: 'Correo electrónico', tipo: 'email' },
] as const;

/** Edita nombre, apellido, correo y, en entrenadores, el horario; la contraseña no se toca desde acá. */
export function FormularioDeEdicionDeCuenta({ tipo, cuenta, alGuardar, alCancelar }: {
  tipo: TipoDeCuenta;
  cuenta: CuentaGestionada;
  alGuardar: (cuenta: CuentaGestionada) => void;
  alCancelar: () => void;
}) {
  const esEntrenador = tipo === 'entrenadores';
  const [formulario, setFormulario] = useState<{ nombre: string; apellido: string; correo: string; horario: Turno[] }>({
    nombre: cuenta.nombre,
    apellido: cuenta.apellido,
    correo: cuenta.correo,
    horario: cuenta.horario ?? [],
  });
  const [guardando, setGuardando] = useState(false);
  const [erroresDeCampo, setErroresDeCampo] = useState<ErroresDeCampoDeCuenta>({});
  const [mensaje, setMensaje] = useState('');
  const pedido = useRef<AbortController | null>(null);

  useEffect(() => {
    document.getElementById('page-title')?.focus({ preventScroll: true });

    return () => pedido.current?.abort();
  }, []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (pedido.current) {
      return;
    }

    const datos = esEntrenador ? formulario : { ...formulario, horario: undefined };
    const errores = obtenerErroresDeDatosDeCuenta(datos);
    setErroresDeCampo(errores);
    setMensaje('');

    if (Object.keys(errores).length > 0) {
      setMensaje('Revisá los campos indicados.');
      const primerInvalido = evento.currentTarget.elements.namedItem(Object.keys(errores)[0]);

      if (primerInvalido instanceof HTMLElement) {
        primerInvalido.focus();
      }

      return;
    }

    const controlador = new AbortController();
    pedido.current = controlador;
    setGuardando(true);

    try {
      const guardada = await modificarCuenta(tipo, cuenta.id, datos, controlador.signal);

      if (!controlador.signal.aborted) {
        alGuardar(guardada);
      }
    } catch (error: unknown) {
      if (!controlador.signal.aborted) {
        setErroresDeCampo(error instanceof ErrorDeCuenta ? error.erroresDeCampo : {});
        setMensaje(error instanceof Error ? error.message : 'No se pudo guardar la cuenta.');
      }
    } finally {
      pedido.current = null;

      if (!controlador.signal.aborted) {
        setGuardando(false);
      }
    }
  }

  return <section aria-labelledby="page-title">
    <button type="button" className="back" onClick={alCancelar} disabled={guardando}>
      <Icono nombre="atras" />
      {esEntrenador ? 'Entrenadores' : 'Alumnos'}
    </button>
    <h1 id="page-title" tabIndex={-1}>{esEntrenador ? 'Editar entrenador' : 'Editar alumno'}</h1>
    <form className="mt-6 edit-form" onSubmit={enviar} noValidate aria-busy={guardando}>
      <fieldset className="form-fields" disabled={guardando}>
        <legend className="sr-only">Datos de la cuenta</legend>
        {camposDeTexto.map((campo) => <div className="campo-de-formulario min-w-0" key={campo.nombre}>
          <label htmlFor={`edicion-${campo.nombre}`}>{campo.etiqueta}</label>
          <input
            className="field"
            id={`edicion-${campo.nombre}`}
            name={campo.nombre}
            type={campo.tipo}
            autoComplete="off"
            required
            value={formulario[campo.nombre]}
            onChange={(evento) => setFormulario((actual) => ({ ...actual, [campo.nombre]: evento.target.value }))}
            aria-invalid={Boolean(erroresDeCampo[campo.nombre])}
            aria-describedby={erroresDeCampo[campo.nombre] ? `edicion-error-${campo.nombre}` : undefined}
          />
          {erroresDeCampo[campo.nombre] && <p className="field-error" id={`edicion-error-${campo.nombre}`}>{erroresDeCampo[campo.nombre]}</p>}
        </div>)}
        {esEntrenador &&
          <SelectorDeTurnos
            prefijoDeId="edicion-turnos"
            valor={formulario.horario}
            alCambiar={(horario) => setFormulario((actual) => ({ ...actual, horario }))}
            error={erroresDeCampo.horario}
          />}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={alCancelar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </fieldset>
    </form>
    <p className="notice text-danger empty:hidden" role="alert" aria-atomic="true">{mensaje}</p>
  </section>;
}
