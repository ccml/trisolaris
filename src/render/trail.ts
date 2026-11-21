import * as THREE from 'three';
import type { Vec3 } from '../physics/vector';

const MIN_SEGMENT = 0.004; // unités de simulation : pas de point tant que le corps n'a pas bougé

/**
 * Traînée d'un corps : ligne dont les points les plus anciens s'assombrissent.
 * Avec un mélange additif, le noir est invisible : la traînée s'efface en douceur.
 */
export class Trail {
  readonly line: THREE.Line;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private count = 0;
  private readonly color: THREE.Color;

  constructor(
    color: number,
    private readonly maxPoints: number,
  ) {
    this.color = new THREE.Color(color);
    this.positions = new Float32Array(maxPoints * 3);
    this.colors = new Float32Array(maxPoints * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.line = new THREE.Line(geometry, material);
    this.line.frustumCulled = false;
  }

  push(p: Vec3): void {
    const pos = this.positions;
    if (this.count > 0) {
      const last = (this.count - 1) * 3;
      if (Math.hypot(pos[last] - p.x, pos[last + 1] - p.y, pos[last + 2] - p.z) < MIN_SEGMENT) return;
    }
    if (this.count === this.maxPoints) {
      pos.copyWithin(0, 3);
      this.count--;
    } else {
      this.count++;
      this.updateColors(); // le dégradé ne change plus une fois la traînée pleine
    }
    const i = (this.count - 1) * 3;
    pos[i] = p.x;
    pos[i + 1] = p.y;
    pos[i + 2] = p.z;
    const geometry = this.line.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.setDrawRange(0, this.count);
  }

  clear(): void {
    this.count = 0;
    this.line.geometry.setDrawRange(0, 0);
  }

  private updateColors(): void {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 1;
      const k = t * t * 0.9;
      this.colors[i * 3] = this.color.r * k;
      this.colors[i * 3 + 1] = this.color.g * k;
      this.colors[i * 3 + 2] = this.color.b * k;
    }
    this.line.geometry.attributes.color.needsUpdate = true;
  }
}
