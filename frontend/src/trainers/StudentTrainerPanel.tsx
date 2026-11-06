import { useEffect, useRef, useState } from 'react';
import { TrainerList } from './TrainerList.tsx';
import { getStudentTrainerState, respondTrainerRequest, type StudentTrainerState } from './trainer-requests.ts';

export function StudentTrainerPanel({ showList, onShowListChange, onCanChooseChange }: {
  showList: boolean;
  onShowListChange: (show: boolean) => void;
  onCanChooseChange: (canChoose: boolean) => void;
}) {
  const [connection, setConnection] = useState<StudentTrainerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionFailed, setActionFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const operation = useRef<AbortController | null>(null);
  const hasInteracted = useRef(false);
  useEffect(() => () => operation.current?.abort(), []);

  // Volver de una lista confirma el estado aunque se haya interrumpido un envío.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    getStudentTrainerState(controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) {
          setConnection(value);
          onCanChooseChange(value.status === 'unassigned');

          if (value.status !== 'unassigned') {
            onShowListChange(false);
          }
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setConnection(null);
          onCanChooseChange(false);
          setLoadError(error instanceof Error ? error.message : 'No se pudo consultar el estado.');
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
  }, [attempt, showList, onCanChooseChange, onShowListChange]);

  useEffect(() => {
    if (showList) {
      hasInteracted.current = true;
    }

    if (!hasInteracted.current) {
      return;
    }

    if (showList) {
      document.getElementById('trainers-title')?.focus();
    }
    else if (connection?.status === 'unassigned') {
      document.getElementById('show-trainers')?.focus();
    }
    else {
      document.getElementById('student-trainer-title')?.focus();
    }
  }, [showList, connection?.status]);

  async function cancel(id: number) {
    if (operation.current) {
      return;
    }

    hasInteracted.current = true;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setActionMessage('');
    setActionFailed(false);

    try {
      await respondTrainerRequest(id, 'cancel', controller.signal);

      if (!controller.signal.aborted) {
        setConnection(null);
        setActionMessage('Solicitud cancelada.');
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setActionFailed(true);
        setActionMessage(error instanceof Error ? error.message : 'No se pudo cancelar la solicitud.');
      }
    } finally {
      operation.current = null;

      if (!controller.signal.aborted) {
        setBusy(false);
        setAttempt((value) => value + 1);
      }
    }
  }

  if (loadError) {
    return (
      <div className="surface-card p-6 sm:p-8">
        <p className="text-sm text-danger" role="alert">{loadError}</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="mt-4 min-h-11 w-full cursor-pointer rounded-field bg-brand p-3 font-semibold text-brand-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >Reintentar</button>
      </div>
    );
  }

  if (!connection) {
    return <p className="mt-6 text-sm text-muted" role="status">Consultando entrenador…</p>;
  }

  if (connection.status === 'unassigned' && showList) {
    return (
      <div>
        <TrainerList onRequested={() => {
          setConnection(null);
          onCanChooseChange(false);
          onShowListChange(false);
          setActionMessage('');
          setAttempt((value) => value + 1);
        }} />
      </div>
    );
  }

  return (
    <section aria-label="Vinculación con entrenador" aria-busy={loading || busy}>
      {connection.status === 'unassigned'
        ? (
          <div className="surface-card p-6 sm:p-8">
            <h3 className="text-xl font-semibold">Tu entrenador</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Elegí a quién enviar tu solicitud.</p>
            <button
              id="show-trainers"
              type="button"
              disabled={loading}
              onClick={() => {
                setActionMessage('');
                onShowListChange(true);
              }}
              className="mt-6 min-h-12 w-full cursor-pointer rounded-field bg-brand px-5 py-3 font-semibold text-brand-foreground outline-hidden hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 sm:w-auto"
            >Ver entrenadores <span aria-hidden="true" className="ml-5">→</span></button>
          </div>
        )
        : (
          <div className="surface-card p-6 [overflow-wrap:anywhere] sm:p-8">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-brand">
              {connection.status === 'pending' ? 'Solicitud enviada' : 'Acompañamiento'}
            </p>
            <h3 id="student-trainer-title" tabIndex={-1} className="text-xl font-semibold">
              {connection.status === 'pending' ? 'Pendiente de aceptación' : 'Mi entrenador'}
            </h3>
            <p className="mt-5 text-lg">{connection.trainer.firstName} {connection.trainer.lastName}</p>
            {connection.trainer.availability && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">Horario: {connection.trainer.availability}</p>}
            {connection.status === 'pending' &&
              (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => cancel(connection.requestId)}
                    disabled={busy || loading}
                    className="min-h-11 w-full cursor-pointer rounded-field bg-panel p-3 text-sm text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 sm:w-auto"
                  >
                    {busy ? 'Cancelando…' : 'Cancelar solicitud'}
                  </button>
                </div>
              )}
          </div>
        )}
      {loading && <p className="mt-3 text-xs text-muted" role="status">Consultando entrenador…</p>}
      {actionMessage &&
        <p
          className={`mt-4 text-sm ${actionFailed ? 'text-danger' : 'text-muted'}`}
          role={actionFailed ? 'alert' : 'status'}
        >
          {actionMessage}
        </p>}
    </section>
  );
}
