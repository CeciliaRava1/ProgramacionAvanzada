import { useEffect, useRef, useState, type FormEvent } from 'react';
import { pedirRecuperacion } from './recuperacion.ts';

/** Pide el enlace para cambiar la contraseña; el mensaje final es el mismo exista o no la cuenta. */
export function PantallaDePedirRecuperacion() {
  const [correo, setCorreo] = useState('');
  const [estado, setEstado] = useState<'reposo' | 'enviando' | 'enviado' | 'error'>('reposo');
  const [mensaje, setMensaje] = useState('');
  const pedido = useRef<AbortController | null>(null);
  useEffect(() => () => pedido.current?.abort(), []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (pedido.current) {
      return;
    }

    if (!correo.trim() || [...correo.trim()].length > 254) {
      setEstado('error');
      setMensaje('Ingresá un correo electrónico válido.');

      return;
    }

    const controlador = new AbortController();
    pedido.current = controlador;
    setEstado('enviando');
    setMensaje('');

    try {
      await pedirRecuperacion(correo, controlador.signal);

      if (!controlador.signal.aborted) {
        setEstado('enviado');
      }
    } catch (error: unknown) {
      if (!controlador.signal.aborted) {
        setEstado('error');
        setMensaje(error instanceof Error ? error.message : 'No se pudo pedir el enlace.');
      }
    } finally {
      pedido.current = null;
    }
  }

  if (estado === 'enviado') {
    return <section aria-labelledby="titulo-de-recuperacion">
      <h1 id="titulo-de-recuperacion">Revisá tu correo</h1>
      <p className="mt-3 text-sm leading-relaxed" role="status">
        Si existe una cuenta con esos datos, te enviamos un correo con el enlace para cambiar la contraseña.
        El enlace sirve una sola vez y vence en 1 hora.
      </p>
      <p className="mt-6 text-sm"><a className="enlace-de-acceso" href="#/">Volver a iniciar sesión</a></p>
    </section>;
  }

  return <section aria-labelledby="titulo-de-recuperacion">
    <h1 id="titulo-de-recuperacion">Recuperar contraseña</h1>
    <p className="mt-3 text-sm leading-relaxed text-muted">Te enviamos por correo un enlace para elegir una contraseña nueva.</p>
    <form className="mt-6" onSubmit={enviar} noValidate aria-busy={estado === 'enviando'}>
      <fieldset disabled={estado === 'enviando'} className="form-fields">
        <legend className="sr-only">Datos de la cuenta</legend>
        <div>
          <label htmlFor="recuperacion-correo" className="mb-2 block text-sm font-medium">Correo electrónico</label>
          <input
            id="recuperacion-correo"
            name="correo"
            type="email"
            autoComplete="email"
            required
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            className="field"
          />
        </div>
        <button type="submit" className="primary w-full">{estado === 'enviando' ? 'Enviando…' : 'Enviar enlace'}</button>
      </fieldset>
    </form>
    <p className="mt-4 text-sm text-danger empty:mt-0" role="alert">{mensaje}</p>
    <p className="mt-4 text-sm"><a className="enlace-de-acceso" href="#/">Volver a iniciar sesión</a></p>
  </section>;
}
