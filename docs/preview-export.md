---
layout: default
title: Preview & Export
nav_order: 13
---

# Preview & Export

## Preview

The Preview editor lets you play your game inside CAPAB without leaving the browser.

### Controls

| Button | Action |
|---|---|
| **Play** | Start the game from the title screen |
| **Stop** | Stop playback and return to the editor |
| **Reset** | Stop and restart from the beginning |
| **Fullscreen** | Expand the preview to fill the browser window |

The preview uses the same game runtime as the exported game — what you see in preview is what your players will see.

### What the Preview Runs

- Title screen with your configured buttons
- Scene navigation via events
- Character movement with pathfinding
- NPC movement instructions
- Cinematics and dialogue
- Scale zones and blocked zones
- Event triggers and actions
- Goal and stage advancement

---

## Export

The Export editor packages your entire game as a self-contained ZIP file that can be built and deployed to any web host.

### How to Export

1. Click **Export** in the left sidebar.
2. Click **Download ZIP**.
3. Unzip the archive on your computer.
4. Open a terminal in the unzipped folder and run:

```
npm install
npm run build
```

5. The `dist/` folder contains the built game — upload it to any static web host (GitHub Pages, Netlify, Vercel, S3, etc.).

### What's in the ZIP

| File | Description |
|---|---|
| `index.html` | Game entry point; canvas sized to your resolution |
| `src/engine.js` | Standalone game runtime (no external dependencies) |
| `src/game-data.json` | Your entire project serialised as JSON |
| `src/main.js` | Initialises the engine with the game data |
| `src/style.css` | Canvas centring and full-screen styles |
| `package.json` | Vite build config |
| `vite.config.js` | Vite bundler settings |
| `README.md` | Build and deploy instructions |

The standalone engine (`engine.js`) is a pure JavaScript file with zero runtime dependencies — it runs in any modern browser without Node.js.

### Hosting the Built Game

After running `npm run build`, host the `dist/` folder contents as static files:

**GitHub Pages**
Push `dist/` to a `gh-pages` branch, or configure GitHub Pages to serve from `dist/` in your repo settings.

**Netlify / Vercel**
Point the deployment to your repo and set the build command to `npm run build` and the publish directory to `dist`.

**Manual**
Upload the contents of `dist/` to any web server or CDN that serves static files over HTTPS.

---

## Tips

- Preview early and often — it's the fastest way to catch logic errors in events and cinematics.
- The exported engine is the same code as the preview runtime, so preview behaviour is authoritative.
- All assets (images, audio) are embedded in `game-data.json` as base64 data URLs — the game is fully self-contained; no CDN or asset server needed.
