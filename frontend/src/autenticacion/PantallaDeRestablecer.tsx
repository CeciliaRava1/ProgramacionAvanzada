import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ErrorDeRecuperacion, errorDeContrasenaNueva, restablecerContrasena } from './recuperacion.ts';
import { CampoContrasena } from '../interfaz/CampoContrasena.tsx';

/** Elige la contraseña nueva con el enlace recibido por correo; el enlace se usa una sola vez. */
export function PantallaDeRestablecer({ token, alRestablecer }: {
  token: string | null;
  alRestablecer: () => void;
}) {
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [enlaceInvalido, setEnlaceInvalido] = useState(token === null);
  const pedido = useRef<AbortController | null>(null);
  useEffect(() => () => pedido.current?.abort(), []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (pedido.current || token === null) {
      return;
    }

    const error = errorDeContrasenaNueva(contrasena, confirmacion);

    if (error) {
      setMensaje(error);

      return;
    }

    const controlador = new AbortController();
    pedido.current = controlador;
    setEnviando(true);
    setMensaje('');

    try {
      await restablecerContrasena(token, contrasena, controlador.signal);

      if (!controlador.signal.aborted) {
        setContrasena('');
        setConfirmacion('');
        alRestablecer();
      }
    } catch (fallo: unknown) {
      if (!controlador.signal.aborted) {
        setMensaje(fallo instanceof Error ? fallo.message : 'No se pudo cambiar la contraseña.');
        setEnlaceInvalido(fallo instanceof ErrorDeRecuperacion && fallo.enlaceInvalido);
      }
    } finally {
      pedido.current = null;

      if (!controlador.signal.aborted) {
        setEnviando(false);
      }
    }
  }

  if (enlaceInvalido) {
    return <section aria-labelledby="titulo-de-restablecer">
      <h1 id="titulo-de-restablecer">Enlace no válido</h1>
      <p className="mt-3 text-sm leading-relaxed" role="alert">
        {mensaje || 'El enlace no es válido o ya venció. Pedí uno nuevo.'}
      </p>
      <p className="mt-6"><a className="primary boton-de-enlace" href="#/recuperar">Pedir un enlace nuevo</a></p>
    </section>;
  }

  return <section aria-labelledby="titulo-de-restablecer">
    <h1 id="titulo-de-restablecer">Elegí tu nueva contraseña</h1>
    <form className="mt-6" onSubmit={enviar} noValidate aria-busy={enviando}>
      <fieldset disabled={enviando} className="form-fields">
        <legend className="sr-only">Contraseña nueva</legend>
        <div>
          <label htmlFor="restablecer-contrasena" className="mb-2 block text-sm font-medium">Contraseña nueva</label>
          <CampoContrasena
            id="restablecer-contrasena"
            nombre="contrasena"
            autocompletado="new-password"
            valor={contrasena}
            alCambiar={setContrasena}
            descritoPor="ayuda-de-contrasena-nueva"
          />
          <p className="field-hint mt-2 text-xs text-muted" id="ayuda-de-contrasena-nueva">Al menos 8 caracteres, sin espacios.</p>
        </div>
        <div>
          <label htmlFor="restablecer-confirmacion" className="mb-2 block text-sm font-medium">Repetí la contraseña</label>
          <CampoContrasena
            id="restablecer-confirmacion"
            nombre="confirmacion"
            autocompletado="new-password"
            valor={confirmacion}
            alCambiar={setConfirmacion}
          />
        </div>
        <button type="submit" className="primary w-full">{enviando ? 'Guardando…' : 'Cambiar contraseña'}</button>
      </fieldset>
    </form>
    <p className="mt-4 text-sm text-danger empty:mt-0" role="alert">{mensaje}</p>
  </section>;
}
