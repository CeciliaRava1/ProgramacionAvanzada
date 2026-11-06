import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  getRegistrationFieldErrors, registerUser, RegistrationError,
  type RegistrationFieldErrors, type RegistrationInput,
} from './register-user.ts';

const emptyForm: RegistrationInput = { firstName: '', lastName: '', email: '', password: '', availability: '' };
const fields = [
  { name: 'firstName', label: 'Nombre', type: 'text', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Apellido', type: 'text', autoComplete: 'family-name' },
  { name: 'email', label: 'Correo electrónico', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Contraseña', type: 'password', autoComplete: 'new-password' },
] as const;

export function RegistrationForm({ accountType = 'student' }: {
  accountType?: 'student' | 'trainer';
}) {
  const [form, setForm] = useState<RegistrationInput>(emptyForm);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (request.current) {
      return;
    }

    const errors = getRegistrationFieldErrors(form);
    setFieldErrors(errors);
    setMessage('');

    if (Object.keys(errors).length > 0) {
      setStatus('error');
      setMessage('Revisá los campos indicados.');
      const firstInvalid = event.currentTarget.elements.namedItem(Object.keys(errors)[0]);

      if (firstInvalid instanceof HTMLElement) {
        firstInvalid.focus();
      }

      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setStatus('submitting');

    try {
      await registerUser(form, controller.signal, accountType);

      if (!controller.signal.aborted) {
        setForm(emptyForm);
        setStatus('success');
        setMessage(accountType === 'trainer' ? 'La cuenta de entrenador fue creada.' : 'Registro exitoso. La cuenta de alumno fue creada.');
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setStatus('error');
        setFieldErrors(error instanceof RegistrationError ? error.fieldErrors : {});
        setMessage(error instanceof RegistrationError ? error.message : 'No se pudo registrar la cuenta.');
      }
    } finally {
      request.current = null;
    }
  }

  return (
    <section aria-labelledby="registration-title">
      <h1 id="registration-title" tabIndex={-1}>{accountType === 'trainer' ? 'Crear entrenador' : 'Crear cuenta'}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {accountType === 'trainer' ? 'Ingresá los datos de la nueva cuenta.' : 'Cuenta de alumno.'}
      </p>
      <form className="mt-6 edit-form" onSubmit={submit} noValidate aria-busy={status === 'submitting'}>
        <fieldset
          className="grid min-w-0 gap-5 disabled:opacity-60 sm:grid-cols-2"
          disabled={status === 'submitting'}
        >
          <legend className="sr-only">Datos de la cuenta</legend>
          {fields.map((field) => (
            <div
              className={`form-field min-w-0 ${field.name === 'firstName' || field.name === 'lastName' ? '' : 'sm:col-span-2'}`}
              key={field.name}
            >
              <label className="mb-2 block text-sm font-medium" htmlFor={`registration-${field.name}`}>{field.label}</label>
              <input
                className="field"
                id={`registration-${field.name}`}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                required
                value={form[field.name]}
                onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                aria-invalid={Boolean(fieldErrors[field.name])}
                aria-describedby={[
                  field.name === 'password' ? 'password-hint' : '',
                  fieldErrors[field.name] ? `error-${field.name}` : '',
                ].filter(Boolean).join(' ') ||
                  undefined}
              />
              {field.name === 'password' && <p className="field-hint mt-2 text-xs text-muted" id="password-hint">Al menos 8 caracteres, sin espacios.</p>}
              {fieldErrors[field.name] && <p className="field-error mt-2 text-sm text-danger" id={`error-${field.name}`}>{fieldErrors[field.name]}</p>}
            </div>
          ))}
          {accountType === 'trainer' &&
            (
              <div className="form-field min-w-0 sm:col-span-2">
                <label className="mb-2 block text-sm font-medium" htmlFor="registration-availability">Horario (opcional)</label>
                <input
                  className="field"
                  id="registration-availability"
                  name="availability"
                  type="text"
                  value={form.availability}
                  onChange={(event) => setForm((current) => ({ ...current, availability: event.target.value }))}
                  aria-invalid={Boolean(fieldErrors.availability)}
                  aria-describedby={fieldErrors.availability ? 'error-availability' : undefined}
                />
                {fieldErrors.availability && <p className="mt-2 text-sm text-danger" id="error-availability">{fieldErrors.availability}</p>}
              </div>
            )}
          <button
            className="primary w-full sm:col-span-2"
            type="submit"
            disabled={status === 'submitting'}
          >
            {status === 'submitting' ? 'Creando cuenta…' : accountType === 'trainer' ? 'Crear cuenta de entrenador' : 'Crear cuenta de alumno'}
          </button>
        </fieldset>
      </form>
      <p
        className={`form-message form-message--${status} mt-4 text-sm empty:mt-0 ${status === 'error' ? 'text-danger' : status === 'success' ? 'text-success' : 'text-muted'}`}
        role={status === 'error' ? 'alert' : 'status'}
        aria-atomic="true"
      >
        {message}
      </p>
    </section>
  );
}
