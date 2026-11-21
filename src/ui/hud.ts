import { ERA_LABELS, formatTemperature } from './labels';
import type { HudState } from './hudState';

const REFRESH_INTERVAL = 0.1; // s
const TOAST_DURATION = 4000; // ms

/** Interface du mode ordinateur (DOM superposé), masquée en VR. */
export class Hud {
  private sinceRefresh = Infinity;
  private toastTimer: number | undefined;

  constructor(
    private readonly panel: HTMLElement,
    private readonly banner: HTMLElement,
    private readonly toast: HTMLElement,
  ) {}

  update(state: HudState, dt: number): void {
    this.sinceRefresh += dt;
    if (this.sinceRefresh < REFRESH_INTERVAL) return;
    this.sinceRefresh = 0;

    const { climate } = state;
    const era = ERA_LABELS[climate ? climate.era : 'destroyed'];
    this.banner.innerHTML = `<b>${era.title}</b><span>${era.description}</span>`;
    this.banner.style.borderColor = era.color;
    this.banner.querySelector('b')!.style.color = era.color;

    const bars = state.suns
      .map((sun) => {
        const fraction = climate?.contributions.find((c) => c.sunId === sun.id)?.fraction ?? 0;
        const color = `#${sun.color.toString(16).padStart(6, '0')}`;
        const name = sun.alive ? sun.name : `<s>${sun.name}</s>`;
        return `<div class="bar"><span class="dot" style="background:${color}"></span>${name}
          <span class="track"><span style="width:${(fraction * 100).toFixed(1)}%;background:${color}"></span></span>
          <span class="pct">${Math.round(fraction * 100)} %</span></div>`;
      })
      .join('');
    this.panel.innerHTML = `
      <h1>Trisolaris</h1>
      <div class="row"><span>Configuration</span><b>${state.presetName}</b></div>
      <div class="row"><span>Temps simulé</span><b>${state.time.toFixed(1)}</b></div>
      <div class="row"><span>Vitesse</span><b>×${state.speed}${state.paused ? ' · en pause' : ''}</b></div>
      <div class="row"><span>Caméra</span><b>${state.focusName}</b></div>
      <div class="row"><span>Température</span><b>${climate ? formatTemperature(climate.temperature) : '—'}</b></div>
      <div class="sub">Lumière reçue par la planète</div>
      ${bars}`;
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('visible'), TOAST_DURATION);
  }
}
