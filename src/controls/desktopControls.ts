import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Actions abstraites déclenchées au clavier. */
export interface DesktopActions {
  togglePause: () => void;
  changeSpeed: (direction: 1 | -1) => void;
  selectPreset: (index: number) => void;
  randomize: () => void;
  restart: () => void;
  cycleFocus: () => void;
  toggleTrails: () => void;
}

/**
 * Mode ordinateur : caméra en orbite à la souris (glisser = tourner, molette = zoom, clic droit = déplacer)
 * et raccourcis clavier. On lit `event.code` pour les lettres (position physique, AZERTY comme QWERTY)
 * et `event.key` pour + et −, dont la position varie selon le clavier.
 */
export class DesktopControls {
  readonly orbit: OrbitControls;
  private enabled = true;
  private readonly lastFocus = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, element: HTMLElement, actions: DesktopActions) {
    this.orbit = new OrbitControls(camera, element);
    this.orbit.enableDamping = true;
    this.orbit.minDistance = 0.15;
    this.orbit.maxDistance = 60;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.ctrlKey || e.metaKey || e.altKey) return;
      const digit = /^(Digit|Numpad)([1-4])$/.exec(e.code);
      if (digit) return actions.selectPreset(Number(digit[2]) - 1);
      if (e.key === '+' || e.code === 'NumpadAdd' || e.code === 'ArrowUp') return actions.changeSpeed(1);
      if (e.key === '-' || e.code === 'NumpadSubtract' || e.code === 'ArrowDown') return actions.changeSpeed(-1);
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          return actions.togglePause();
        case 'KeyN':
          return actions.randomize();
        case 'KeyR':
          return actions.restart();
        case 'KeyC':
          return actions.cycleFocus();
        case 'KeyT':
          return actions.toggleTrails();
      }
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.orbit.enabled = enabled;
  }

  /**
   * Suit le point visé (coordonnées monde) : la caméra se déplace du même écart que lui,
   * l'orbite reste donc centrée sur le corps suivi sans à-coup.
   */
  follow(focus: THREE.Vector3, jump: boolean): void {
    if (!jump) {
      const delta = focus.clone().sub(this.lastFocus);
      this.orbit.object.position.add(delta);
    }
    this.orbit.target.copy(focus);
    this.lastFocus.copy(focus);
  }

  update(): void {
    if (this.enabled) this.orbit.update();
  }
}
