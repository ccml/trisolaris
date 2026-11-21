import * as THREE from 'three';
import type { ClimateReport } from '../physics/climate';
import type { Body } from '../physics/nbody';
import { createGlowTexture, createPlanetTexture } from './textures';
import { Trail } from './trail';

const SUN_TRAIL_POINTS = 2500;
const PLANET_TRAIL_POINTS = 1500;
const GLOW_SIZE = 14; // multiple du rayon
const LIGHT_INTENSITY = 2.2;

interface BodyView {
  body: Body;
  object: THREE.Object3D;
  trail: Trail;
}

/** Couleur de la planète selon sa température : glace, tempérée, brûlée. */
const COLD = new THREE.Color(0xa8d8ff);
const MILD = new THREE.Color(0xffffff);
const HOT = new THREE.Color(0xff6a3a);

/**
 * Rendu du système, en unités de simulation à l'intérieur de `root` :
 * l'échelle et la position de `root` diffèrent entre l'ordinateur et la VR.
 */
export class SystemView {
  readonly root = new THREE.Group();
  private views: BodyView[] = [];
  private readonly glowTexture = createGlowTexture();
  private readonly planetTexture = createPlanetTexture();
  private trailsVisible = true;
  private planetMaterial: THREE.MeshLambertMaterial | null = null;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    // Faible lumière ambiante : la face nocturne de la planète reste devinable.
    this.root.add(new THREE.AmbientLight(0x334466, 0.25));
  }

  /** Reconstruit les objets pour un nouvel ensemble de corps (changement de configuration). */
  setBodies(bodies: Body[]): void {
    for (const v of this.views) {
      this.root.remove(v.object, v.trail.line);
      v.object.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      v.trail.line.geometry.dispose();
    }
    this.views = bodies.map((body) => {
      const object = body.kind === 'sun' ? this.createSun(body) : this.createPlanet(body);
      const trail = new Trail(body.color, body.kind === 'sun' ? SUN_TRAIL_POINTS : PLANET_TRAIL_POINTS);
      trail.line.visible = this.trailsVisible;
      this.root.add(object, trail.line);
      return { body, object, trail };
    });
  }

  setTrailsVisible(visible: boolean): void {
    this.trailsVisible = visible;
    for (const v of this.views) {
      v.trail.line.visible = visible;
      if (!visible) v.trail.clear();
    }
  }

  get areTrailsVisible(): boolean {
    return this.trailsVisible;
  }

  update(climate: ClimateReport | null, dt: number): void {
    for (const { body, object, trail } of this.views) {
      object.visible = body.alive;
      if (!body.alive) {
        trail.line.visible = false;
        continue;
      }
      object.position.set(body.position.x, body.position.y, body.position.z);
      if (body.kind === 'sun') object.userData.core.scale.setScalar(body.radius);
      else object.rotation.y += dt * 0.8;
      if (this.trailsVisible) trail.push(body.position);
    }
    if (this.planetMaterial && climate) {
      const t = climate.temperature;
      const color = this.planetMaterial.color;
      if (t < 288) color.copy(MILD).lerp(COLD, THREE.MathUtils.clamp((288 - t) / 90, 0, 1));
      else color.copy(MILD).lerp(HOT, THREE.MathUtils.clamp((t - 288) / 110, 0, 1));
    }
  }

  private createSun(body: Body): THREE.Object3D {
    const group = new THREE.Group();
    const color = new THREE.Color(body.color);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color(0xffffff), 0.55) }),
    );
    core.scale.setScalar(body.radius);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    // Le halo grandit avec le cœur (fusion de deux soleils).
    core.add(glow);
    glow.scale.setScalar(GLOW_SIZE);
    const light = new THREE.PointLight(color, LIGHT_INTENSITY, 0, 0);
    group.add(core, light);
    group.userData.core = core;
    return group;
  }

  private createPlanet(body: Body): THREE.Object3D {
    this.planetMaterial = new THREE.MeshLambertMaterial({ map: this.planetTexture });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(body.radius, 32, 16), this.planetMaterial);
    mesh.rotation.order = 'ZYX'; // rotation propre autour de l'axe incliné
    mesh.rotation.z = 0.4; // inclinaison de l'axe
    return mesh;
  }
}
