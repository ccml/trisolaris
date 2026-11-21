import * as THREE from 'three';
import { ERA_LABELS, formatTemperature } from './labels';
import type { HudState } from './hudState';

const REFRESH_INTERVAL = 0.25; // s : redessiner un canevas coûte cher sur Quest
const WIDTH = 1024;
const HEIGHT = 512;
const TOAST_DURATION = 4; // s

/** Panneau 3D flottant (pas de DOM en VR) : ère, température, lumière des soleils, aide des manettes. */
export class VRPanel {
  readonly mesh: THREE.Mesh;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private sinceRefresh = Infinity;
  private toast = '';
  private toastAge = Infinity;

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.4),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true }),
    );
  }

  showToast(text: string): void {
    this.toast = text;
    this.toastAge = 0;
    this.sinceRefresh = Infinity;
  }

  update(state: HudState, dt: number): void {
    this.toastAge += dt;
    this.sinceRefresh += dt;
    if (!this.mesh.visible || this.sinceRefresh < REFRESH_INTERVAL) return;
    this.sinceRefresh = 0;
    const { ctx } = this;
    const { climate } = state;
    const era = ERA_LABELS[climate ? climate.era : 'destroyed'];

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = 'rgba(10, 14, 24, 0.82)';
    ctx.beginPath();
    ctx.roundRect(0, 0, WIDTH, HEIGHT, 28);
    ctx.fill();
    ctx.strokeStyle = era.color;
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = era.color;
    ctx.font = 'bold 58px system-ui, sans-serif';
    ctx.fillText(era.title, 36, 78);
    ctx.fillStyle = '#e8edf3';
    ctx.font = '30px system-ui, sans-serif';
    ctx.fillText(era.description, 36, 122);
    ctx.fillText(
      `${state.presetName} · t = ${state.time.toFixed(1)} · ×${state.speed}${state.paused ? ' · pause' : ''}`,
      36,
      172,
    );
    ctx.fillText(`Température : ${climate ? formatTemperature(climate.temperature) : '—'}`, 36, 216);

    state.suns.forEach((sun, i) => {
      const y = 262 + i * 46;
      const fraction = climate?.contributions.find((c) => c.sunId === sun.id)?.fraction ?? 0;
      const color = `#${sun.color.toString(16).padStart(6, '0')}`;
      ctx.fillStyle = sun.alive ? '#e8edf3' : '#777';
      ctx.fillText(sun.name, 36, y + 26);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(180, y + 4, 640, 28);
      ctx.fillStyle = color;
      ctx.fillRect(180, y + 4, 640 * fraction, 28);
      ctx.fillStyle = '#e8edf3';
      ctx.fillText(`${Math.round(fraction * 100)} %`, 840, y + 28);
    });

    ctx.fillStyle = '#9aa7b8';
    ctx.font = '24px system-ui, sans-serif';
    if (this.toastAge < TOAST_DURATION) {
      ctx.fillStyle = '#ffd27a';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillText(this.toast, 36, 484);
    } else {
      ctx.fillText('Stick D : tourner/zoom · Stick G : vitesse · A pause · B config · X nouveau · Y traînées', 36, 484);
    }
    this.texture.needsUpdate = true;
  }
}
