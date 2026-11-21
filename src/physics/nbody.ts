import { distance, length, vec3, type Vec3 } from './vector';

/**
 * Simulation gravitationnelle à N corps, en unités réduites : G = 1, masse d'un soleil ≈ 1,
 * distances ≈ 1. Le rendu applique ensuite sa propre échelle.
 */
export const G = 1;
/** Adoucissement : évite les accélérations infinies lors des rencontres très proches. */
export const SOFTENING = 0.01;
const SOFTENING2 = SOFTENING * SOFTENING;
/** Pas de temps borné : assez fin pour les orbites serrées, assez grand pour rester rapide. */
export const MIN_TIME_STEP = 1e-6;
export const MAX_TIME_STEP = 0.01;
/** Au-delà de cette distance du centre de masse, un corps non lié est déclaré éjecté. */
export const ESCAPE_DISTANCE = 15;

export type BodyKind = 'sun' | 'planet';

export interface Body {
  id: string;
  name: string;
  kind: BodyKind;
  mass: number;
  /** Rayon physique (collisions) et visuel. */
  radius: number;
  /** Luminosité relative (1 = soleil de masse 1). Nulle pour une planète. */
  luminosity: number;
  color: number;
  position: Vec3;
  velocity: Vec3;
  alive: boolean;
}

export type SystemEvent =
  | { type: 'merge'; survivor: Body; absorbed: Body }
  | { type: 'escape'; body: Body };

/** Relation masse-rayon simplifiée (en unités de simulation). */
export function sunRadius(mass: number): number {
  return 0.035 * Math.pow(mass, 0.8);
}

/** Relation masse-luminosité des étoiles de la séquence principale : L ∝ M^3,5. */
export function sunLuminosity(mass: number): number {
  return Math.pow(mass, 3.5);
}

function aliveBodies(bodies: Body[]): Body[] {
  return bodies.filter((b) => b.alive);
}

/** Accélérations gravitationnelles (adoucies) de chaque corps ; les corps détruits restent à zéro. */
export function computeAccelerations(bodies: Body[], out: Vec3[]): void {
  for (const a of out) {
    a.x = 0;
    a.y = 0;
    a.z = 0;
  }
  for (let i = 0; i < bodies.length; i++) {
    const bi = bodies[i];
    if (!bi.alive) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      const bj = bodies[j];
      if (!bj.alive) continue;
      const dx = bj.position.x - bi.position.x;
      const dy = bj.position.y - bi.position.y;
      const dz = bj.position.z - bi.position.z;
      const r2 = dx * dx + dy * dy + dz * dz + SOFTENING2;
      const inv = G / (r2 * Math.sqrt(r2));
      out[i].x += bj.mass * dx * inv;
      out[i].y += bj.mass * dy * inv;
      out[i].z += bj.mass * dz * inv;
      out[j].x -= bi.mass * dx * inv;
      out[j].y -= bi.mass * dy * inv;
      out[j].z -= bi.mass * dz * inv;
    }
  }
}

/** Énergie totale (cinétique + potentiel adouci, cohérent avec les accélérations). */
export function totalEnergy(bodies: Body[]): number {
  const alive = aliveBodies(bodies);
  let energy = 0;
  for (const b of alive) energy += 0.5 * b.mass * (b.velocity.x ** 2 + b.velocity.y ** 2 + b.velocity.z ** 2);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const r = distance(alive[i].position, alive[j].position);
      energy -= (G * alive[i].mass * alive[j].mass) / Math.sqrt(r * r + SOFTENING2);
    }
  }
  return energy;
}

export function totalMomentum(bodies: Body[]): Vec3 {
  const p = vec3();
  for (const b of aliveBodies(bodies)) {
    p.x += b.mass * b.velocity.x;
    p.y += b.mass * b.velocity.y;
    p.z += b.mass * b.velocity.z;
  }
  return p;
}

export function centerOfMass(bodies: Body[]): Vec3 {
  const c = vec3();
  let mass = 0;
  for (const b of aliveBodies(bodies)) {
    c.x += b.mass * b.position.x;
    c.y += b.mass * b.position.y;
    c.z += b.mass * b.position.z;
    mass += b.mass;
  }
  if (mass > 0) {
    c.x /= mass;
    c.y /= mass;
    c.z /= mass;
  }
  return c;
}

/**
 * Pas de temps adaptatif : une fraction `eta` du plus court temps caractéristique entre deux corps
 * (temps de chute libre et temps de croisement). Les rencontres proches sont ainsi intégrées finement.
 */
export function adaptiveTimeStep(bodies: Body[], eta: number): number {
  let dt = MAX_TIME_STEP;
  for (let i = 0; i < bodies.length; i++) {
    const bi = bodies[i];
    if (!bi.alive) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      const bj = bodies[j];
      if (!bj.alive) continue;
      const r = Math.sqrt(distance(bi.position, bj.position) ** 2 + SOFTENING2);
      const freeFall = Math.sqrt((r * r * r) / (G * (bi.mass + bj.mass)));
      const vRel = Math.hypot(
        bi.velocity.x - bj.velocity.x,
        bi.velocity.y - bj.velocity.y,
        bi.velocity.z - bj.velocity.z,
      );
      const crossing = vRel > 0 ? r / vRel : Infinity;
      dt = Math.min(dt, eta * Math.min(freeFall, crossing));
    }
  }
  return Math.max(MIN_TIME_STEP, dt);
}

/**
 * Système de corps intégré par saute-mouton (« kick-drift-kick », symplectique) :
 * l'énergie ne dérive pas sur le long terme, contrairement à Euler.
 */
export class NBodySystem {
  time = 0;
  private readonly acc: Vec3[];
  private accValid = false;
  private readonly escaped = new Set<string>();

  constructor(
    readonly bodies: Body[],
    private readonly eta = 0.01,
  ) {
    this.acc = bodies.map(() => vec3());
  }

  /** Avance de `duration` unités de temps. Renvoie les collisions et éjections survenues. */
  advance(duration: number, maxSteps = 20000): SystemEvent[] {
    const events: SystemEvent[] = [];
    let remaining = duration;
    let steps = 0;
    while (remaining > 1e-12 && steps < maxSteps) {
      const dt = Math.min(adaptiveTimeStep(this.bodies, this.eta), remaining);
      this.step(dt);
      remaining -= dt;
      steps++;
      events.push(...this.resolveCollisions());
    }
    events.push(...this.detectEscapes());
    return events;
  }

  step(dt: number): void {
    const { bodies, acc } = this;
    if (!this.accValid) computeAccelerations(bodies, acc);
    const half = dt / 2;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b.alive) continue;
      b.velocity.x += acc[i].x * half;
      b.velocity.y += acc[i].y * half;
      b.velocity.z += acc[i].z * half;
      b.position.x += b.velocity.x * dt;
      b.position.y += b.velocity.y * dt;
      b.position.z += b.velocity.z * dt;
    }
    computeAccelerations(bodies, acc);
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b.alive) continue;
      b.velocity.x += acc[i].x * half;
      b.velocity.y += acc[i].y * half;
      b.velocity.z += acc[i].z * half;
    }
    this.accValid = true;
    this.time += dt;
  }

  /**
   * Deux corps dont les centres se rapprochent à moins du plus grand rayon fusionnent :
   * le plus massif absorbe l'autre, en conservant la masse et la quantité de mouvement.
   */
  private resolveCollisions(): SystemEvent[] {
    const events: SystemEvent[] = [];
    const { bodies } = this;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (!a.alive || !b.alive) continue;
        if (distance(a.position, b.position) >= Math.max(a.radius, b.radius)) continue;
        const [survivor, absorbed] = a.mass >= b.mass ? [a, b] : [b, a];
        mergeInto(survivor, absorbed);
        this.accValid = false;
        events.push({ type: 'merge', survivor, absorbed });
      }
    }
    return events;
  }

  private detectEscapes(): SystemEvent[] {
    const events: SystemEvent[] = [];
    const com = centerOfMass(this.bodies);
    let totalMass = 0;
    for (const b of aliveBodies(this.bodies)) totalMass += b.mass;
    for (const b of aliveBodies(this.bodies)) {
      if (this.escaped.has(b.id)) continue;
      const r = vec3(b.position.x - com.x, b.position.y - com.y, b.position.z - com.z);
      const d = length(r);
      if (d < ESCAPE_DISTANCE) continue;
      const radialSpeed = (r.x * b.velocity.x + r.y * b.velocity.y + r.z * b.velocity.z) / d;
      const speed2 = b.velocity.x ** 2 + b.velocity.y ** 2 + b.velocity.z ** 2;
      if (radialSpeed > 0 && speed2 > (2 * G * totalMass) / d) {
        this.escaped.add(b.id);
        events.push({ type: 'escape', body: b });
      }
    }
    return events;
  }
}

function mergeInto(survivor: Body, absorbed: Body): void {
  const m = survivor.mass + absorbed.mass;
  for (const axis of ['x', 'y', 'z'] as const) {
    survivor.position[axis] = (survivor.position[axis] * survivor.mass + absorbed.position[axis] * absorbed.mass) / m;
    survivor.velocity[axis] = (survivor.velocity[axis] * survivor.mass + absorbed.velocity[axis] * absorbed.mass) / m;
  }
  survivor.mass = m;
  if (survivor.kind === 'sun') {
    survivor.radius = sunRadius(m);
    survivor.luminosity = sunLuminosity(m);
  }
  absorbed.alive = false;
}
