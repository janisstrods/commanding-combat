// A Map-backed localStorage for the node test environment (src/ui/storage.ts reads and writes through it).
import { afterEach } from 'vitest';

/** Install a fresh, empty localStorage; returns its contents. Remove it with `dropStorage` (or `useStubStorageCleanup`). */
export function stubStorage(): Map<string, string> {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
  return m;
}

export function dropStorage() {
  delete (globalThis as { localStorage?: unknown }).localStorage;
}

/** No localStorage after each test of the file this is called in. */
export function useStubStorageCleanup() {
  afterEach(dropStorage);
}
