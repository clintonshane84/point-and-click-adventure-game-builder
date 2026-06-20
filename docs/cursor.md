---
layout: default
title: Cursor Editor
nav_order: 11
---

# Cursor Editor

The Cursor Editor lets you replace the browser's default cursor with custom images that change depending on what the player is doing.

---

## Cursor States

There are three cursor states:

| State | When it activates |
|---|---|
| **Default** | Normal — no object under the cursor |
| **Hover** | Cursor is over an interactive object (hotspot, item, character) |
| **Interact** | During active dialogue or a cinematic interaction |

Each state can have its own cursor image and hotspot position.

---

## Setting Up a Cursor State

1. Click a state tab (**Default**, **Hover**, or **Interact**).
2. Click **Upload Image** and choose a PNG or GIF from your files.
3. Set the **Hotspot** — the pixel within the cursor image that acts as the click point.

### Setting the Hotspot

Click anywhere on the cursor preview image to set the hotspot. The coordinates are shown below the preview (x, y from the top-left of the cursor image).

For a standard arrow cursor, the hotspot is typically (0, 0) — the tip of the arrow.  
For a crosshair, it would be the centre of the image.

---

## Live Preview

The preview panel shows the cursor at its current size and position. Move the cursor within the preview area to see how it tracks.

---

## Tips

- Use PNG images with transparency for the best results — the browser will composite them correctly over any background.
- Keep cursor images small (24 – 64 px) for performance and usability. Very large cursors can feel clunky.
- If no image is uploaded for a state, the browser's default cursor is used for that state.
- Animated GIF cursors are supported but may not animate in all browsers.
