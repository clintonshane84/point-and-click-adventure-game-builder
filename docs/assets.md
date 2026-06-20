---
layout: default
title: Assets Manager
nav_order: 8
---

# Assets Manager

The Assets Manager is your project's media library. All images, audio clips, and video files used in your game are stored here.

---

## Asset Types

| Tab | Accepted Formats | Used In |
|---|---|---|
| **Images** | PNG, JPG, GIF, WebP, SVG | Backgrounds, sprites, UI elements, cursor images |
| **Audio** | MP3, WAV, OGG, AAC | Event actions (`play_sound`), cinematic steps |
| **Video** | MP4, WebM, OGV | UI video elements |

---

## Importing Assets

### Upload from Disk

1. Select the tab for the asset type you want (Images / Audio / Video).
2. Click **Import Image** (or Audio / Video) in the top-right.
3. Select one or more files — multiple files can be selected at once.
4. The assets appear in the grid immediately.

You can also click the dashed **drop zone** in the centre of an empty tab to open the file picker.

### AI Generate (Images Only)

When an OpenAI API key is configured in [Settings](settings), an **AI Generate** button appears on the Images tab.

1. Click **AI Generate**.
2. Type a description of the image you want.
3. Press **Generate** (or Ctrl + Enter).
4. The generated image is added to your library as a PNG.

---

## Using Assets

Assets are referenced by ID throughout the editor:

- **Background images** — picked in the Scene Editor background panel
- **Object images** — assigned to sprite/item/hotspot objects in the Scene Editor
- **Sound effects** — selected in Event Editor `play_sound` actions and Cinematic `play_sound` steps
- **Cursor images** — uploaded directly in the [Cursor Editor](cursor) (which pulls from the images library)

---

## Deleting Assets

Hover over any asset card and click the **red trash icon** that appears in the corner. Deleting an asset removes it from the library — any scene objects or events that referenced it will lose their reference and fall back to a placeholder.

---

## Asset Metadata

Each card shows:

- A thumbnail preview (images) or type icon (audio/video)
- The file name
- File size (where available)

Counts per type are shown on the tab labels so you can see at a glance how many assets of each type you have.
