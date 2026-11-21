import type { Body } from './nbody';
import { distance } from './vector';

/** Distance à laquelle un soleil de luminosité 1 donne une température terrestre. */
export const REFERENCE_DISTANCE = 0.28;
export const REFERENCE_TEMPERATURE = 288; // K
export const SCORCHING_TEMPERATURE = 350; // K
export const FROZEN_TEMPERATURE = 230; // K
/** Part minimale du flux venant d'un seul soleil pour parler d'ère stable (un seul soleil dans le ciel). */
export const STABLE_DOMINANCE = 0.8;
const BACKGROUND_TEMPERATURE = 3; // K, fond diffus cosmologique

export type Era = 'stable' | 'chaotic' | 'scorching' | 'frozen';

export interface SunContribution {
  sunId: string;
  /** Flux relatif (1 = soleil de référence à la distance de référence). */
  flux: number;
  /** Part du flux total, entre 0 et 1. */
  fraction: number;
}

export interface ClimateReport {
  flux: number;
  temperature: number;
  contributions: SunContribution[];
  dominance: number;
  era: Era;
}

/** Température d'équilibre : proportionnelle à la racine quatrième du flux reçu (loi de Stefan-Boltzmann). */
export function equilibriumTemperature(flux: number): number {
  return Math.max(BACKGROUND_TEMPERATURE, REFERENCE_TEMPERATURE * Math.pow(Math.max(0, flux), 0.25));
}

/**
 * Ères de Trisolaris : stable quand un soleil domine le ciel et que le climat est tempéré,
 * chaotique quand plusieurs soleils se partagent le ciel ; la chaleur et le froid extrêmes priment.
 */
export function classifyEra(temperature: number, dominance: number): Era {
  if (temperature >= SCORCHING_TEMPERATURE) return 'scorching';
  if (temperature <= FROZEN_TEMPERATURE) return 'frozen';
  return dominance >= STABLE_DOMINANCE ? 'stable' : 'chaotic';
}

export function climateOf(planet: Body, suns: Body[]): ClimateReport {
  const contributions = suns
    .filter((s) => s.alive && s.kind === 'sun')
    .map((s) => {
      const d = Math.max(distance(planet.position, s.position), 1e-6);
      return { sunId: s.id, flux: s.luminosity * (REFERENCE_DISTANCE / d) ** 2, fraction: 0 };
    });
  const flux = contributions.reduce((sum, c) => sum + c.flux, 0);
  for (const c of contributions) c.fraction = flux > 0 ? c.flux / flux : 0;
  const dominance = contributions.reduce((max, c) => Math.max(max, c.fraction), 0);
  const temperature = equilibriumTemperature(flux);
  return { flux, temperature, contributions, dominance, era: classifyEra(temperature, dominance) };
}
