import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const STICK_ON = 0.7; // seuil d'activation (crans)
const STICK_OFF = 0.3; // seuil de relâchement (hystérésis)
const DEADZONE = 0.15;
const ROTATE_SPEED = 1.5; // rad/s
const ZOOM_SPEED = 1.2; // facteur d'échelle par seconde (logarithmique)
export const MIN_VR_SCALE = 0.04;
export const MAX_VR_SCALE = 1.5;
const TRIGGER_BUTTON = 0;
const LOWER_BUTTON = 4; // A ou X dans le mapping xr-standard
const UPPER_BUTTON = 5; // B ou Y

/** Actions abstraites déclenchées par les manettes. */
export interface XRActions {
  togglePause: () => void;
  changeSpeed: (direction: 1 | -1) => void;
  nextPreset: () => void;
  randomize: () => void;
  restart: () => void;
  toggleTrails: () => void;
}

/**
 * Contrôles VR (Quest 3). Le système est une maquette posée devant le joueur :
 * - stick droit gauche/droite : faire tourner la maquette ; avant/arrière : l'agrandir ou la réduire
 * - stick gauche avant/arrière (par crans) : accélérer ou ralentir le temps
 * - A : pause · B : configuration suivante · X : nouveau système chaotique · Y : traînées
 * - gâchette droite : recommencer
 */
export class XRControls {
  private readonly pressed = new Map<string, boolean>();
  private speedStickReady = true;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    private readonly actions: XRActions,
  ) {
    const models = new XRControllerModelFactory();
    for (let i = 0; i < 2; i++) {
      const grip = renderer.xr.getControllerGrip(i);
      grip.add(models.createControllerModel(grip));
      scene.add(grip);
    }
  }

  update(dt: number, model: THREE.Object3D): void {
    const session = this.renderer.xr.getSession();
    if (!session) return;
    for (const source of session.inputSources) {
      const gamepad = source.gamepad;
      if (!gamepad) continue;
      const x = deadzone(gamepad.axes[2] ?? 0);
      const y = deadzone(gamepad.axes[3] ?? 0);
      if (source.handedness === 'right') {
        model.rotation.y += x * ROTATE_SPEED * dt;
        const scale = THREE.MathUtils.clamp(model.scale.x * Math.exp(-y * ZOOM_SPEED * dt), MIN_VR_SCALE, MAX_VR_SCALE);
        model.scale.setScalar(scale);
        if (this.justPressed('right', gamepad, LOWER_BUTTON)) this.actions.togglePause();
        if (this.justPressed('right', gamepad, UPPER_BUTTON)) this.actions.nextPreset();
        if (this.justPressed('right', gamepad, TRIGGER_BUTTON)) this.actions.restart();
      } else if (source.handedness === 'left') {
        if (this.speedStickReady && Math.abs(y) > STICK_ON) {
          this.actions.changeSpeed(y < 0 ? 1 : -1); // stick vers l'avant = axe négatif = plus vite
          this.speedStickReady = false;
        } else if (Math.abs(y) < STICK_OFF) {
          this.speedStickReady = true;
        }
        if (this.justPressed('left', gamepad, LOWER_BUTTON)) this.actions.randomize();
        if (this.justPressed('left', gamepad, UPPER_BUTTON)) this.actions.toggleTrails();
      }
    }
  }

  private justPressed(hand: string, gamepad: Gamepad, index: number): boolean {
    const key = `${hand}-${index}`;
    const now = gamepad.buttons[index]?.pressed ?? false;
    const before = this.pressed.get(key) ?? false;
    this.pressed.set(key, now);
    return now && !before;
  }
}

function deadzone(value: number): number {
  return Math.abs(value) < DEADZONE ? 0 : value;
}
