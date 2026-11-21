# CLAUDE.md

Ce fichier guide Claude lorsqu'il travaille sur ce projet.

## Vision du projet

**Trisolaris** : simulation 3D d'un système solaire à **trois soleils** (problème à trois corps) et d'une planète habitée. Le joueur observe les trajectoires chaotiques des soleils et leurs effets sur le climat de la planète : ères stables (un soleil domine le ciel), ères chaotiques, chaleur extrême, grand froid, voire destruction de la planète.

## Stack technique

Reprise du projet `world3d` :

- **Langage** : TypeScript
- **Rendu 3D** : Three.js (`OrbitControls` sur ordinateur, `renderer.xr` + `VRButton` en VR)
- **Réalité virtuelle** : WebXR (`immersive-vr`), casque cible **Meta Quest 3**
- **Build** : Vite (+ `@vitejs/plugin-basic-ssl` pour le HTTPS)
- **Tests** : Vitest
- **Test sans casque** : émulateur IWER (`iwer` + `@iwer/devui`), avec `?emulate` dans l'URL en dev

## Architecture

```
src/
  main.ts                 # Point d'entrée (installe l'émulateur si ?emulate)
  core/app.ts             # Assemble scène, simulation, vues, contrôles ; boucle de rendu
  core/simulation.ts      # État de la simulation : configuration, vitesse, pause, climat (sans Three.js)
  physics/nbody.ts        # Intégrateur à N corps (saute-mouton, pas adaptatif), fusions, éjections
  physics/presets.ts      # Configurations initiales : chaotique (graine), figure en huit, Lagrange, hiérarchique
  physics/climate.ts      # Flux reçu par la planète, température d'équilibre, ère
  physics/random.ts       # Générateur pseudo-aléatoire déterministe
  render/systemView.ts    # Soleils (cœur + halo + lumière), planète, traînées
  render/trail.ts         # Traînée en tampon glissant, dégradé additif
  render/starfield.ts     # Fond d'étoiles
  controls/desktopControls.ts  # Caméra en orbite + raccourcis clavier, suivi d'un corps
  xr/                     # Bouton VR, manettes, émulateur
  ui/                     # HUD DOM (ordinateur), barre tactile (téléphone, tablette), panneau 3D (VR), libellés
```

Principes :
- La physique (`physics/`) et la simulation (`core/simulation.ts`) n'importent pas Three.js : elles sont testées avec Vitest.
- Unités de simulation réduites : G = 1, masse d'un soleil ≈ 1, distances ≈ 1. Le rendu place tout le système dans `SystemView.root` : échelle 1 sur ordinateur, maquette de 18 cm par unité en VR.
- Intégrateur symplectique (kick-drift-kick) avec pas adaptatif (fraction des temps de chute libre et de croisement) et adoucissement `SOFTENING` : l'énergie est conservée à 1e-4 près sur une période de la figure en huit.
- Collisions : deux corps fusionnent quand leurs centres sont à moins du plus grand rayon (masse et quantité de mouvement conservées). Les corps ne sont jamais retirés du tableau (`alive = false`) : les vues restent indexées.
- Le centre de masse est placé à l'origine et immobile (`recenter`).
- Climat : luminosité L = M^3,5, flux relatif L·(d_ref/d)², température 288 K × flux^¼. La planète démarre à la distance habitable de son soleil (`habitableDistance`). Ère stable si un soleil apporte ≥ 80 % du flux et que la température est tempérée.
- La planète est une particule test (masse 1e-7) : elle n'influence pas les soleils.
- Les entrées (clavier, manettes) sont traduites en actions abstraites (`togglePause`, `changeSpeed`, `randomize`…).

## Commandes

```bash
npm install       # Installer les dépendances
npm run dev       # Serveur de dev HTTPS sur https://localhost:5173 et le réseau local
npx vite --mode http --port 5174   # Aperçu local en HTTP (sans avertissement de certificat)
npm run typecheck # Vérifier les types
npm run build     # Construire la version de production
npm run test      # Lancer les tests
```

### Docker

```bash
docker build -t trisolaris .                                  # Tests + build, puis image nginx
docker run --rm -p 8080:80 -p 8443:443 trisolaris             # http://localhost:8080 et https://<IP>:8443
```

Le `Dockerfile` (multi-étapes) lance les tests et `npm run build`, génère un certificat auto-signé, puis sert `dist/` avec nginx (`nginx.conf`). Le HTTPS sert au Quest 3 : WebXR l'exige hors `localhost`. Il faut accepter l'avertissement du certificat dans le navigateur du casque.

Commandes ordinateur : souris = orbite / zoom / déplacement · `1`–`4` configuration · `N` nouveau système chaotique (graine aléatoire) · `R` recommencer · `Espace` pause · `+` `−` (ou flèches haut/bas) vitesse · `C` caméra suivante (centre de masse, chaque soleil, planète) · `T` traînées.

Commandes tactiles (téléphone, tablette) : un doigt = tourner · pincer = zoomer · deux doigts = déplacer (`OrbitControls`). La barre du bas (`ui/touchToolbar.ts`) reprend les raccourcis clavier : pause, vitesse − / +, configuration suivante, nouveau système, recommencer, caméra, traînées, infos (replie le panneau, replié par défaut sur téléphone). Elle n'apparaît qu'avec `(hover: none) and (pointer: coarse)`, c'est-à-dire sur un écran tactile sans souris ; sur ces écrans, l'aide clavier et le bouton « VR NOT SUPPORTED » sont masqués.

Commandes VR : stick droit = tourner / agrandir la maquette · stick gauche avant/arrière = vitesse · A = pause · B = configuration suivante · X = nouveau système chaotique · Y = traînées · gâchette droite = recommencer.

Tester sur le Quest 3 : `npm run dev`, ouvrir `https://<IP-du-Mac>:5173` dans le navigateur du casque, accepter le certificat, « ENTER VR ». Sans casque : `?emulate`.

## Conventions

- Code et noms de variables en anglais ; commentaires et documentation en français.
- Une classe ou un module par fichier, noms de fichiers en `camelCase.ts`.
- Performances VR prioritaires (72–90 images/s sur Quest 3) : `MeshBasicMaterial` / `MeshLambertMaterial`, trois lumières ponctuelles seulement, panneau VR redessiné 4 fois par seconde.
- Confort VR : la caméra n'est jamais déplacée par la simulation ; c'est la maquette qui bouge.
- Interface VR intégrée à la scène (panneau 3D), pas de DOM.
