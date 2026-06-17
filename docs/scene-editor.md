---
layout: default
title: Scene Editor
nav_order: 2
---

# Scene Editor

The Scene Editor is the central workspace where you design each scene in your game. Every scene is an independent canvas that can contain backgrounds, sprites, hotspots, items, and characters.

---

## Creating and Managing Scenes

- Click **+ New Scene** in the sidebar to create a scene.
- Click a scene name to make it active and open it in the editor.
- Rename a scene by clicking its title in the top bar.
- Scenes are listed in the left panel — drag to reorder, or delete unused ones.

---

## Scene Canvas

The canvas displays your scene at configurable zoom levels (0.25× – 4×). Use the zoom controls in the toolbar to zoom in for detail work.

The canvas size defaults to your game resolution (set in Settings). Objects placed outside the bounds will not be visible in-game.

---

## Object Types

Every thing you place on a scene canvas is a **Scene Object**. Each object has a type that controls its behaviour:

| Type | Description |
|---|---|
| **Background** | Full-scene backdrop; sits at the back of the z-order |
| **Sprite** | A static or animated image placed in the scene |
| **Hotspot** | An invisible (or semi-transparent) clickable region |
| **Character** | An NPC linked to a character definition |
| **Item** | A collectible or interactive prop |

### Adding Objects

1. Use the **Add Object** toolbar in the editor.
2. Select a type and give it a name.
3. The object appears in the centre of the canvas — drag it to position.

### Object Properties (right panel)

Select any object to edit its properties:

- **Name** — displayed in the event editor when wiring up triggers
- **Position (X, Y)** — pixel coordinates on the scene canvas
- **Size (W, H)** — width and height in pixels
- **Opacity** — 0 (invisible) to 1 (fully opaque)
- **Z-Index** — depth order; higher values draw on top
- **Visible** — toggle visibility at scene load time
- **Image / Sprite Sheet** — attach an asset or sprite frame

For **Character** objects, additional options appear:
- **NPC** — choose which NPC definition this object represents
- **Movement Instruction** — assign autonomous behaviour (see [Characters](characters))

---

## Background

Set the scene background by:

- Picking a **solid colour** with the colour picker.
- Uploading a **background image** from your Assets library.
- Using **AI Generate** (requires OpenAI key in Settings) to generate a background from a text prompt.

---

## Main Character Placement

Each scene stores where your **main character** starts:

1. Toggle the **Character Placement** panel.
2. Enable visibility for the scene.
3. Drag the character marker on the canvas, or type X/Y coordinates.
4. Set the default **facing direction** (up / down / left / right).

The character respects this position when the scene loads during gameplay.

---

## Pathfinding Zones

The pathfinding system uses a 16 px A* grid. Two zone types control how characters navigate a scene.

### Blocked Zones (Red)

Rectangles that characters cannot walk through.

- Click **Add Blocked Zone** to draw a new zone.
- Drag zone handles to resize.
- All characters (main hero and NPCs) are blocked by these zones.
- Zone size is compared against the character's **scaled** dimensions — a character scaled down inside a Scale Zone can fit through gaps that the full-size character cannot.

### Scale Zones (Green)

Rectangles that shrink characters and slow them down — creating the illusion of depth perspective.

| Property | Range | Effect |
|---|---|---|
| **Scale** | 0.1 – 1.0 | Character sprite size multiplier |
| **Speed Multiplier** | 0.1 – 1.0 | Walk speed multiplier inside the zone |

- Click **Add Scale Zone** to draw a zone.
- Characters (main hero and all NPCs with movement instructions) scale to the zone's `scale` value when their feet enter the zone, and return to full size when they leave.
- Scale is anchored at the **feet (bottom-centre)** so characters appear to shrink into the distance naturally.

---

## Layer Order

Objects render in ascending z-index order. The **main character** renders at a depth matching their Y position, so they appear in front of objects below them and behind objects above them automatically.

Use the z-index field on each object to fine-tune overlap behaviour.
