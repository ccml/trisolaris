import * as THREE from 'three';
import { DesktopControls } from '../controls/desktopControls';
import { centerOfMass } from '../physics/nbody';
import { PRESETS, type PresetId } from '../physics/presets';
import type { Vec3 } from '../physics/vector';
import { createStarfield } from '../render/starfield';
import { SystemView } from '../render/systemView';
import { Hud } from '../ui/hud';
import { TouchToolbar } from '../ui/touchToolbar';
import { describeEvent } from '../ui/labels';
import { VRPanel } from '../ui/vrPanel';
import { createVRButton } from '../xr/vrButton';
import { XRControls } from '../xr/xrControls';
import { Simulation } from './simulation';

/** En VR, le système devient une maquette posée devant le joueur (1 unité de simulation = 18 cm). */
const VR_MODEL_POSITION = new THREE.Vector3(0, 1.25, -0.9);
const VR_MODEL_SCALE = 0.18;
const VR_PANEL_POSITION = new THREE.Vector3(0, 1.85, -1.4);
const DESKTOP_CAMERA_POSITION = new THREE.Vector3(0, 2.6, 4.2);

interface FocusTarget {
  name: string;
  position: () => Vec3 | null;
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Élément #${id} introuvable`);
  return element;
}

/** Assemble la scène, la simulation, les contrôles et lance la boucle de rendu. */
export function createApp(container: HTMLElement): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation(1); // rendu fovéal fixe : gros gain de performance sur Quest
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);
  scene.add(createStarfield());
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 2000);
  // Écran en portrait (téléphone) : on recule la caméra pour que le système tienne en largeur.
  camera.position.copy(DESKTOP_CAMERA_POSITION).multiplyScalar(Math.min(2, Math.max(1, 1 / camera.aspect)));

  const simulation = new Simulation();
  const view = new SystemView(scene);
  view.setBodies(simulation.bodies);

  const hud = new Hud(requireElement('hud'), requireElement('era'), requireElement('toast'));
  const vrPanel = new VRPanel();
  vrPanel.mesh.position.copy(VR_PANEL_POSITION);
  vrPanel.mesh.visible = false;
  scene.add(vrPanel.mesh);

  // Cibles de la caméra : centre de masse, chaque soleil, la planète (si encore en vie).
  let focusIndex = 0;
  const focusTargets = (): FocusTarget[] => [
    { name: 'Centre de masse', position: () => centerOfMass(simulation.suns) },
    ...simulation.bodies.map((b) => ({
      name: b.kind === 'planet' ? 'Planète' : `Soleil ${b.name}`,
      position: () => (b.alive ? b.position : null),
    })),
  ];
  let jumpFocus = true;
  const focusPoint = new THREE.Vector3();

  const notify = (text: string) => {
    hud.showToast(text);
    vrPanel.showToast(text);
  };

  const loadPreset = (presetId: PresetId, seed?: number) => {
    simulation.load(presetId, seed);
    view.setBodies(simulation.bodies);
    jumpFocus = true;
  };
  const actions = {
    togglePause: () => simulation.togglePause(),
    changeSpeed: (direction: 1 | -1) => simulation.changeSpeed(direction),
    selectPreset: (index: number) => {
      const preset = PRESETS[index];
      if (preset) loadPreset(preset.id);
    },
    nextPreset: () => {
      const index = PRESETS.findIndex((p) => p.id === simulation.preset.id);
      loadPreset(PRESETS[(index + 1) % PRESETS.length].id);
      notify(simulation.preset.description);
    },
    randomize: () => {
      const seed = Math.floor(Math.random() * 1_000_000);
      loadPreset('chaotic', seed);
      notify(`Nouveau système chaotique (graine ${seed})`);
    },
    restart: () => loadPreset(simulation.preset.id),
    cycleFocus: () => {
      const targets = focusTargets();
      do focusIndex = (focusIndex + 1) % targets.length;
      while (!targets[focusIndex].position());
    },
    toggleTrails: () => view.setTrailsVisible(!view.areTrailsVisible),
  };

  const desktop = new DesktopControls(camera, renderer.domElement, actions);
  const xr = new XRControls(renderer, scene, actions);

  // Barre tactile (téléphone, tablette) ; le bouton « Infos » replie le panneau d'informations.
  const hudElement = requireElement('hud');
  const touchToolbar = new TouchToolbar(requireElement('touchbar'), {
    ...actions,
    toggleInfo: () => hudElement.classList.toggle('collapsed'),
  });

  // Sur écran tactile : rappel des gestes au démarrage, et panneau replié sur téléphone (peu de place).
  if (matchMedia('(hover: none) and (pointer: coarse)').matches) {
    if (matchMedia('(max-width: 600px)').matches) hudElement.classList.add('collapsed');
    notify('Un doigt : tourner · pincer : zoomer · deux doigts : déplacer');
  }

  const vrButton = createVRButton(renderer);
  vrButton.classList.add('vr-button'); // repositionné en CSS sur écran tactile
  document.body.appendChild(vrButton);
  // Sans VR (téléphone, tablette), le bouton « VR NOT SUPPORTED » est masqué sur écran tactile (CSS).
  void navigator.xr
    ?.isSessionSupported('immersive-vr')
    .then((supported) => vrButton.classList.toggle('vr-unsupported', !supported))
    .catch(() => vrButton.classList.add('vr-unsupported'));
  if (!navigator.xr) vrButton.classList.add('vr-unsupported');

  const overlays = ['hud', 'era', 'help', 'touchbar'].map(requireElement);
  renderer.xr.addEventListener('sessionstart', () => {
    desktop.setEnabled(false);
    view.root.position.copy(VR_MODEL_POSITION);
    view.root.scale.setScalar(VR_MODEL_SCALE);
    vrPanel.mesh.visible = true;
    for (const o of overlays) o.classList.add('hidden');
  });
  renderer.xr.addEventListener('sessionend', () => {
    view.root.position.set(0, 0, 0);
    view.root.scale.setScalar(1);
    view.root.rotation.set(0, 0, 0);
    vrPanel.mesh.visible = false;
    desktop.setEnabled(true);
    jumpFocus = true;
    for (const o of overlays) o.classList.remove('hidden');
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    for (const event of simulation.update(dt)) notify(describeEvent(event));
    const climate = simulation.climate();
    view.update(climate, dt);

    const targets = focusTargets();
    let target = targets[focusIndex];
    if (!target?.position()) {
      focusIndex = 0; // le corps suivi a disparu : retour au centre de masse
      target = targets[0];
      jumpFocus = true;
    }

    if (renderer.xr.isPresenting) {
      xr.update(dt, view.root);
    } else {
      const p = target.position()!;
      focusPoint.set(p.x, p.y, p.z);
      view.root.localToWorld(focusPoint);
      desktop.follow(focusPoint, jumpFocus);
      jumpFocus = false;
      desktop.update();
    }

    const state = {
      presetName: simulation.preset.name,
      time: simulation.system.time,
      speed: simulation.speed,
      paused: simulation.paused,
      focusName: target.name,
      suns: simulation.suns,
      climate,
    };
    if (renderer.xr.isPresenting) {
      // Le panneau fait toujours face au joueur.
      vrPanel.mesh.lookAt(renderer.xr.getCamera().getWorldPosition(new THREE.Vector3()));
      vrPanel.update(state, dt);
    } else {
      hud.update(state, dt);
      touchToolbar.update({
        paused: simulation.paused,
        speed: simulation.speed,
        trailsVisible: view.areTrailsVisible,
        infoVisible: !hudElement.classList.contains('collapsed'),
      });
    }
    renderer.render(scene, camera);
  });
}
