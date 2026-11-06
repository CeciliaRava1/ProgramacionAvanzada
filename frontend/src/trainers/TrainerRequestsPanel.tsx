import { useEffect, useRef, useState } from 'react';
import { getReceivedTrainerRequests, respondTrainerRequest, type ReceivedTrainerRequest } from './trainer-requests.ts';

export function TrainerRequestsPanel({ onAccepted, onCountChange, onBusyChange }: {
  onAccepted: () => void;
  onCountChange: (count: number | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [requests, setRequests] = useState<ReceivedTrainerRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [actionFailed, setActionFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => {
    operation.current?.abort();
    onBusyChange(false);
  }, [onBusyChange]);
  useEffect(() => {
    onCountChange(requests?.length ?? null);
  }, [requests, onCountChange]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    getReceivedTrainerRequests(controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) {
          setRequests(value);
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setRequests(null);
          setLoadError(error instanceof Error ? error.message : 'No se pudieron consultar las solicitudes.');
        }
      },
    ).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    });
    const resume = () => {
      if (document.visibilityState === 'visible') {
        setAttempt((value) => value + 1);
      }
    };
    document.addEventListener('visibilitychange', resume);

    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', resume);
    };
  }, [attempt]);

  async function respond(id: number, action: 'accept' | 'reject' | 'cancel') {
    if (operation.current) {
      return;
    }

    const controller = new AbortController();
    operation.current = controller;
    setBusyId(id);
    onBusyChange(true);
    setMessage('');
    setActionFailed(false);

    try {
      await respondTrainerRequest(id, action, controller.signal);

      if (!controller.signal.aborted) {
        setMessage(action === 'accept' ? 'Solicitud aceptada. El alumno quedó vinculado.' : action === 'reject' ? 'Solicitud rechazada.' : 'Solicitud cancelada.');

        if (action === 'accept') {
          onAccepted();
        }
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setActionFailed(true);
        setMessage(error instanceof Error ? error.message : 'No se pudo responder la solicitud.');
      }
    } finally {
      operation.current = null;

      if (!controller.signal.aborted) {
        setBusyId(null);
        onBusyChange(false);
        setAttempt((value) => value + 1);
      }
    }
  }

  return (
    <section aria-labelledby="received-requests-title" aria-busy={loading || busyId !== null}>
      <h2 id="received-requests-title" className="sr-only">Solicitudes pendientes</h2>
      {loading && <p className="mt-3 text-xs text-muted" role="status">Consultando solicitudes…</p>}
      {loadError &&
        <div className="mt-4">
          <p className="text-sm text-danger" role="alert">{loadError}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            disabled={loading || busyId !== null}
            className="mt-3 min-h-11 cursor-pointer rounded-field bg-field px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
          >Reintentar</button>
        </div>}
      {message &&
        <p
          className={`mt-4 text-sm ${actionFailed ? 'text-danger' : 'text-muted'}`}
          role={actionFailed ? 'alert' : 'status'}
        >
          {message}
        </p>}
      {!loading && requests?.length === 0 && <p className="mt-4 text-sm text-muted" role="status">No tenés solicitudes pendientes.</p>}
      {requests && requests.length > 0 &&
        (
          <ul className="list" aria-label="Solicitudes pendientes">
            {requests.map((request) => (
              <li key={request.id} className="request-row">
                <p className="row-title">{request.student.firstName} {request.student.lastName}</p>
                <div className="request-actions">
                  {(['accept', 'reject', 'cancel'] as const).map((action) => (
                    <button
                      key={action}
                      type="button"
                      disabled={busyId !== null || loading}
                      onClick={() => respond(request.id, action)}
                      className={action === 'accept' ? 'primary' : action === 'reject' ? 'text-button danger' : 'secondary'}
                    >
                      {busyId === request.id ? 'Procesando…' : action === 'accept' ? 'Aceptar' : action === 'reject' ? 'Rechazar' : 'Cancelar'}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
