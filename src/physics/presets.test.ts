import { describe, expect, it } from 'vitest';
import { NBodySystem, totalEnergy, totalMomentum } from './nbody';
import { PRESETS, getPreset } from './presets';
import { distance } from './vector';

describe('PRESETS', () => {
  it.each(PRESETS.map((p) => [p.id]))('%s : trois soleils, une planète, centre de masse immobile', (id) => {
    const bodies = getPreset(id).create(7);
    expect(bodies.filter((b) => b.kind === 'sun')).toHaveLength(3);
    expect(bodies.filter((b) => b.kind === 'planet')).toHaveLength(1);
    const p = totalMomentum(bodies);
    expect(Math.hypot(p.x, p.y, p.z)).toBeLessThan(1e-12);
  });

  it('crée toujours un système chaotique lié, reproductible pour une même graine', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const suns = getPreset('chaotic')
        .create(seed)
        .filter((b) => b.kind === 'sun');
      expect(totalEnergy(suns)).toBeLessThan(0);
    }
    expect(getPreset('chaotic').create(3)).toEqual(getPreset('chaotic').create(3));
    expect(getPreset('chaotic').create(3)).not.toEqual(getPreset('chaotic').create(4));
  });

  it('garde le triangle de Lagrange équilatéral sur un court instant', () => {
    const bodies = getPreset('lagrange').create(0);
    new NBodySystem(bodies).advance(1);
    const [a, b, c] = bodies.filter((s) => s.kind === 'sun');
    for (const side of [distance(a.position, b.position), distance(b.position, c.position), distance(c.position, a.position)]) {
      expect(side).toBeCloseTo(1.6, 2);
    }
  });
});
