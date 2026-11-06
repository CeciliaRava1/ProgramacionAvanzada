import { useLayoutEffect, useRef, type ReactNode } from 'react';

export function Dialog({ open, title, busy, onClose, children }: {
  open: boolean; title: string; busy: boolean; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      const target = trigger instanceof HTMLElement && trigger.isConnected && trigger !== document.body && !trigger.matches(':disabled') ? trigger : document.getElementById('page-title');
      target?.focus({ preventScroll: true });
    };
  }, [open]);
  useLayoutEffect(() => {
    if (open) { dialog.current!.scrollTop = 0; heading.current?.focus({ preventScroll: true }); }
  }, [open, title]);

  return <dialog ref={dialog} className="exercise-dialog" aria-labelledby="dialog-title" onKeyDown={event => { if (busy && event.key === 'Escape') event.preventDefault(); }} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => {
    if (busy || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <header className="dialog-head"><h2 id="dialog-title" ref={heading} tabIndex={-1}>{title}</h2><button type="button" className="icon-button" aria-label="Cerrar" disabled={busy} onClick={onClose}>
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button></header>
    <div className="dialog-body">{children}</div>
  </dialog>;
}
