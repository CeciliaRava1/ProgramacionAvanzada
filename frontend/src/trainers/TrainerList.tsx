import { useEffect, useRef, useState } from 'react';
import { getTrainers, type TrainerSummary } from './trainers.ts';
import { sendTrainerRequest, TrainerRequestError } from './trainer-requests.ts';

/** Mantiene carga, error y resultado separados para no confundir un fallo con una lista vacía. */
export function TrainerList({ onRequested }: {
  onRequested: () => void;
}) {
  const [trainers, setTrainers] = useState<TrainerSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);

  async function send(trainerId: number) {
    if (operation.current) {
      return;
    }

    const controller = new AbortController();
    operation.current = controller;
    setSendingId(trainerId);
    setActionError('');

    try {
      await sendTrainerRequest(trainerId, controller.signal);

      if (!controller.signal.aborted) {
        onRequested();
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        if (error instanceof TrainerRequestError && error.status === 409) {
          onRequested();
        }
        else {
          setActionError(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.');
        }
      }
    } finally {
      operation.current = null;

      if (!controller.signal.aborted) {
        setSendingId(null);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setMessage('');
    getTrainers(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          setTrainers(result);
          setStatus('ready');
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setMessage(error instanceof Error ? error.message : 'No se pudo consultar el listado.');
          setStatus('error');
        }
      },
    );

    return () => controller.abort();
  }, [attempt]);

  return (
    <section aria-labelledby="trainers-title">
      <h2 id="trainers-title" tabIndex={-1} className="text-2xl font-semibold tracking-tight">Entrenadores</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">Elegí el entrenador al que querés enviar tu solicitud.</p>
      {actionError && <p className="mt-4 text-sm text-danger" role="alert">{actionError}</p>}
      {status === 'loading' && <p className="mt-6 text-sm text-muted" role="status">Consultando entrenadores…</p>}
      {status === 'error' &&
        (
          <div className="mt-6">
            <p className="text-sm text-danger" role="alert">{message}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-4 min-h-12 w-full cursor-pointer rounded-field bg-brand px-4 py-3 font-semibold text-brand-foreground outline-hidden hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >Reintentar</button>
          </div>
        )}
      {status === 'ready' &&
        (trainers.length === 0
          ? (
            <p className="mt-6 text-sm text-muted" role="status">Todavía no hay entrenadores registrados.</p>
          )
          : (
            <ul className="mt-6 grid list-none gap-5 p-0 lg:grid-cols-2" aria-label="Listado de entrenadores">
              {trainers.map((trainer) => (
                <li key={trainer.id} className="surface-card flex flex-col p-6 [overflow-wrap:anywhere]">
                  <h3 className="text-lg font-semibold text-body">{trainer.firstName} {trainer.lastName}</h3>
                  {trainer.availability && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">Horario: {trainer.availability}</p>}
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => send(trainer.id)}
                    disabled={sendingId !== null}
                    className="mt-6 min-h-11 w-full cursor-pointer rounded-field bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground outline-hidden hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-60"
                  >
                    {sendingId === trainer.id ? 'Enviando…' : 'Solicitar entrenador'}
                  </button>
                </li>
              ))}
            </ul>
          ))}
    </section>
  );
}
