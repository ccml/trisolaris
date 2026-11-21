/** Actions proposées par la barre tactile (mêmes actions abstraites que le clavier). */
export interface TouchActions {
  togglePause: () => void;
  changeSpeed: (direction: 1 | -1) => void;
  nextPreset: () => void;
  randomize: () => void;
  restart: () => void;
  cycleFocus: () => void;
  toggleTrails: () => void;
  toggleInfo: () => void;
}

export interface TouchToolbarState {
  paused: boolean;
  speed: number;
  trailsVisible: boolean;
  infoVisible: boolean;
}

interface ButtonSpec {
  id: string;
  icon: string;
  label: string;
  onPress: () => void;
}

/**
 * Barre de boutons pour téléphone et tablette, où il n'y a pas de clavier.
 * Les gestes de caméra (un doigt, pincement, deux doigts) restent gérés par OrbitControls.
 */
export class TouchToolbar {
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private lastRendered = '';

  constructor(container: HTMLElement, actions: TouchActions) {
    // Hauteur de la barre exposée au CSS : la bannière d'ère se place juste au-dessus.
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--touchbar-h', `${container.offsetHeight}px`);
    }).observe(container);
    const specs: ButtonSpec[] = [
      { id: 'pause', icon: '⏸', label: 'Pause', onPress: actions.togglePause },
      { id: 'slower', icon: '−', label: 'Plus lent', onPress: () => actions.changeSpeed(-1) },
      { id: 'speed', icon: '×0.5', label: 'Vitesse', onPress: () => {} }, // simple affichage
      { id: 'faster', icon: '+', label: 'Plus vite', onPress: () => actions.changeSpeed(1) },
      { id: 'preset', icon: '◎', label: 'Config.', onPress: actions.nextPreset },
      { id: 'random', icon: '⚄', label: 'Nouveau', onPress: actions.randomize },
      { id: 'restart', icon: '↺', label: 'Rejouer', onPress: actions.restart },
      { id: 'focus', icon: '⌖', label: 'Caméra', onPress: actions.cycleFocus },
      { id: 'trails', icon: '〰', label: 'Traînées', onPress: actions.toggleTrails },
      { id: 'info', icon: 'ⓘ', label: 'Infos', onPress: actions.toggleInfo },
    ];
    for (const spec of specs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.id = spec.id;
      button.setAttribute('aria-label', spec.label);
      button.innerHTML = `<span class="icon">${spec.icon}</span><span class="label">${spec.label}</span>`;
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        spec.onPress();
      });
      if (spec.id === 'speed') button.classList.add('readout');
      container.appendChild(button);
      this.buttons.set(spec.id, button);
    }
  }

  /** Met à jour libellés et états ; ne touche au DOM que si quelque chose a changé. */
  update(state: TouchToolbarState): void {
    const key = JSON.stringify(state);
    if (key === this.lastRendered) return;
    this.lastRendered = key;
    this.setIcon('pause', state.paused ? '▶' : '⏸', state.paused ? 'Lecture' : 'Pause');
    this.setIcon('speed', `×${state.speed}`);
    this.buttons.get('trails')!.classList.toggle('active', state.trailsVisible);
    this.buttons.get('info')!.classList.toggle('active', state.infoVisible);
  }

  private setIcon(id: string, icon: string, label?: string): void {
    const button = this.buttons.get(id)!;
    button.querySelector('.icon')!.textContent = icon;
    if (label) {
      button.querySelector('.label')!.textContent = label;
      button.setAttribute('aria-label', label);
    }
  }
}
