// Generic controls: buttons, paper panels, dialogs, tooltips, segmented choices and switches (restyled from cnc-claude's
// kit for a field-manual look).
import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Stencil button. primary = olive drab, secondary = khaki paper, ghost = outlined, danger = signal red. */
export function Button(p: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg' }) {
  const { variant = 'primary', size = 'md', className, type, children, ...rest } = p;
  return (
    <button {...rest} type={type ?? 'button'} className={`kit-btn kit-btn--${variant} kit-btn--${size} ${className ?? ''}`}>
      <span className="kit-btn__label">{children}</span>
    </button>
  );
}

/** A sheet of paper with an optional stencilled title strip. */
export function Panel(p: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section className={`kit-panel kit-paper ${p.className ?? ''}`} style={p.style}>
      {p.title ? (
        <header className="kit-panel__head">
          <h3 className="kit-panel__title">{p.title}</h3>
          {p.aside ? <div className="kit-panel__aside">{p.aside}</div> : null}
        </header>
      ) : null}
      <div className="kit-panel__body">{p.children}</div>
    </section>
  );
}

/** A centred paper dialog over a dimmed desk. Escape / backdrop click call onClose. */
export function Modal(p: { open: boolean; title?: string; children: ReactNode; onClose?: () => void; width?: number | string; footer?: ReactNode }) {
  const { open, onClose } = p;
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const width = p.width === undefined ? undefined : { width: `min(${typeof p.width === 'number' ? `${p.width}px` : p.width}, 100%)` };
  const node = (
    <div
      className="kit-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="kit-modal__box kit-paper" role="dialog" aria-modal="true" aria-label={p.title} style={width}>
        {onClose ? (
          <button type="button" className="kit-modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        ) : null}
        {p.title ? (
          <header className="kit-modal__head">
            <h2 className="kit-modal__title">{p.title}</h2>
          </header>
        ) : null}
        <div className="kit-modal__body">{p.children}</div>
        {p.footer ? <footer className="kit-modal__foot">{p.footer}</footer> : null}
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
}

/**
 * A floating tooltip card near (x, y). With position 'fixed' (default) x/y are viewport (client) coordinates and the
 * tooltip flips to stay on screen; with 'absolute' they are relative to the nearest positioned ancestor.
 */
export function Tooltip(p: {
  x: number;
  y: number;
  children: ReactNode;
  position?: 'fixed' | 'absolute';
  offset?: number;
  /** 'bare' drops the dark backing (e.g. to float a card). */
  variant?: 'dark' | 'bare';
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const position = p.position ?? 'fixed';
  const off = p.offset ?? 16;
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: p.x + off, top: p.y + off });
  useLayoutEffect(() => {
    let left = p.x + off;
    let top = p.y + off;
    const el = ref.current;
    if (el && position === 'fixed' && typeof window !== 'undefined') {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (left + w > window.innerWidth - 8) left = Math.max(8, p.x - off - w);
      if (top + h > window.innerHeight - 8) top = Math.max(8, p.y - off - h);
    }
    setPos((cur) => (cur.left === left && cur.top === top ? cur : { left, top }));
  }, [p.x, p.y, off, position]);
  return (
    <div
      ref={ref}
      className={`kit-tooltip ${p.variant === 'bare' ? 'kit-tooltip--bare' : ''} ${p.className ?? ''}`}
      role="tooltip"
      style={{ position, left: pos.left, top: pos.top, ...p.style }}
    >
      {p.children}
    </div>
  );
}

/** Full-bleed desk background. */
export function Desk(p: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`kit-desk ${p.className ?? ''}`} style={p.style}>
      {p.children}
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}

/** A row of mutually exclusive choices (a radio group drawn as tabs). */
export function Segmented<T extends string>(p: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <div className={`kit-seg ${p.className ?? ''}`} role="radiogroup" aria-label={p.label}>
      {p.options.map((o) => {
        const on = o.value === p.value;
        return (
          <label key={o.value} className={`kit-seg__opt ${on ? 'is-on' : ''} ${o.disabled ? 'is-disabled' : ''}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={on}
              disabled={o.disabled}
              onChange={() => p.onChange(o.value)}
            />
            <span className="kit-seg__label">{o.label}</span>
            {o.hint ? <span className="kit-seg__hint">{o.hint}</span> : null}
          </label>
        );
      })}
    </div>
  );
}

/** An on/off switch with a label. */
export function Toggle(p: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <label className={`kit-toggle ${p.checked ? 'is-on' : ''} ${p.disabled ? 'is-disabled' : ''} ${p.className ?? ''}`}>
      <input type="checkbox" checked={p.checked} disabled={p.disabled} onChange={(e) => p.onChange(e.target.checked)} />
      <span className="kit-toggle__switch" aria-hidden />
      <span className="kit-toggle__text">{p.children}</span>
    </label>
  );
}

/** A rubber-stamp label ("COMING SOON", "CLASSIFIED"). */
export function Stamp(p: { children: ReactNode; tone?: 'red' | 'olive' | 'ink'; className?: string }) {
  return <span className={`kit-stamp kit-stamp--${p.tone ?? 'red'} ${p.className ?? ''}`}>{p.children}</span>;
}
