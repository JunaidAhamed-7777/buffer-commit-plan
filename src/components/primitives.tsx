'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Cloud, FileText, LoaderCircle } from 'lucide-react';

export function Spinner() {
  return <LoaderCircle className="spinner" size={16} aria-hidden="true" />;
}

export function Channel({ name }: { name: string }) {
  const service = name.split(/[ ·]/)[0]?.toLowerCase();
  return (
    <span className="channel">
      <span className={`channel-icon ${service === 'linkedin' ? 'linkedin' : ''}`} aria-hidden="true">
        {service === 'linkedin' ? 'in' : service === 'bluesky' ? <Cloud size={15} /> : <FileText size={15} />}
      </span>
      <span>{name}</span>
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <FileText size={22} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Modal({ title, description, children, onClose }: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    element?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog ref={dialog} className="dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId} className="dialog-description">{description}</p>
      {children}
    </dialog>
  );
}

export function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date);
}
