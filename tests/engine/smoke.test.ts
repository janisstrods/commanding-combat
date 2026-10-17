import { describe, expect, it } from 'vitest';
import { RELEASE, buildLabel } from '../../src/version';

describe('scaffold', () => {
  it('has a release and a build label', () => {
    expect(RELEASE.number).toMatch(/^\d+\.\d+\.\d+$/);
    expect(buildLabel(null)).toBe('dev build');
  });
});
