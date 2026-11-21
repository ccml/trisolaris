import type { ClimateReport } from '../physics/climate';
import type { Body } from '../physics/nbody';

/** Ce que les interfaces (DOM ou panneau VR) affichent ; construit à chaque image par l'application. */
export interface HudState {
  presetName: string;
  time: number;
  speed: number;
  paused: boolean;
  focusName: string;
  suns: Body[];
  climate: ClimateReport | null;
}
