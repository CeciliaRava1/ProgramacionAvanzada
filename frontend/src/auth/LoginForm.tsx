import { useEffect, useRef, useState, type FormEvent } from 'react';
import { signIn, type SessionUser } from './session.ts';

/** Conserva la contraseña solo durante el envío; la sesión la administra el backend. */
export function LoginForm({ onSignedIn }: {
  onSignedIn: (user: SessionUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (request.current) {
      return;
    }

    if (!email.trim() || !password || [...email.trim()].length > 254 || [...password].length > 128) {
      setMessage('Ingresá un correo y una contraseña válidos.');

      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setSubmitting(true);
    setMessage('');

    try {
      const user = await signIn(email, password, controller.signal);

      if (!controller.signal.aborted) {
        setPassword('');
        onSignedIn(user);
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
      }
    } finally {
      request.current = null;

      if (!controller.signal.aborted) {
        setSubmitting(false);
      }
    }
  }

  return (
    <section aria-labelledby="login-title">
      <h1 id="login-title">Iniciar sesión</h1>
      <form className="mt-6" onSubmit={submit} aria-busy={submitting}>
        <fieldset disabled={submitting} className="form-fields">
          <legend className="sr-only">Datos de acceso</legend>
          <div>
            <label htmlFor="login-email" className="mb-2 block text-sm font-medium">Correo electrónico</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-2 block text-sm font-medium">Contraseña</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field"
            />
          </div>
          <button type="submit" className="primary w-full">{submitting ? 'Ingresando…' : 'Iniciar sesión'}</button>
        </fieldset>
      </form>
      <p className="mt-4 text-sm text-danger empty:mt-0" role="alert">{message}</p>
    </section>
  );
}
