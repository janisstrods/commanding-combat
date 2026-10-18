// The Event / Sniper! / Random Hex moments on the battle screen (backlog §3): the controller hands every event it
// animates to `Drama.play`, which stages the moment's steps (randomiser.ts) through the controller's view: the banner,
// the randomiser on the map, the hits. Reading pauses can be ended early (`hurry`: a click, a tap or Space); Instant
// speed skips the moments; reduced motion gets the calm version. Only public events reach it, and every pause depends
// on them alone, so the timing tells nothing hidden (the opponent's reaction-window pause is the controller's own).
import type { GameEvent, GameState, Side } from '../../engine/types';
import { sfx } from '../sound';
import type { CardShow, ViewState } from './controller';
import { isRollPurpose, sideName } from './names';
import { deckHexes, dramaSteps, introMs, momentText, readMs, seedOf, spinPlan, type Banner, type DramaStep, type HexPick, type Impact, type Moment } from './randomiser';

/** What a moment needs of the controller. */
export interface DramaHost {
  view(): ViewState;
  set(patch: Partial<ViewState>): void;
  /** Wait `ms` scaled by the speed (0 when hurried). */
  wait(ms: number): Promise<void>;
  /** `ms` scaled by the speed (0 when hurried). */
  dur(ms: number): number;
  /** The rest of the animations is being skipped (hurried). */
  skipping(): boolean;
  showCard(c: Omit<CardShow, 'id'>, ms: number): void;
  human(): Side;
  nextId(): number;
}

/** The player asked for reduced motion: the calm version. */
export function prefersCalm(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Log lines the banner lists (not its own trigger, name and Random Hex, which it shows itself). */
export function bannerLine(e: GameEvent): boolean {
  if (e.kind === 'trigger' || e.kind === 'event') return false;
  return e.kind !== 'reveal' || isRollPurpose(e.purpose);
}

export class Drama {
  /** The Event or Sniper! being carried out. */
  private moment: Moment | null = null;
  /** Ends the reading pause now on. */
  private holdEnd: (() => void) | null = null;
  /** Randomiser runs so far (each hop path is seeded from its card and this count). */
  private spins = 0;
  private ticks: ReturnType<typeof setTimeout>[] = [];
  private disposed = false;

  constructor(private host: DramaHost) {}

  /** End the reading pause now on, if one is (true); the controller skips animations otherwise. */
  hurry(): boolean {
    if (!this.holdEnd) return false;
    this.holdEnd();
    return true;
  }

  /** Forget the moment (undo replays the game). */
  reset(): void {
    this.moment = null;
    this.stopTicks();
  }

  dispose(): void {
    this.disposed = true;
    this.stopTicks();
    this.holdEnd?.();
  }

  /** Stage event `e`'s part of a moment; `line`: its log line, if any. `after` / `before`: as the human sees them. */
  async play(e: GameEvent, line: string | null, after: GameState, before: GameState): Promise<void> {
    const r = dramaSteps(this.moment, e, after, before);
    this.moment = r.moment;
    const b = this.host.view().banner;
    if (line && b && bannerLine(e)) this.host.set({ banner: { ...b, lines: [...b.lines, line].slice(-6) } });
    for (const st of r.steps) await this.step(st, after);
  }

  /** A pause the player may end early. */
  private hold(ms: number): Promise<void> {
    if (this.host.skipping() || ms <= 0 || this.disposed) return Promise.resolve();
    return new Promise((resolve) => {
      const end = () => {
        clearTimeout(timer);
        if (this.holdEnd === end) this.holdEnd = null;
        resolve();
      };
      const timer = setTimeout(end, ms);
      this.holdEnd = end;
    });
  }

  private patchBanner(patch: Partial<Banner>) {
    const b = this.host.view().banner;
    if (b) this.host.set({ banner: { ...b, ...patch } });
  }

  private stopTicks() {
    for (const t of this.ticks) clearTimeout(t);
    this.ticks = [];
  }

  private async step(st: DramaStep, after: GameState): Promise<void> {
    const h = this.host;
    const speed = h.view().speed;
    if (speed === 'instant' || this.disposed) {
      if (st.kind === 'close') h.set({ banner: null, hexPick: null });
      return;
    }
    const calm = prefersCalm();
    switch (st.kind) {
      case 'open': {
        const { title, text } = momentText(st.moment);
        sfx.card();
        const banner: Banner = {
          id: h.nextId(), kind: st.moment.kind, side: st.moment.side, title, text, card: st.moment.card, hexCard: null, hex: null,
          note: null, lines: [], hold: true, done: false, calm,
        };
        h.set({ banner, hexPick: null });
        await this.hold(introMs(title, text, speed));
        this.patchBanner({ hold: false });
        return;
      }
      case 'spin': {
        const plan = h.skipping() ? null : spinPlan(st.target, deckHexes(after.players[st.side].nation), { speed, seed: seedOf(st.card, this.spins++), brief: st.brief, calm });
        if (!plan) return;
        if (h.view().banner) this.patchBanner({ hexCard: st.card, hex: null, note: null });
        else {
          const you = st.side === h.human() ? ' (you)' : '';
          h.showCard({ card: st.card, side: st.side, caption: `${sideName(after, st.side)}${you} — Random Hex`, highlight: null }, plan.landAt + plan.settle + 400);
        }
        const pick: HexPick = {
          id: h.nextId(), side: st.side, reason: st.reason, target: st.target, hops: plan.hops, landAt: plan.landAt, settle: plan.settle,
          landed: false, area: [], redirect: [], calm,
        };
        h.set({ hexPick: pick });
        this.stopTicks();
        plan.hops.forEach((x, i) => this.ticks.push(setTimeout(() => sfx.tick(1 + i / plan.hops.length), x.at)));
        await this.hold(plan.landAt);
        this.stopTicks();
        return;
      }
      case 'land': {
        const pick = h.view().hexPick;
        if (!pick || pick.target !== st.target) return;
        sfx.card();
        h.set({ hexPick: { ...pick, landed: true, area: st.landing.area, redirect: st.landing.redirect } });
        this.patchBanner({ hex: st.target, note: st.landing.note || null, hold: true });
        await this.hold(pick.settle);
        this.patchBanner({ hold: false });
        // a set-up placement has no banner: its mark goes now (the placement prompt lights the hexes itself)
        if (!this.moment && h.view().hexPick?.id === pick.id) h.set({ hexPick: null });
        return;
      }
      case 'impact': {
        const im: Impact = { id: h.nextId(), hex: st.hex, from: st.from, look: st.look };
        if (st.look === 'crosshair') sfx.shot();
        h.set({ impacts: [...h.view().impacts, im] });
        setTimeout(() => h.set({ impacts: h.view().impacts.filter((x) => x.id !== im.id) }), Math.max(700, h.dur(1400)));
        await h.wait(st.look === 'crosshair' ? 600 : 300);
        return;
      }
      case 'close': {
        const b = h.view().banner;
        if (b) {
          const lines = b.lines.length ? b.lines : ['Nothing happens.'];
          this.patchBanner({ lines, hold: true, done: true });
          await this.hold(readMs(lines.join(' ').length + (b.note?.length ?? 0), speed));
        }
        h.set({ banner: null, hexPick: null });
        return;
      }
    }
  }
}
