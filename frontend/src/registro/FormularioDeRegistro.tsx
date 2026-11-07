import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ErrorDeRegistro, obtenerErroresDeRegistro, registrarUsuario,
  type EntradaDeRegistro, type ErroresDeRegistro, type TipoDeCuentaARegistrar,
} from './registro-de-usuario.ts';
import { CampoContrasena } from '../interfaz/CampoContrasena.tsx';
import { SelectorDeTurnos } from '../entrenadores/SelectorDeTurnos.tsx';

const formularioVacio: EntradaDeRegistro = { nombre: '', apellido: '', correo: '', contrasena: '', horario: [] };
const campos = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', autocompletado: 'given-name' },
  { nombre: 'apellido', etiqueta: 'Apellido', tipo: 'text', autocompletado: 'family-name' },
  { nombre: 'correo', etiqueta: 'Correo electrónico', tipo: 'email', autocompletado: 'email' },
  { nombre: 'contrasena', etiqueta: 'Contraseña', tipo: 'password', autocompletado: 'new-password' },
] as const;

/** Alta de cuentas: solo la usa el administrador, para alumnos y entrenadores. */
export function FormularioDeRegistro({ tipoDeCuenta = 'alumno', alCrear }: {
  tipoDeCuenta?: TipoDeCuentaARegistrar;
  alCrear?: () => void;
}) {
  const esEntrenador = tipoDeCuenta === 'entrenador';
  const [formulario, setFormulario] = useState<EntradaDeRegistro>(formularioVacio);
  const [estado, setEstado] = useState<'reposo' | 'enviando' | 'exito' | 'error'>('reposo');
  const [erroresDeCampo, setErroresDeCampo] = useState<ErroresDeRegistro>({});
  const [mensaje, setMensaje] = useState('');
  const pedido = useRef<AbortController | null>(null);

  useEffect(() => () => pedido.current?.abort(), []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (pedido.current) {
      return;
    }

    const errores = obtenerErroresDeRegistro(esEntrenador ? formulario : { ...formulario, horario: undefined });
    setErroresDeCampo(errores);
    setMensaje('');

    if (Object.keys(errores).length > 0) {
      setEstado('error');
      setMensaje('Revisá los campos indicados.');
      const primerInvalido = evento.currentTarget.elements.namedItem(Object.keys(errores)[0]);

      if (primerInvalido instanceof HTMLElement) {
        primerInvalido.focus();
      }

      return;
    }

    const controlador = new AbortController();
    pedido.current = controlador;
    setEstado('enviando');

    try {
      await registrarUsuario(formulario, controlador.signal, tipoDeCuenta);

      if (!controlador.signal.aborted) {
        setFormulario(formularioVacio);
        setEstado('exito');
        setMensaje(esEntrenador ? 'La cuenta de entrenador fue creada.' : 'La cuenta de alumno fue creada.');
        alCrear?.();
      }
    } catch (error: unknown) {
      if (!controlador.signal.aborted) {
        setEstado('error');
        setErroresDeCampo(error instanceof ErrorDeRegistro ? error.erroresDeCampo : {});
        setMensaje(error instanceof ErrorDeRegistro ? error.message : 'No se pudo registrar la cuenta.');
      }
    } finally {
      pedido.current = null;
    }
  }

  return (
    <section aria-labelledby="titulo-de-registro">
      <h1 id="titulo-de-registro" tabIndex={-1}>{esEntrenador ? 'Crear entrenador' : 'Crear alumno'}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {esEntrenador ? 'Ingresá los datos de la nueva cuenta.' : 'Ingresá los datos de la cuenta del alumno.'}
      </p>
      <form className="mt-6 edit-form" onSubmit={enviar} noValidate aria-busy={estado === 'enviando'}>
        <fieldset
          className="grid min-w-0 gap-5 disabled:opacity-60 sm:grid-cols-2"
          disabled={estado === 'enviando'}
        >
          <legend className="sr-only">Datos de la cuenta</legend>
          {campos.map((campo) => (
            <div
              className={`campo-de-formulario min-w-0 ${campo.nombre === 'nombre' || campo.nombre === 'apellido' ? '' : 'sm:col-span-2'}`}
              key={campo.nombre}
            >
              <label className="mb-2 block text-sm font-medium" htmlFor={`registro-${campo.nombre}`}>{campo.etiqueta}</label>
              {campo.nombre === 'contrasena'
                ? <CampoContrasena
                  id="registro-contrasena"
                  nombre="contrasena"
                  autocompletado="new-password"
                  valor={formulario.contrasena}
                  alCambiar={(valor) => setFormulario((actual) => ({ ...actual, contrasena: valor }))}
                  invalido={Boolean(erroresDeCampo.contrasena)}
                  descritoPor={['ayuda-de-contrasena', erroresDeCampo.contrasena ? 'error-contrasena' : ''].filter(Boolean).join(' ')}
                />
                : <input
                  className="field"
                  id={`registro-${campo.nombre}`}
                  name={campo.nombre}
                  type={campo.tipo}
                  autoComplete={campo.autocompletado}
                  required
                  value={formulario[campo.nombre]}
                  onChange={(evento) => setFormulario((actual) => ({ ...actual, [campo.nombre]: evento.target.value }))}
                  aria-invalid={Boolean(erroresDeCampo[campo.nombre])}
                  aria-describedby={erroresDeCampo[campo.nombre] ? `error-${campo.nombre}` : undefined}
                />}
              {campo.nombre === 'contrasena' && <p className="field-hint mt-2 text-xs text-muted" id="ayuda-de-contrasena">Al menos 8 caracteres, sin espacios.</p>}
              {erroresDeCampo[campo.nombre] && <p className="field-error mt-2 text-sm text-danger" id={`error-${campo.nombre}`}>{erroresDeCampo[campo.nombre]}</p>}
            </div>
          ))}
          {esEntrenador &&
            <div className="campo-de-formulario min-w-0 sm:col-span-2">
              <SelectorDeTurnos
                prefijoDeId="registro-horario"
                valor={formulario.horario ?? []}
                alCambiar={(horario) => setFormulario((actual) => ({ ...actual, horario }))}
                error={erroresDeCampo.horario}
              />
            </div>}
          <button
            className="primary w-full sm:col-span-2"
            type="submit"
            disabled={estado === 'enviando'}
          >
            {estado === 'enviando' ? 'Creando cuenta…' : esEntrenador ? 'Crear cuenta de entrenador' : 'Crear cuenta de alumno'}
          </button>
        </fieldset>
      </form>
      <p
        className={`mensaje-del-formulario mensaje-del-formulario--${estado} mt-4 text-sm empty:mt-0 ${estado === 'error' ? 'text-danger' : estado === 'exito' ? 'text-success' : 'text-muted'}`}
        role={estado === 'error' ? 'alert' : 'status'}
        aria-atomic="true"
      >
        {mensaje}
      </p>
    </section>
  );
}
