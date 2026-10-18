// Zoom and pan gestures for the board: mouse wheel and trackpad pinch (ctrl+wheel; Safari's gesture events) zoom around
// the pointer, a drag pans (one finger on touch), two fingers pinch and pan. The view lives in a ref and goes straight
// to the SVG's viewBox, so a gesture re-renders nothing; React state (`settled`) changes only once a gesture has ended,
// for the counter layout and the zoom buttons. A drag never counts as a click. The view is kept in localStorage.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { storage } from '../storage';
import { clampView, fitScale, fitView, lerpView, maxZoom, panBy, parseView, pinchView, sameView, scaleStep, serializeView, viewBoxOf, wheelFactor, zoomAt, type Rect, type Size, type View } from './zoom';

export interface Settled {
  /** Zoom factor (1 = fitted). */
  k: number;
  /** The largest zoom factor for this viewport. */
  max: number;
  /** Screen px per hex unit, rounded to a quarter octave (for the counter layout). */
  px: number;
}

export interface BoardZoom {
  containerRef: RefObject<HTMLDivElement>;
  svgRef: RefObject<SVGSVGElement>;
  settled: Settled;
  /** The viewBox attribute for the current view. */
  viewBoxAttr: () => string;
  /** Zoom by `factor` around the middle of the viewport (animated). */
  zoomBy: (factor: number) => void;
  /** Back to the whole board (animated). */
  fit: () => void;
}

/** Pointer travel (px) before a press becomes a drag. */
const DRAG_MOUSE = 4;
const DRAG_TOUCH = 9;
const SETTLE_MS = 140;
const ANIM_MS = 220;

const STORAGE_PREFIX = 'cce-zoom-';

function fmt(v: number) {
  return String(Math.round(v * 10000) / 10000);
}

export function useBoardZoom(world: Rect, opts: { storageKey?: string; keys?: boolean; onGestureStart?: () => void }): BoardZoom {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const key = opts.storageKey ? STORAGE_PREFIX + opts.storageKey : null;
  const view = useRef<View>(parseView(key ? storage.get(key) : null) ?? fitView(world));
  const size = useRef<Size | null>(null);
  const [settled, setSettled] = useState<Settled>({ k: view.current.k, max: 3, px: 0 });
  const settleTimer = useRef(0);
  const anim = useRef(0);
  const worldRef = useRef(world);
  worldRef.current = world;
  const gestureCb = useRef(opts.onGestureStart);
  gestureCb.current = opts.onGestureStart;

  const viewBoxAttr = useCallback(() => {
    const w = worldRef.current;
    if (!size.current) return `${fmt(w.x)} ${fmt(w.y)} ${fmt(w.w)} ${fmt(w.h)}`;
    const b = viewBoxOf(view.current, size.current, w);
    return `${fmt(b.x)} ${fmt(b.y)} ${fmt(b.w)} ${fmt(b.h)}`;
  }, []);

  const apply = useCallback(() => {
    svgRef.current?.setAttribute('viewBox', viewBoxAttr());
  }, [viewBoxAttr]);

  /** After a gesture: publish the zoom for the layout and the buttons, and remember the view. */
  const settle = useCallback(
    (now = false) => {
      window.clearTimeout(settleTimer.current);
      const run = () => {
        const vp = size.current;
        if (!vp) return;
        const v = view.current;
        const next: Settled = { k: v.k, max: maxZoom(vp, worldRef.current), px: scaleStep(fitScale(vp, worldRef.current) * v.k) };
        setSettled((s) => (Math.abs(s.k - next.k) < 1e-4 && s.max === next.max && s.px === next.px ? s : next));
        if (key) storage.set(key, serializeView(v));
      };
      if (now) run();
      else settleTimer.current = window.setTimeout(run, SETTLE_MS);
    },
    [key],
  );

  const setView = useCallback(
    (v: View) => {
      if (sameView(v, view.current)) return;
      view.current = v;
      apply();
    },
    [apply],
  );

  const stopAnim = () => {
    cancelAnimationFrame(anim.current);
    anim.current = 0;
  };

  const animateTo = useCallback(
    (target: View) => {
      stopAnim();
      const from = view.current;
      if (sameView(from, target)) return;
      const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        setView(target);
        settle(true);
        return;
      }
      const t0 = performance.now();
      const step = (t: number) => {
        const u = Math.min(1, (t - t0) / ANIM_MS);
        const e = 1 - Math.pow(1 - u, 3);
        setView(u >= 1 ? target : lerpView(from, target, e));
        if (u < 1) anim.current = requestAnimationFrame(step);
        else {
          anim.current = 0;
          settle(true);
        }
      };
      anim.current = requestAnimationFrame(step);
    },
    [setView, settle],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const vp = size.current;
      if (!vp) return;
      animateTo(zoomAt(view.current, vp, worldRef.current, factor, vp.w / 2, vp.h / 2));
    },
    [animateTo],
  );

  const fit = useCallback(() => {
    const vp = size.current;
    if (!vp) return;
    animateTo(clampView(fitView(worldRef.current), vp, worldRef.current));
  }, [animateTo]);

  // the viewport's size: measured, and kept up to date
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      size.current = { w: r.width, h: r.height };
      view.current = clampView(view.current, size.current, worldRef.current);
      apply();
      settle(true);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [apply, settle]);

  // gestures
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onWheel = (e: WheelEvent) => {
      const vp = size.current;
      if (!vp) return;
      e.preventDefault();
      stopAnim();
      const p = local(e);
      setView(zoomAt(view.current, vp, worldRef.current, wheelFactor(e.deltaY, e.deltaMode, e.ctrlKey, vp.h), p.x, p.y));
      settle();
    };

    // Safari's trackpad pinch (it sends no ctrl+wheel)
    let gesture: { view: View; x: number; y: number } | null = null;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      stopAnim();
      const p = local(e as unknown as MouseEvent);
      gesture = { view: view.current, x: p.x, y: p.y };
    };
    const onGestureChange = (e: Event) => {
      const vp = size.current;
      if (!gesture || !vp) return;
      e.preventDefault();
      const scale = (e as unknown as { scale: number }).scale;
      if (!(scale > 0)) return;
      setView(zoomAt(gesture.view, vp, worldRef.current, scale, gesture.x, gesture.y));
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      gesture = null;
      settle();
    };

    // pointers: one drags, two pinch
    const pts = new Map<number, { x: number; y: number }>();
    let drag: { id: number; x: number; y: number; view: View; moved: boolean; touch: boolean } | null = null;
    let pinch: { view: View; a: number; b: number; a0: { x: number; y: number }; b0: { x: number; y: number } } | null = null;
    // a drag or pinch ends with a click on whatever is under the finger: swallow clicks until shortly after it
    let swallowUntil = 0;
    let gestured = false;

    const startDrag = (id: number, view0: View, moved: boolean, touch: boolean) => {
      const p = pts.get(id)!;
      drag = { id, x: p.x, y: p.y, view: view0, moved, touch };
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as Element | null)?.closest?.('.board-zoom__controls')) return;
      stopAnim();
      swallowUntil = 0;
      if (!pts.size) gestured = false;
      pts.set(e.pointerId, local(e));
      if (pts.size === 1) {
        startDrag(e.pointerId, view.current, false, e.pointerType !== 'mouse');
      } else if (pts.size === 2) {
        const [a, b] = [...pts.keys()];
        pinch = { view: view.current, a, b, a0: pts.get(a)!, b0: pts.get(b)! };
        drag = null;
        gestured = true;
        for (const id of [a, b]) {
          try {
            el.setPointerCapture(id);
          } catch {
            /* already released */
          }
        }
        el.classList.add('is-panning');
        gestureCb.current?.();
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const vp = size.current;
      pts.set(e.pointerId, local(e));
      if (!vp) return;
      if (pinch) {
        const a1 = pts.get(pinch.a);
        const b1 = pts.get(pinch.b);
        if (a1 && b1) setView(pinchView(pinch.view, vp, worldRef.current, pinch.a0, pinch.b0, a1, b1));
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      const p = pts.get(e.pointerId)!;
      const dx = p.x - drag.x;
      const dy = p.y - drag.y;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < (drag.touch ? DRAG_TOUCH : DRAG_MOUSE)) return;
        drag.moved = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        el.classList.add('is-panning');
        gestureCb.current?.();
      }
      setView(panBy(drag.view, vp, worldRef.current, dx, dy));
    };
    const onUp = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (drag?.moved || pinch) gestured = true;
      if (pinch) {
        pinch = null;
        // one finger still down: it goes on panning from here
        const rest = [...pts.keys()][0];
        if (rest !== undefined) startDrag(rest, view.current, true, true);
      } else if (drag?.id === e.pointerId) drag = null;
      if (!pts.size) {
        drag = null;
        el.classList.remove('is-panning');
        settle();
        if (gestured) swallowUntil = performance.now() + 500;
      }
    };
    const onClickCapture = (e: MouseEvent) => {
      if (performance.now() > swallowUntil) return;
      swallowUntil = 0;
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    el.addEventListener('gestureend', onGestureEnd);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('click', onClickCapture, true);
      window.clearTimeout(settleTimer.current);
      stopAnim();
    };
  }, [setView, settle]);

  // keyboard: + and - zoom, 0 fits (not while typing or while a dialog is open)
  useEffect(() => {
    if (!opts.keys) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
      if (document.querySelector('.kit-modal')) return;
      if (e.key === '+' || e.key === '=') zoomBy(1.5);
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.5);
      else if (e.key === '0') fit();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts.keys, zoomBy, fit]);

  return { containerRef, svgRef, settled, viewBoxAttr, zoomBy, fit };
}
