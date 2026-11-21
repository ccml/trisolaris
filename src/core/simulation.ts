import { climateOf, type ClimateReport } from '../physics/climate';
import { NBodySystem, type Body, type SystemEvent } from '../physics/nbody';
import { getPreset, type PresetDefinition, type PresetId } from '../physics/presets';

/** Vitesses proposées, en unités de temps simulé par seconde réelle. */
export const SPEEDS = [0.05, 0.1, 0.25, 0.5, 1, 2, 4];
const DEFAULT_SPEED_INDEX = 3;
/** Au-delà, une image lente (onglet en arrière-plan) ne fait pas faire un bond à la simulation. */
const MAX_FRAME_TIME = 0.1; // s
export const DEFAULT_SEED = 141; // choisie : part d’une ère stable puis traverse les quatre ères sans fusion de soleils

/** État de la simulation, indépendant du rendu et des périphériques. */
export class Simulation {
  system!: NBodySystem;
  preset!: PresetDefinition;
  seed = DEFAULT_SEED;
  paused = false;
  private speedIndex = DEFAULT_SPEED_INDEX;

  constructor(presetId: PresetId = 'chaotic') {
    this.load(presetId);
  }

  load(presetId: PresetId, seed = this.seed): void {
    this.preset = getPreset(presetId);
    this.seed = seed;
    this.system = new NBodySystem(this.preset.create(seed));
  }

  restart(): void {
    this.load(this.preset.id, this.seed);
  }

  get bodies(): Body[] {
    return this.system.bodies;
  }

  get suns(): Body[] {
    return this.bodies.filter((b) => b.kind === 'sun');
  }

  get planet(): Body | undefined {
    return this.bodies.find((b) => b.kind === 'planet');
  }

  get speed(): number {
    return SPEEDS[this.speedIndex];
  }

  changeSpeed(direction: 1 | -1): void {
    this.speedIndex = Math.min(SPEEDS.length - 1, Math.max(0, this.speedIndex + direction));
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  update(realDt: number): SystemEvent[] {
    if (this.paused) return [];
    return this.system.advance(Math.min(realDt, MAX_FRAME_TIME) * this.speed);
  }

  /** Climat de la planète ; null si elle a été engloutie. */
  climate(): ClimateReport | null {
    const planet = this.planet;
    if (!planet?.alive) return null;
    return climateOf(planet, this.suns);
  }
}
