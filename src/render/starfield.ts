import * as THREE from 'three';
import { createRandom } from '../physics/random';

/** Fond d'étoiles fixes, réparties uniformément sur une grande sphère. */
export function createStarfield(count = 4000, radius = 400): THREE.Points {
  const random = createRandom(11);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    positions.set([radius * s * Math.cos(theta), radius * u, radius * s * Math.sin(theta)], i * 3);
    color.setHSL(0.55 + (random() - 0.5) * 0.25, 0.4 * random(), 0.35 + 0.6 * random() ** 3);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false });
  return new THREE.Points(geometry, material);
}
