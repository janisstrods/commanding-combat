// Current unit and Weapon values (§3.3, §13, §O20.4, §F106), Cover (§T78.3, §T93, R-17, R-20), stacking (§8.2).
import { describe, expect, it } from 'vitest';
import { cover, currentStats, figures, hexCover, stackLimit, weaponStats } from '../../src/engine/stats';
import { H, build } from '../support/build';

describe('Leader Command (§3.3.1)', () => {
  const s = build({
    pieces: [
      { type: 'German/Lt Von Karsties', hex: 'E5' }, // p0, Command 2
      { type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }, // p1, p2
      { type: 'German/Line Team', hex: 'E5', weapon: 'German/Light Mortar' }, // p3, p4
      { type: 'German/Cpl Winkler', hex: 'E5', weapon: 'German/HMG' }, // p5, p6
      { type: 'German/Rifle Squad', hex: 'F5' }, // p7: another hex
    ],
  });

  it('raises every stat (FP, Range, Movement, Morale) of the Squads and Teams sharing its hex; several Leaders add up', () => {
    // Rifle Squad 5-5-4, Morale 7; LMG has no Movement modifier; Lt 2 + Cpl 1
    expect(currentStats(s, 'p1')).toEqual({ fp: 8, range: 8, move: 7, morale: 10, command: 0 });
    // Line Team 3-3-4, Morale 7, carrying a Light Mortar (Movement −2)
    expect(currentStats(s, 'p3')).toEqual({ fp: 6, range: 6, move: 5, morale: 10, command: 0 });
    expect(currentStats(s, 'p7')).toEqual({ fp: 5, range: 5, move: 4, morale: 7, command: 0 });
  });

  it('never to Leaders', () => {
    expect(currentStats(s, 'p0')).toEqual({ fp: 2, range: 1, move: 6, morale: 9, command: 2 });
    expect(currentStats(s, 'p5')).toMatchObject({ fp: 1, range: 1, move: 5, morale: 6, command: 1 }); // HMG −1 Movement
  });

  it('adds to non-Ordnance Weapons carried by Squads and Teams, not to Ordnance or a Leader\'s Weapon', () => {
    expect(weaponStats(s, 'p2')).toEqual({ fp: 7, range: 11, minRange: 0 }); // LMG 4-8
    expect(weaponStats(s, 'p4')).toEqual({ fp: 6, range: 13, minRange: 2 }); // Light Mortar 6, 2-13: Ordnance
    expect(weaponStats(s, 'p6')).toEqual({ fp: 8, range: 16, minRange: 0 }); // HMG carried by a Leader
  });

  it('a broken Leader has Command 0 (no bonus); the bonus is positional', () => {
    const t = build({
      pieces: [
        { type: 'German/Lt Von Karsties', hex: 'E5', broken: true },
        { type: 'German/Rifle Squad', hex: 'E5' },
      ],
    });
    expect(currentStats(t, 'p0').command).toBe(0);
    expect(currentStats(t, 'p1')).toMatchObject({ fp: 5, morale: 7 });
    t.pieces.p0.broken = false;
    expect(currentStats(t, 'p1')).toMatchObject({ fp: 7, morale: 9 });
    t.pieces.p1.hex = H('E6');
    expect(currentStats(t, 'p1')).toMatchObject({ fp: 5, morale: 7 });
  });

  it('Veteran +1 and Suppressed −1 to FP, Range, Movement and Morale; Wire −1 FP, Range and Morale', () => {
    const t = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5', veteran: true },
        { type: 'German/Rifle Squad', hex: 'E6', suppressed: true },
        { type: 'German/Rifle Squad', hex: 'E7' },
      ],
      fort: { E7: 'wire' },
    });
    expect(currentStats(t, 'p0')).toMatchObject({ fp: 6, range: 6, move: 5, morale: 8 });
    expect(currentStats(t, 'p1')).toMatchObject({ fp: 4, range: 4, move: 3, morale: 6 });
    expect(currentStats(t, 'p2')).toMatchObject({ fp: 4, range: 4, move: 4, morale: 6 });
  });

  it('a broken unit uses its broken side', () => {
    const t = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5', broken: true }] });
    expect(currentStats(t, 'p0')).toMatchObject({ fp: 2, range: 1, move: 1, morale: 7 });
  });
});

describe('Cover (§T78.3)', () => {
  const map = {
    terrain: { C3: 'Building', C4: 'Woods', F5: 'Open', H5: 'Stream' } as const,
    pathHexes: { Road: ['C3', 'F5'] },
    hexsides: [['F5', 'F4', 'Wall'], ['C4', 'C5', 'Hedge']] as [string, string, 'Wall' | 'Hedge'][],
  };
  const unitAt = (hex: string, fort?: 'foxholes' | 'trench' | 'pillbox' | 'bunker' | 'wire') =>
    build({ map, pieces: [{ type: 'German/Rifle Squad', hex }], fort: fort ? { [hex]: fort } : {} });

  it('is the terrain\'s, −1 in a road hex', () => {
    expect(cover(unitAt('C4'), 'p0')).toBe(2);
    expect(cover(unitAt('C3'), 'p0')).toBe(2); // Building 3, Road −1
    expect(cover(unitAt('F5'), 'p0')).toBe(-1); // Open + Road
    expect(cover(unitAt('H5'), 'p0')).toBe(-1); // Stream
  });

  it('takes the single best of terrain and Fortification (never added), Road −1 applies to both', () => {
    expect(cover(unitAt('F5', 'foxholes'), 'p0')).toBe(2); // Foxholes 3 in Open + Road
    expect(cover(unitAt('C4', 'foxholes'), 'p0')).toBe(3);
    expect(cover(unitAt('C4', 'bunker'), 'p0')).toBe(6);
    expect(cover(unitAt('C4', 'wire'), 'p0')).toBe(2);
  });

  it('Fortifications give +1 against Mortars and Artillery', () => {
    expect(cover(unitAt('C4', 'trench'), 'p0', { mortarOrArtillery: true })).toBe(5);
    expect(cover(unitAt('C4', 'pillbox'), 'p0', { mortarOrArtillery: true })).toBe(6);
  });

  it('Wall Cover only against a shot that crosses the wall into the hex, and not against Mortars', () => {
    const s = unitAt('F5');
    expect(cover(s, 'p0', { firers: [H('F2')] })).toBe(1); // Wall 2, Road −1
    expect(cover(s, 'p0', { firers: [H('F8')] })).toBe(-1);
    expect(cover(s, 'p0', { firers: [H('F2')], mortarOrArtillery: true })).toBe(-1);
    expect(cover(s, 'p0', { firers: [H('F2'), H('F8')] })).toBe(-1); // a Fire Group: every firer's LOS must cross it
    expect(cover(s, 'p0')).toBe(-1);
  });

  it('Hedge Cover 1, but the best single Cover wins', () => {
    const s = unitAt('C4');
    expect(cover(s, 'p0', { firers: [H('C7')] })).toBe(2); // Woods 2 beats Hedge 1
  });

  it('Flamethrower / Mines: Cover 0', () => {
    expect(cover(unitAt('C3', 'bunker'), 'p0', { ignoresCover: true })).toBe(0);
  });

  it('hexCover ignores hexsides', () => {
    expect(hexCover(unitAt('F5', 'foxholes'), H('F5'))).toBe(2);
  });
});

describe('stacking (§8.2)', () => {
  it('counts figures: Squad 4, Team 2, Leader 1; limit 7 unless the scenario lowers it', () => {
    const s = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5' },
        { type: 'German/Line Team', hex: 'E5' },
        { type: 'German/Lt Von Karsties', hex: 'E5' },
        { type: 'American/Line Squad', hex: 'E5' },
      ],
      special: { stackingLimits: { [H('C3')]: 4 } },
    });
    expect(figures(s, H('E5'), 'axis')).toBe(7);
    expect(figures(s, H('E5'), 'allied')).toBe(4);
    expect(stackLimit(s, H('E5'))).toBe(7);
    expect(stackLimit(s, H('C3'))).toBe(4);
  });
});
