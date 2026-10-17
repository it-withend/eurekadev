import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { load, save } from '../storage';

/**
 * Step-by-step guided tour, like the onboarding in games and new apps: the
 * page is dimmed and blurred except for one highlighted element, and a card
 * explains it. Targets are found by `data-tour="…"` attributes, so pages only
 * mark elements — they never know about the tour's internals.
 */
export interface TourStep {
  /** Value of a `data-tour` attribute; omit for a centred message. */
  target?: string;
  title: string;
  body: string;
}

const EVENT = 'pocketlab:tour';
const PAD = 8;

/** Opens the tour of the current page (used by the "Guide" button in the header). */
export function startTour(id?: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTarget(step: TourStep | undefined): HTMLElement | null {
  if (!step?.target) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
  // Hidden elements (display: none) have no box: treat as missing.
  return el && el.getClientRects().length ? el : null;
}

export function Tour({ id, steps, autoStart = true }: { id: string; steps: TourStep[]; autoStart?: boolean }) {
  const doneKey = `pocketlab.tour.${id}.done`;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const card = useRef<HTMLDivElement>(null);

  // Steps whose target is not on the page right now (e.g. results before a measurement) are skipped.
  const visible = open ? steps.filter((s) => !s.target || findTarget(s)) : steps;
  const step = visible[Math.min(index, visible.length - 1)];

  const close = useCallback(() => {
    setOpen(false);
    save(doneKey, true);
  }, [doneKey]);

  useEffect(() => {
    const onStart = (e: Event) => {
      const wanted = (e as CustomEvent<string | undefined>).detail;
      if (wanted && wanted !== id) return;
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(EVENT, onStart);
    let timer = 0;
    if (autoStart && !load(doneKey, false)) timer = window.setTimeout(() => setOpen(true), 600);
    return () => {
      window.removeEventListener(EVENT, onStart);
      window.clearTimeout(timer);
    };
  }, [id, doneKey, autoStart]);

  // Bring the target into view, then track its position while the tour is open.
  useLayoutEffect(() => {
    if (!open) return;
    const el = findTarget(step);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    let raf = 0;
    const track = () => {
      const r = el?.getBoundingClientRect();
      setRect((prev) => {
        if (!r) return null;
        if (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height) return prev;
        return { top: r.top, left: r.left, width: r.width, height: r.height };
      });
      raf = requestAnimationFrame(track);
    };
    track();
    card.current?.focus();
    return () => cancelAnimationFrame(raf);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, visible.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, visible.length]);

  if (!open || !step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const hole = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        right: Math.min(vw, rect.left + rect.width + PAD),
        bottom: Math.min(vh, rect.top + rect.height + PAD),
      }
    : null;

  // Card goes below the target if it fits, otherwise above; centred when there is no target.
  const cardStyle: React.CSSProperties = {};
  if (hole) {
    const below = vh - hole.bottom;
    if (below > 220 || below > hole.top) cardStyle.top = Math.min(hole.bottom + 12, vh - 200);
    else cardStyle.bottom = vh - hole.top + 12;
  }

  const last = index >= visible.length - 1;
  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {hole ? (
        <>
          <div className="tour-shade" style={{ top: 0, left: 0, right: 0, height: hole.top }} />
          <div className="tour-shade" style={{ top: hole.bottom, left: 0, right: 0, bottom: 0 }} />
          <div className="tour-shade" style={{ top: hole.top, left: 0, width: hole.left, height: hole.bottom - hole.top }} />
          <div className="tour-shade" style={{ top: hole.top, left: hole.right, right: 0, height: hole.bottom - hole.top }} />
          <div
            className="tour-ring"
            style={{ top: hole.top, left: hole.left, width: hole.right - hole.left, height: hole.bottom - hole.top }}
          />
        </>
      ) : (
        <div className="tour-shade" style={{ inset: 0 }} />
      )}
      <div ref={card} className={`tour-card${hole ? '' : ' centered'}`} style={cardStyle} tabIndex={-1}>
        <p className="tour-progress" aria-hidden="true">
          {visible.map((s, i) => (
            <span key={s.title} className={i === index ? 'on' : i < index ? 'seen' : ''} />
          ))}
        </p>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button className="link" onClick={close}>
            Skip tour
          </button>
          <span className="spacer" />
          {index > 0 && <button onClick={() => setIndex(index - 1)}>Back</button>}
          <button className="primary" onClick={() => (last ? close() : setIndex(index + 1))}>
            {last ? 'Got it!' : `Next · ${index + 1}/${visible.length}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
