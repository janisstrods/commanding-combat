/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { TestSequencer, Vitest, WorkspaceSpec } from 'vitest/node';

/**
 * Vitest's own file order, except that `*.slow.test.ts` files start first: each holds one long AI test that would
 * lengthen the whole run if it started late. (vitest/node loads lazily, so vite dev and build never load vitest.)
 */
class SlowFilesFirst implements TestSequencer {
  constructor(private readonly ctx: Vitest) {}
  private async base() {
    const { BaseSequencer } = await import('vitest/node');
    return new BaseSequencer(this.ctx);
  }
  async shard(files: WorkspaceSpec[]) {
    return (await this.base()).shard(files);
  }
  async sort(files: WorkspaceSpec[]) {
    const sorted = await (await this.base()).sort(files);
    const slow = (f: WorkspaceSpec) => f.moduleId.endsWith('.slow.test.ts');
    return [...sorted.filter(slow), ...sorted.filter((f) => !slow(f))];
  }
}

/** Each map's data and terrain mask in one chunk ("map-5w-<hash>.js"), fetched when the map is first needed. */
function mapChunk(id: string): string | undefined {
  const m = /\/src\/data\/(?:maps|masks)\/([^/]+)\.json$/.exec(id);
  return m ? `map-${m[1]}` : undefined;
}

export default defineConfig({
  // relative asset paths: the site is served from a sub-path on GitHub Pages (routes are hash-based)
  base: './',
  // GitHub Pages serves main:/docs, so the build is committed there
  build: { outDir: 'docs', emptyOutDir: true, rollupOptions: { output: { manualChunks: mapChunk } } },
  plugins: [react()],
  // build stamp shown on the main menu next to the release (src/version.ts)
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  worker: { format: 'es', rollupOptions: { output: { manualChunks: mapChunk } } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // every map loaded before each test file (the browser loads them on demand)
    setupFiles: ['scripts/all-maps.ts'],
    testTimeout: 120000,
    sequence: { sequencer: SlowFilesFirst },
  },
});
