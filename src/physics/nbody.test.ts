import { describe, expect, it } from 'vitest';
import { NBodySystem, sunLuminosity, sunRadius, totalEnergy, totalMomentum, type Body } from './nbody';
import { getPreset } from './presets';
import { vec3, type Vec3 } from './vector';

function sun(id: string, mass: number, position: Vec3, velocity: Vec3): Body {
  return {
    id,
    name: id,
    kind: 'sun',
    mass,
    radius: sunRadius(mass),
    luminosity: sunLuminosity(mass),
    color: 0xffffff,
    position,
    velocity,
    alive: true,
  };
}

/** Les trois soleils de la figure en huit, sans la planète. */
function figureEightSuns(): Body[] {
  return getPreset('figureEight')
    .create(0)
    .filter((b) => b.kind === 'sun');
}

describe('NBodySystem', () => {
  it("conserve l'énergie sur une période de la figure en huit", () => {
    const bodies = figureEightSuns();
    const e0 = totalEnergy(bodies);
    new NBodySystem(bodies).advance(6.3259);
    expect(Math.abs((totalEnergy(bodies) - e0) / e0)).toBeLessThan(1e-4);
  });

  it('revient à son point de départ après une période de la figure en huit', () => {
    const bodies = figureEightSuns();
    const start = bodies.map((b) => ({ ...b.position }));
    new NBodySystem(bodies).advance(6.3259);
    bodies.forEach((b, i) => {
      expect(Math.hypot(b.position.x - start[i].x, b.position.z - start[i].z)).toBeLessThan(0.05);
    });
  });

  it('conserve la quantité de mouvement', () => {
    const bodies = getPreset('chaotic').create(42);
    new NBodySystem(bodies).advance(3);
    const p = totalMomentum(bodies);
    expect(Math.hypot(p.x, p.y, p.z)).toBeLessThan(1e-9);
  });

  it('fusionne deux soleils qui se percutent en conservant masse et quantité de mouvement', () => {
    const a = sun('a', 1, vec3(-0.3, 0, 0), vec3(1, 0, 0));
    const b = sun('b', 0.5, vec3(0.3, 0, 0), vec3(-1, 0, 0));
    const events = new NBodySystem([a, b]).advance(1);
    expect(events).toContainEqual({ type: 'merge', survivor: a, absorbed: b });
    expect(b.alive).toBe(false);
    expect(a.mass).toBeCloseTo(1.5);
    expect(a.radius).toBeCloseTo(sunRadius(1.5));
    expect(a.velocity.x * a.mass).toBeCloseTo(0.5, 6);
  });

  it('signale une seule fois un corps éjecté', () => {
    const a = sun('a', 1, vec3(), vec3());
    const b = sun('b', 0.1, vec3(20, 0, 0), vec3(5, 0, 0));
    const system = new NBodySystem([a, b]);
    expect(system.advance(0.1)).toContainEqual({ type: 'escape', body: b });
    expect(system.advance(0.1)).toEqual([]);
  });
});
