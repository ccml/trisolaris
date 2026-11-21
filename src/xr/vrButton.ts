import type * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

/** Bouton « Entrer en VR » : la session immersive ne peut démarrer que sur un geste de l'utilisateur. */
export function createVRButton(renderer: THREE.WebGLRenderer): HTMLElement {
  return VRButton.createButton(renderer, {
    optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
  });
}
