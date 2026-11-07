import { useLayoutEffect, useRef, type ReactNode } from 'react';

export function Dialogo({ abierto, titulo, ocupado, alCerrar, children }: {
  abierto: boolean; titulo: string; ocupado: boolean; alCerrar: () => void; children: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const encabezado = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (!abierto) return;
    const elemento = dialogo.current!;
    const disparador = document.activeElement;
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    elemento.showModal();
    return () => {
      elemento.close();
      document.body.style.overflow = desbordeAnterior;
      // El foco vuelve al control que abrió el diálogo; si ya no existe, al título de la página.
      const destino = disparador instanceof HTMLElement && disparador.isConnected && disparador !== document.body && !disparador.matches(':disabled') ? disparador : document.getElementById('page-title');
      destino?.focus({ preventScroll: true });
    };
  }, [abierto]);
  useLayoutEffect(() => {
    if (abierto) { dialogo.current!.scrollTop = 0; encabezado.current?.focus({ preventScroll: true }); }
  }, [abierto, titulo]);

  return <dialog ref={dialogo} className="dialogo" aria-labelledby="titulo-del-dialogo" onKeyDown={evento => { if (ocupado && evento.key === 'Escape') evento.preventDefault(); }} onCancel={evento => { evento.preventDefault(); if (!ocupado) alCerrar(); }} onClick={evento => {
    if (ocupado || evento.target !== evento.currentTarget) return;
    const limites = evento.currentTarget.getBoundingClientRect();
    if (evento.clientX < limites.left || evento.clientX > limites.right || evento.clientY < limites.top || evento.clientY > limites.bottom) alCerrar();
  }}>
    <header className="cabecera-del-dialogo"><h2 id="titulo-del-dialogo" ref={encabezado} tabIndex={-1}>{titulo}</h2><button type="button" className="icon-button" aria-label="Cerrar" disabled={ocupado} onClick={alCerrar}>
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button></header>
    <div className="cuerpo-del-dialogo">{children}</div>
  </dialog>;
}
