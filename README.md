# PaRappa2WebPort — browser engine foundation

Independent browser-native rhythm-game engine prototype built as a technical foundation for a future, authorized web port. This repository does not contain PaRappa 2 source code, executable data, disc images, music, voices, models, textures, character designs, or extracted assets. It is not yet a playable port of PaRappa the Rapper 2.

## Build 0.2

- WebGL2 scene using original placeholder geometry.
- Local audio selection: files stay in the browser and are not uploaded.
- Audio playback clock used as the timing source for imported-track sessions.
- Editable BPM and timing-offset settings.
- Generated three-lane rhythm chart, timing judgements, score, and combo.
- Keyboard (J, K, L), touch/pointer lanes, and basic gamepad input.
- Responsive interface, GitHub Pages deployment, and Node.js unit tests.

## Run locally

Requires Node.js 20+ for tests. Serve the folder over HTTP:

    npm test
    python3 -m http.server 8000

Open http://localhost:8000 in a browser with WebGL2 enabled.

## Deploy

The workflow in .github/workflows/pages.yml deploys the repository root to GitHub Pages after pushes to main. In repository settings, choose GitHub Actions as the Pages source.

## Roadmap

1. Define an authorized asset boundary and document permitted formats.
2. Build independent readers for model, animation, texture, scene, chart, and audio metadata using original test fixtures.
3. Expand the WebGL2 renderer with skeletal animation, materials, lighting, camera tracks, and effects.
4. Build stage scripting, menus, calibration, input remapping, and save data.
5. Implement PaRappa 2-specific adapters only after obtaining the necessary permissions and authorized data.

A full port requires substantial reverse engineering and technical work. This prototype uses generated test charts; it does not read PS2 disc images or parse game-specific files. The original parappadev/parappa2 repository remains untouched and its code is not copied here.
