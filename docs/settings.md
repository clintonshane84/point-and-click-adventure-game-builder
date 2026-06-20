---
layout: default
title: Settings
nav_order: 12
---

# Settings

The Settings editor configures global properties for your game and the CAPAB authoring environment.

---

## Game Metadata

| Field | Description |
|---|---|
| **Title** | Game title (shown in the exported game's browser tab) |
| **Author** | Your name or studio name |
| **Version** | Version string (e.g., `1.0.0`) |
| **Description** | Short description of the game |

---

## Resolution

Set the pixel dimensions of the game canvas.

| Preset | Dimensions |
|---|---|
| HD | 1280 × 720 |
| Full HD | 1920 × 1080 |
| Custom | Enter any width and height |

The canvas scales to fit the browser window while maintaining the chosen aspect ratio. Scene objects and UI elements are positioned relative to this resolution, so pick one before laying out your scenes.

---

## Starting Scene

Choose which scene loads first when the game starts (after the title screen). This is separate from each stage's starting scene — it determines where a brand-new game begins.

---

## Save Slots

Set the number of save slots available to the player in the exported game. Common values are 1–3.

---

## Player Settings

Define custom settings that the player can adjust in-game (e.g., volume, difficulty, language). Each setting has:

| Field | Description |
|---|---|
| **Name** | Setting identifier |
| **Type** | `number`, `boolean`, or `string` |
| **Default Value** | Value used when the setting has not been changed |
| **Min / Max** | Minimum and maximum (for `number` type only) |

Player settings are accessible as game variables at runtime.

---

## AI Configuration

CAPAB integrates with OpenAI for image generation. To enable AI features:

1. Enter your **OpenAI API Key** in the AI section of Settings.
2. Toggle **AI Enabled** on.

Once enabled, **AI Generate** buttons appear in:
- Scene Editor (background images)
- Sprite Manager (sprite sheets)
- Assets Manager (images)

Generated images are stored as base64 data URLs inside your project file — no external hosting required.

{: .warning }
Your API key is saved in your browser's localStorage. Do not use CAPAB on a shared or public computer with your OpenAI key entered.
