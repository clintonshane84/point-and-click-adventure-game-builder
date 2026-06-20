---
layout: default
title: Sprite Manager
nav_order: 4
---

# Sprite Manager

The Sprite Manager is where you import sprite sheets and define the named animations that bring characters and objects to life.

---

## Importing a Sprite Sheet

1. Click **+ Add Sprite Sheet**.
2. Either **upload an image** (PNG or JPG) or use **AI Generate** to create one from a text prompt (requires OpenAI key in Settings).
3. Enter a **name** for the sheet.
4. Set the **grid dimensions**:
   - **Rows** and **Cols** — how many rows and columns your sprite sheet is divided into.
   - Frame width and height are calculated automatically from the sheet dimensions.
5. CAPAB slices the sheet into frames numbered left-to-right, top-to-bottom (frame 0 is top-left).

---

## Sprite Sheet Properties

| Property | Description |
|---|---|
| **Name** | Identifier used in Character Editor and Scene Editor |
| **Rows / Cols** | Grid layout of the sheet |
| **Frame Width / Height** | Auto-calculated; read-only |
| **Total Frames** | rows × cols |

---

## Defining Animations

Each sprite sheet can have multiple named animations. An animation is a contiguous range of frames.

### Creating an Animation

1. Select a sprite sheet.
2. Click **+ Add Animation**.
3. Fill in:
   - **Name** — e.g., `walk-down`, `idle`, `attack`
   - **Start Frame** — index of the first frame (0-based)
   - **End Frame** — index of the last frame (inclusive)
   - **FPS** — playback speed in frames per second
   - **Loop** — whether the animation restarts after the last frame

### Previewing an Animation

The preview panel plays the animation in real time. Use it to verify frame ranges and speed before assigning to a character.

---

## Assigning Animations to Characters

Once animations are defined, go to the **Character Editor** and assign them per direction:

- Select a **Sprite Sheet** from the dropdown.
- Select an **Animation** from that sheet.
- Repeat for each of the four directions (up / down / left / right).

The game runtime automatically selects the correct animation based on the character's current movement direction.

---

## AI Sprite Generation

In the Sprite Manager, click **AI Generate** to open the generation modal.

1. Type a prompt describing the sprite or character you want.
2. Press **Generate** (or Ctrl + Enter).
3. The generated image is added directly to the Sprite Manager as a new sheet.
4. Adjust the row/col grid to slice it correctly.

See [Settings](settings) to configure your OpenAI API key.
