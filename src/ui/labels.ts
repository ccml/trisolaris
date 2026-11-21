import type { Era } from '../physics/climate';
import type { SystemEvent } from '../physics/nbody';

export interface EraLabel {
  title: string;
  description: string;
  color: string;
}

export const ERA_LABELS: Record<Era | 'destroyed', EraLabel> = {
  stable: { title: 'Ère stable', description: 'Un seul soleil règne : jours et nuits réguliers', color: '#5fd38d' },
  chaotic: { title: 'Ère chaotique', description: 'Plusieurs soleils se disputent le ciel', color: '#f2b84b' },
  scorching: { title: 'Chaleur extrême', description: 'La planète brûle sous les soleils', color: '#ff5b3a' },
  frozen: { title: 'Grand froid', description: 'Les soleils sont lointains, tout gèle', color: '#7cc4ff' },
  destroyed: { title: 'Civilisation détruite', description: 'La planète a été engloutie par un soleil', color: '#b0b0b0' },
};

export function formatTemperature(kelvin: number): string {
  return `${Math.round(kelvin - 273.15)} °C`;
}

export function describeEvent(event: SystemEvent): string {
  if (event.type === 'escape') {
    return event.body.kind === 'planet'
      ? 'La planète est éjectée vers l’espace interstellaire'
      : `Le soleil ${event.body.name} est éjecté du système`;
  }
  return event.absorbed.kind === 'planet'
    ? `La planète est engloutie par ${event.survivor.name}`
    : `Les soleils ${event.survivor.name} et ${event.absorbed.name} fusionnent`;
}
