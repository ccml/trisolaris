/** Vecteur 3D minimal, sans Three.js : la physique reste testable et indépendante du rendu. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}
