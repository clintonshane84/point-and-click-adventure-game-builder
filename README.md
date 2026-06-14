# Point-and-Click Adventure Game Builder

A browser-based visual editor for creating point-and-click adventure games. Design scenes, characters, events, cinematics, and UI elements, then export a self-contained playable web project — no server required.

## Features

- **14 specialised editors** covering every aspect of a point-and-click game
- **In-browser game preview** with full event and cinematic playback
- **Export to ZIP** — generates a standalone Vite project ready to `npm install && npm run dev`
- **A\* pathfinding** with blocked zones and scale zones for character navigation
- **Cinematic sequencer** with walk, talk, wait, dialog, and sound steps
- **Stage & goal system** for tracking player progress and triggering completion actions
- **AI image generation** (optional) via OpenAI `gpt-image-1` — generates sprites and backgrounds from text prompts
- **Three-tier save system** — File System Access API, file download fallback, and 60-second localStorage auto-save

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | React 18 + TypeScript 5 |
| State management | Zustand 4 |
| Canvas rendering | Konva / react-konva |
| Styling | Tailwind CSS 3 |
| Build tool | Vite 5 |
| Icons | lucide-react |
| Export packaging | jszip |

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. No environment variables are required to run the editor. The OpenAI API key (for AI image generation) is entered inside the app under **Settings → AI Image Generation** and is stored only in your browser's `localStorage`.

### Other scripts

```bash
npm run build    # TypeScript check + production build → dist/
npm run preview  # Serve the production build locally
npm run lint     # ESLint with zero-warning policy
```

## Editors

| Editor | Purpose |
|---|---|
| **Scene Editor** | Place and configure scene objects (hotspots, items, NPCs) on a canvas; set background image; define blocked zones and scale zones for pathfinding |
| **Event Editor** | Wire triggers (click, hover, enter/exit zone, keypress) to actions (navigate scene, play sound, show dialog, set variable, show/hide object, play animation, play cinematic) |
| **Assets Manager** | Import and manage image, audio, and video assets; generate images with AI |
| **Sprite Manager** | Create sprite sheets with named frames and frame-rate animations; generate sprites with AI |
| **Character Editor** | Define the main character and NPCs with idle/walk/talk animations and scene placements |
| **Cinematic Editor** | Build cutscenes from sequenced steps: walk\_to, talk, action, wait, show\_dialog, set\_variable, play\_sound |
| **UI Editor** | Design in-game UI overlays (text labels, buttons, images, progress bars, inventory slots) |
| **Stage Editor** | Organise game progress into named stages |
| **Goal Editor** | Define goals with variable-based conditions, logic operators, and completion actions |
| **Cursor Editor** | Customise cursor appearance per interaction state (default, hover, interact, walk) |
| **Title Screen Editor** | Configure the game title, logo, background, and menu buttons |
| **Settings Editor** | Set game metadata, player settings, and toggle optional features like AI image generation |
| **Preview** | Run the full game inside the editor using the same runtime engine used in exported games |
| **Export** | Package the project as a downloadable ZIP containing a self-contained Vite web project |

## Project Structure

```
src/
├── App.tsx                  # Root layout: SaveLoadBar + NavigationSidebar + active editor
├── components/
│   ├── AiGenerateModal.tsx  # Shared prompt → generate modal
│   ├── HelpButton.tsx       # Floating help overlay
│   ├── NavigationSidebar.tsx
│   └── SaveLoadBar.tsx
├── editors/                 # One directory per editor (see table above)
├── game-runtime/
│   ├── GameRuntime.ts       # In-editor game engine (TypeScript, uses Konva)
│   ├── standaloneEngine.ts  # Generates the engine.js embedded in exported ZIPs
│   ├── pathfinding.ts       # Grid-based A* with Minkowski obstacle inflation
│   └── generateZip.ts       # Builds the export ZIP via jszip
├── lib/
│   ├── fileSystemStorage.ts # Three-tier save/load (FSA API → download → localStorage)
│   └── aiImageGeneration.ts # OpenAI images API wrapper
├── store/
│   ├── useGameStore.ts      # All game project state (scenes, assets, events, …)
│   └── useAiStore.ts        # AI settings persisted to localStorage
└── types/
    └── index.ts             # All TypeScript interfaces (GameProject and sub-types)
```

## Data Model

The entire project is serialised as a single `GameProject` JSON object, which includes:

- `scenes` — canvas objects, background, blocked/scale zones
- `events` — trigger → action mappings
- `assets` — image, audio, and video files (stored as base64 data URLs)
- `spriteSheets` — frames and named animations
- `characters` — main character and NPCs with animation references
- `cinematics` — sequenced cutscene steps
- `uiElements` — HUD/overlay elements
- `stages` and `goals` — progress tracking and completion conditions
- `cursor` — per-state cursor images
- `titleScreen` — title configuration and menu buttons
- `settings` — game metadata and player-adjustable options

## AI Image Generation

AI generation is **disabled by default**. To enable it:

1. Open **Settings** in the sidebar.
2. Toggle **AI Image Generation** on and enter your OpenAI API key.
3. A purple **AI Generate** button (sparkles icon) appears in the Assets Manager image tab, the Sprite Manager header, and the Scene Editor background section.

The key is stored in `localStorage` only and is never written into the project file or the exported ZIP.

## Export

Click **Export** in the sidebar to download a ZIP. The ZIP contains a complete Vite project:

```
my-game/
├── package.json    # name/description from game settings
├── index.html
├── src/
│   ├── main.js     # bootstraps the standalone engine
│   ├── engine.js   # self-contained ES module — no external dependencies
│   └── game.json   # full GameProject data
└── vite.config.js
```

Run `npm install && npm run dev` inside the extracted folder to play the game.

## Saving and Loading

| Method | When used |
|---|---|
| File System Access API | Primary — browser prompts to pick a `.json` file; subsequent saves write directly |
| File download | Fallback when FSA API is unavailable |
| localStorage auto-save | Every 60 seconds in the background; survives accidental tab closure |
