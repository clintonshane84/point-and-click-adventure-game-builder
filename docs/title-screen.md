---
layout: default
title: Title Screen Editor
nav_order: 10
---

# Title Screen Editor

The Title Screen Editor lets you design the main menu that players see when they launch your game.

---

## Background

Set the title screen backdrop:

- **Background Color** — pick a solid fill colour with the colour picker.
- **Background Image** — upload an image from your Assets library to use as the full-screen background.

If both are set, the image renders on top of the colour.

---

## Title Text

The large heading displayed at the top of the menu.

| Property | Description |
|---|---|
| **Title Text** | The main heading (typically your game's name) |
| **Font Size** | 16 – 120 px |
| **Color** | Text colour |

---

## Subtitle Text

A smaller line below the title — use it for a tagline, version number, or author credit.

| Property | Description |
|---|---|
| **Subtitle Text** | Secondary text |
| **Font Size** | Font size in pixels |
| **Color** | Text colour |

---

## Buttons

Buttons appear on the title screen for player actions. Typical buttons include "New Game", "Load Game", "Settings", and "Credits".

### Adding a Button

1. Click **+ Add Button**.
2. Enter a **Label** — the text shown on the button.
3. Enter an **Action** string — this is passed to the game engine when the button is clicked (e.g., `start_game`, `load_game`, `settings`).

### Reordering Buttons

Use the up/down arrow controls next to each button row to change the display order.

### Deleting a Button

Click the trash icon on the button row.

---

## Tips

- The game title set in **Settings** feeds into the game metadata but the **Title Text** field here controls what is displayed on-screen — they can differ.
- Use a high-contrast background image with dark/light text depending on the image tone.
- The action strings on buttons are consumed by the game runtime — the built-in actions are `start_game` and `load_game`. Any other string you define will be available for custom handling if you extend the exported engine.
