import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS (certificat auto-signé) + écoute sur le réseau local :
// le Quest 3 peut ouvrir https://<IP-du-Mac>:5173
// `vite --mode http` désactive le HTTPS (aperçu local sans avertissement de certificat).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'http' ? [] : [basicSsl()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
}));
