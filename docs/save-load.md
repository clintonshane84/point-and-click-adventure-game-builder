---
layout: default
title: Save & Load
nav_order: 14
---

# Save & Load

CAPAB uses a three-layer save system to protect your work. Your project is stored as a `.agb.json` file — a human-readable JSON file containing every scene, asset, character, event, and setting in your game.

---

## Saving Your Project

### File System Access (Recommended — Chrome / Edge)

On browsers that support the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) (Chrome and Edge), CAPAB can write directly to a file on your disk:

1. Click **Save** for the first time — a folder picker opens.
2. Choose a folder where your project file will live.
3. CAPAB writes `<project-name>.agb.json` into that folder.
4. On subsequent saves, the file is overwritten **silently** — no picker appears again.

The folder selection is remembered in your browser's IndexedDB, so it persists across sessions.

### Browser Download (Fallback — Firefox, Safari)

On browsers without the File System Access API, clicking **Save** triggers a browser file download. The file lands in your Downloads folder each time. Rename and organise it manually.

---

## Auto-Save

CAPAB auto-saves to **localStorage** every 60 seconds. This is a safety net — it does not replace the file save.

If you close the browser tab without saving and reopen CAPAB, a recovery banner will appear if a newer auto-save exists. Click **Restore** to recover your work, or **Dismiss** to ignore it.

In Chrome/Edge, the auto-save interval also silently writes to the previously chosen folder file (if permission is still held), keeping the on-disk file current.

---

## Loading a Project

### From a File

Click **Load** (or **Open Project**) to open a file picker. Select a `.agb.json` file and your project loads immediately.

### Recovering from Auto-Save

If an auto-save is newer than the last manual save, CAPAB will offer to restore it on startup. The recovery banner shows the timestamp of the auto-save.

---

## Project File Format

The `.agb.json` file is plain JSON. You can inspect and version-control it directly.

The top-level structure:

```json
{
  "id": "...",
  "name": "My Adventure Game",
  "createdAt": "...",
  "updatedAt": "...",
  "scenes": [...],
  "events": [...],
  "assets": [...],
  "spriteSheets": [...],
  "mainCharacter": {...},
  "npcs": [...],
  "cinematics": [...],
  "settings": {...},
  "titleScreen": {...},
  "stages": [...],
  "goals": [...],
  "cursorConfig": {...},
  "uiElements": [...]
}
```

Assets (images, audio) are stored as **base64 data URLs** inside the JSON, so a single `.agb.json` file contains everything — no separate asset folder needed.

{: .note }
Large projects with many high-resolution images can produce large `.agb.json` files. For best performance, optimise images before importing (compress PNGs, resize JPEGs to the display size they'll be used at).

---

## Tips

- Keep your `.agb.json` in a version-controlled folder (git, Dropbox, etc.) for history and backup.
- The file is safe to copy, rename, or share — it is entirely self-contained.
- If you share a project file with someone else, they can open it in their own CAPAB instance and continue editing immediately.
