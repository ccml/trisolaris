import { XRDevice, metaQuest3 } from 'iwer';
import { DevUI } from '@iwer/devui';

/** Remplace l'API WebXR du navigateur par un Quest 3 émulé, avec son interface de contrôle. */
export function installEmulator(): XRDevice {
  const device = new XRDevice(metaQuest3);
  // forceInstall : Chrome expose déjà un navigator.xr natif (sans casque), on le remplace.
  device.installRuntime({ forceInstall: true });
  new DevUI(device);
  // Accessible depuis la console pour piloter l'émulateur (tests manuels / automatisés).
  (window as unknown as { xrDevice: XRDevice }).xrDevice = device;
  return device;
}
