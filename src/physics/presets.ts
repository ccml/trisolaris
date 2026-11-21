import { REFERENCE_DISTANCE } from './climate';
import { G, sunLuminosity, sunRadius, totalEnergy, type Body } from './nbody';
import { createRandom } from './random';
import { vec3, type Vec3 } from './vector';

/** Couleurs des trois soleils, du plus chaud au plus froid (associées par masse décroissante). */
const SUN_COLORS = [0xbfd4ff, 0xfff1c9, 0xffa25a];
const SUN_NAMES = ['Alpha', 'Bêta', 'Gamma'];
const PLANET_MASS = 1e-7; // particule test : n'influence pas les soleils
export const PLANET_RADIUS = 0.022;

export type PresetId = 'chaotic' | 'figureEight' | 'lagrange' | 'hierarchical';

export interface PresetDefinition {
  id: PresetId;
  name: string;
  description: string;
  create: (seed: number) => Body[];
}

interface SunSpec {
  mass: number;
  position: Vec3;
  velocity: Vec3;
}

function makeSuns(specs: SunSpec[]): Body[] {
  // Couleur selon le rang de masse : le plus massif est le plus bleu.
  const ranks = specs.map((s, i) => ({ i, mass: s.mass })).sort((a, b) => b.mass - a.mass);
  return specs.map((spec, i) => {
    const rank = ranks.findIndex((r) => r.i === i);
    return {
      id: `sun${i}`,
      name: SUN_NAMES[i],
      kind: 'sun',
      mass: spec.mass,
      radius: sunRadius(spec.mass),
      luminosity: sunLuminosity(spec.mass),
      color: SUN_COLORS[rank],
      position: { ...spec.position },
      velocity: { ...spec.velocity },
      alive: true,
    };
  });
}

/** Planète en orbite circulaire autour de `host`, dans un plan incliné de `tilt` radians. */
function makePlanet(host: Body, orbitRadius: number, tilt: number): Body {
  const speed = Math.sqrt((G * host.mass) / orbitRadius);
  return {
    id: 'planet',
    name: 'Trisolaris',
    kind: 'planet',
    mass: PLANET_MASS,
    radius: PLANET_RADIUS,
    luminosity: 0,
    color: 0x4d8fd6,
    position: vec3(host.position.x + orbitRadius, host.position.y, host.position.z),
    velocity: vec3(host.velocity.x, host.velocity.y + speed * Math.sin(tilt), host.velocity.z + speed * Math.cos(tilt)),
    alive: true,
  };
}

/** Place le centre de masse à l'origine, immobile : le système ne dérive pas hors de la vue. */
export function recenter(bodies: Body[]): Body[] {
  let mass = 0;
  const p = vec3();
  const v = vec3();
  for (const b of bodies) {
    mass += b.mass;
    for (const axis of ['x', 'y', 'z'] as const) {
      p[axis] += b.mass * b.position[axis];
      v[axis] += b.mass * b.velocity[axis];
    }
  }
  for (const b of bodies) {
    for (const axis of ['x', 'y', 'z'] as const) {
      b.position[axis] -= p[axis] / mass;
      b.velocity[axis] -= v[axis] / mass;
    }
  }
  return bodies;
}

/** Distance où le soleil `host` seul donne à la planète une température terrestre. */
export function habitableDistance(host: Body): number {
  return REFERENCE_DISTANCE * Math.sqrt(host.luminosity);
}

/** Trois soleils de masses voisines, positions et vitesses tirées au hasard : le vrai problème à trois corps. */
function createChaotic(seed: number): Body[] {
  const random = createRandom(seed);
  const range = (min: number, max: number) => min + (max - min) * random();
  const specs: SunSpec[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + range(-0.5, 0.5);
    const r = range(0.9, 1.4);
    specs.push({
      mass: range(0.8, 1.2),
      position: vec3(r * Math.cos(angle), range(-0.25, 0.25), r * Math.sin(angle)),
      // Vitesse à peu près tangentielle pour un départ tournoyant plutôt qu'un effondrement immédiat.
      velocity: vec3(
        -Math.sin(angle) * range(0.2, 0.45) + range(-0.1, 0.1),
        range(-0.08, 0.08),
        Math.cos(angle) * range(0.2, 0.45) + range(-0.1, 0.1),
      ),
    });
  }
  const suns = recenter(makeSuns(specs));
  // Le système doit rester lié (énergie négative), sinon les soleils se dispersent aussitôt.
  while (totalEnergy(suns) > -0.2) {
    for (const s of suns) {
      s.velocity.x *= 0.85;
      s.velocity.y *= 0.85;
      s.velocity.z *= 0.85;
    }
  }
  const host = suns[Math.floor(random() * 3)];
  return recenter([...suns, makePlanet(host, habitableDistance(host), range(-0.3, 0.3))]);
}

/** Solution périodique en huit de Chenciner et Montgomery (2000) : trois masses égales sur une même courbe. */
function createFigureEight(): Body[] {
  const p = vec3(0.97000436, 0, -0.24308753);
  const v = vec3(-0.93240737, 0, -0.86473146);
  const suns = makeSuns([
    { mass: 1, position: p, velocity: vec3(-v.x / 2, 0, -v.z / 2) },
    { mass: 1, position: vec3(-p.x, 0, -p.z), velocity: vec3(-v.x / 2, 0, -v.z / 2) },
    { mass: 1, position: vec3(), velocity: v },
  ]);
  return recenter([...suns, makePlanet(suns[0], habitableDistance(suns[0]), 0.15)]);
}

/** Triangle équilatéral en rotation rigide (solution de Lagrange) : équilibre instable. */
function createLagrange(): Body[] {
  const side = 1.6;
  const r = side / Math.sqrt(3);
  const omega = Math.sqrt((G * 3) / side ** 3);
  const specs: SunSpec[] = [0, 1, 2].map((i) => {
    const angle = (i / 3) * Math.PI * 2;
    return {
      mass: 1,
      position: vec3(r * Math.cos(angle), 0, r * Math.sin(angle)),
      velocity: vec3(-omega * r * Math.sin(angle), 0, omega * r * Math.cos(angle)),
    };
  });
  const suns = makeSuns(specs);
  return recenter([...suns, makePlanet(suns[0], habitableDistance(suns[0]), 0.1)]);
}

/** Système hiérarchique : un couple serré de soleils et un troisième, lointain, autour duquel tourne la planète. */
function createHierarchical(): Body[] {
  const binarySeparation = 0.4;
  const binaryMass = 1;
  const vBinary = Math.sqrt((G * binaryMass) / (2 * binarySeparation));
  const farMass = 0.9;
  const farDistance = 3.2;
  const totalMass = 2 * binaryMass + farMass;
  const vRel = Math.sqrt((G * totalMass) / farDistance);
  const binaryDrift = (-farMass / totalMass) * vRel;
  const farSpeed = ((2 * binaryMass) / totalMass) * vRel;
  const suns = makeSuns([
    { mass: binaryMass, position: vec3(binarySeparation / 2, 0, 0), velocity: vec3(0, 0, vBinary + binaryDrift) },
    { mass: binaryMass, position: vec3(-binarySeparation / 2, 0, 0), velocity: vec3(0, 0, -vBinary + binaryDrift) },
    { mass: farMass, position: vec3(-farDistance, 0.15, 0), velocity: vec3(0, 0, -farSpeed) },
  ]);
  return recenter([...suns, makePlanet(suns[2], habitableDistance(suns[2]), 0.2)]);
}

export const PRESETS: PresetDefinition[] = [
  {
    id: 'chaotic',
    name: 'Trisolaris (chaotique)',
    description: 'Trois soleils aux trajectoires imprévisibles',
    create: createChaotic,
  },
  {
    id: 'figureEight',
    name: 'Figure en huit',
    description: 'Orbite périodique de Chenciner-Montgomery',
    create: createFigureEight,
  },
  {
    id: 'lagrange',
    name: 'Triangle de Lagrange',
    description: 'Rotation rigide, équilibre instable',
    create: createLagrange,
  },
  {
    id: 'hierarchical',
    name: 'Hiérarchique',
    description: 'Un couple serré et un soleil lointain',
    create: createHierarchical,
  },
];

export function getPreset(id: PresetId): PresetDefinition {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Configuration inconnue : ${id}`);
  return preset;
}
