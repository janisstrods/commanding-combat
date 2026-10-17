/**
 * Published releases, newest first; the first is shown on the main menu. Each is named after a scenario or a place in
 * the game that suits what it brought (no fixed order, never reused). Bump for every publish, together with
 * package.json's version.
 */
export const RELEASES = [{ number: '0.1.0', name: 'Fat Lipki', notes: 'First playable build' }] as const;

export const RELEASE = RELEASES[0];

declare const __BUILD_TIME__: string;

/** When this bundle was built (ISO, UTC), or null in the dev server. */
export const BUILD_TIME: string | null = import.meta.env.DEV ? null : __BUILD_TIME__;

/** "build 2026-10-10 14:05 UTC", or "dev build". */
export function buildLabel(iso: string | null): string {
  return iso ? `build ${iso.slice(0, 16).replace('T', ' ')} UTC` : 'dev build';
}
