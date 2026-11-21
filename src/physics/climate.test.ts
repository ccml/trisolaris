import { describe, expect, it } from 'vitest';
import { REFERENCE_DISTANCE, classifyEra, climateOf, equilibriumTemperature } from './climate';
import { sunLuminosity, sunRadius, type Body } from './nbody';
import { vec3 } from './vector';

function body(id: string, kind: Body['kind'], x: number, z = 0): Body {
  return {
    id,
    name: id,
    kind,
    mass: kind === 'sun' ? 1 : 1e-7,
    radius: kind === 'sun' ? sunRadius(1) : 0.02,
    luminosity: kind === 'sun' ? sunLuminosity(1) : 0,
    color: 0,
    position: vec3(x, 0, z),
    velocity: vec3(),
    alive: true,
  };
}

describe('climat', () => {
  it('donne 288 K à la distance de référence d’un soleil unique : ère stable', () => {
    const report = climateOf(body('p', 'planet', 0), [body('s', 'sun', REFERENCE_DISTANCE)]);
    expect(report.temperature).toBeCloseTo(288);
    expect(report.dominance).toBe(1);
    expect(report.era).toBe('stable');
  });

  it('parle d’ère chaotique quand deux soleils se partagent le ciel', () => {
    const d = REFERENCE_DISTANCE * Math.SQRT2; // flux total identique à la référence
    const report = climateOf(body('p', 'planet', 0), [body('a', 'sun', d), body('b', 'sun', -d)]);
    expect(report.temperature).toBeCloseTo(288);
    expect(report.contributions.map((c) => c.fraction)).toEqual([0.5, 0.5]);
    expect(report.era).toBe('chaotic');
  });

  it('ignore les soleils détruits', () => {
    const dead = body('b', 'sun', 0.01);
    dead.alive = false;
    const report = climateOf(body('p', 'planet', 0), [body('a', 'sun', REFERENCE_DISTANCE), dead]);
    expect(report.contributions).toHaveLength(1);
  });

  it('chaleur et froid extrêmes priment sur la dominance', () => {
    expect(classifyEra(400, 1)).toBe('scorching');
    expect(classifyEra(150, 1)).toBe('frozen');
    expect(equilibriumTemperature(0)).toBe(3);
    expect(climateOf(body('p', 'planet', 0), [body('s', 'sun', 3)]).era).toBe('frozen');
    expect(climateOf(body('p', 'planet', 0), [body('s', 'sun', 0.1)]).era).toBe('scorching');
  });
});
