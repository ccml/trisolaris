import { createApp } from './core/app';

async function start(): Promise<void> {
  // En développement, ajouter ?emulate à l'URL pour émuler un Quest 3 sans casque.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('emulate')) {
    const { installEmulator } = await import('./xr/emulator');
    installEmulator();
  }
  const container = document.getElementById('app');
  if (!container) throw new Error('Élément #app introuvable');
  createApp(container);
}

void start();
