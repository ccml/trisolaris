import * as THREE from 'three';
import { createRandom } from '../physics/random';

/** Halo radial blanc vers transparent, teinté ensuite par la couleur du soleil. */
export function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Surface de planète (projection équirectangulaire) : océans, continents flous et calottes polaires. */
export function createPlanetTexture(seed = 3): THREE.Texture {
  const width = 512;
  const height = 256;
  const random = createRandom(seed);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1d4f8a';
  ctx.fillRect(0, 0, width, height);
  ctx.filter = 'blur(6px)';
  for (let i = 0; i < 70; i++) {
    const x = random() * width;
    const y = height * (0.2 + random() * 0.6);
    const rx = 10 + random() * 45;
    const ry = 6 + random() * 25;
    ctx.fillStyle = random() < 0.6 ? '#4f7d3a' : '#9a8556';
    // Dessiné deux fois pour que les continents se raccordent à la couture de longitude.
    for (const offset of [0, -width, width]) {
      ctx.beginPath();
      ctx.ellipse(x + offset, y, rx, ry, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#e8eef4';
  ctx.fillRect(0, 0, width, height * 0.08);
  ctx.fillRect(0, height * 0.92, width, height * 0.08);
  ctx.filter = 'none';
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
