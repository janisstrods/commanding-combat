// Readable JSON for the generated src/data files: nested values that fit on one line stay on one line.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function pretty(value: unknown, indent = '', width = 118): string {
  const flat = JSON.stringify(value);
  if (flat === undefined) return 'null';
  if (value === null || typeof value !== 'object' || flat.length + indent.length <= width) return flat;
  const inner = indent + '  ';
  if (Array.isArray(value)) {
    return `[\n${value.map((v) => inner + pretty(v, inner, width)).join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${pretty(v, inner, width)}`).join(',\n')}\n${indent}}`;
}

export function readJson<T = any>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Writes `value` as readable JSON; returns true when the file content changed. */
export function writeJson(path: string, value: unknown, width = 118): boolean {
  mkdirSync(dirname(path), { recursive: true });
  const text = pretty(value, '', width) + '\n';
  let old: string | null = null;
  try {
    old = readFileSync(path, 'utf8');
  } catch {
    old = null;
  }
  if (old === text) return false;
  writeFileSync(path, text);
  return true;
}
