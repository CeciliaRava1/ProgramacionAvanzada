import { useEffect, useRef, useState, type FormEvent } from 'react';
import { iniciarSesion, type UsuarioDeSesion } from './sesion.ts';
import { CampoContrasena } from '../interfaz/CampoContrasena.tsx';

/** Conserva la contraseña solo durante el envío; la sesión la administra el backend. */
export function FormularioDeInicioDeSesion({ alIniciarSesion }: {
  alIniciarSesion: (usuario: UsuarioDeSesion) => void;
}) {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const pedido = useRef<AbortController | null>(null);
  useEffect(() => () => pedido.current?.abort(), []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (pedido.current) {
      return;
    }

    if (!correo.trim() || !contrasena || [...correo.trim()].length > 254 || [...contrasena].length > 128) {
      setMensaje('Ingresá un correo y una contraseña válidos.');

      return;
    }

    const controlador = new AbortController();
    pedido.current = controlador;
    setEnviando(true);
    setMensaje('');

    try {
      const usuario = await iniciarSesion(correo, contrasena, controlador.signal);

      if (!controlador.signal.aborted) {
        setContrasena('');
        alIniciarSesion(usuario);
      }
    } catch (error: unknown) {
      if (!controlador.signal.aborted) {
        setMensaje(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
      }
    } finally {
      pedido.current = null;

      if (!controlador.signal.aborted) {
        setEnviando(false);
      }
    }
  }

  return (
    <section aria-labelledby="titulo-de-inicio-de-sesion">
      <h1 id="titulo-de-inicio-de-sesion">Iniciar sesión</h1>
      <form className="mt-6" onSubmit={enviar} aria-busy={enviando}>
        <fieldset disabled={enviando} className="form-fields">
          <legend className="sr-only">Datos de acceso</legend>
          <div>
            <label htmlFor="inicio-correo" className="mb-2 block text-sm font-medium">Correo electrónico</label>
            <input
              id="inicio-correo"
              name="correo"
              type="email"
              autoComplete="username"
              required
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="inicio-contrasena" className="mb-2 block text-sm font-medium">Contraseña</label>
            <CampoContrasena
              id="inicio-contrasena"
              nombre="contrasena"
              autocompletado="current-password"
              valor={contrasena}
              alCambiar={setContrasena}
            />
          </div>
          <button type="submit" className="primary w-full">{enviando ? 'Ingresando…' : 'Iniciar sesión'}</button>
        </fieldset>
      </form>
      <p className="mt-4 text-sm"><a className="enlace-de-acceso" href="#/recuperar">¿Olvidaste tu contraseña?</a></p>
      <p className="mt-4 text-sm text-danger empty:mt-0" role="alert">{mensaje}</p>
    </section>
  );
}
