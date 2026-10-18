// Every map loaded up front, for node: the scripts import this first and Vitest runs it before each test file
// (vite.config.ts setupFiles). The browser loads each map on demand instead (src/engine/data.ts ensureMap).
import { ensureMaps } from '../src/engine/data';

await ensureMaps();
