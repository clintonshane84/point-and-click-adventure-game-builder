---
layout: default
title: Cinematic Editor
nav_order: 6
---

# Cinematic Editor

Cinematics are scripted cut-scene sequences. While a cinematic plays, normal player input is suspended and the runtime executes each step in order before handing control back to the player (or transitioning the game state).

Cinematics are triggered via the [Event Editor](events) using the `play_cinematic` action.

---

## Creating a Cinematic

1. Open **Cinematic Editor** from the sidebar.
2. Click **+ Add Cinematic**.
3. Give it a **Name** and optional **Description**.
4. Choose the **Scene** it runs in — characters are placed and movement is relative to that scene.
5. Add steps (see below).
6. Set the **Completion Action** (what happens after the last step finishes).

---

## Cinematic Steps

Steps execute sequentially, one after the other. Each step involves an optional character and one of the following types:

### walk_to
Move a character to a specific position using pathfinding.

| Field | Description |
|---|---|
| **Character** | `main-character` or an NPC id |
| **Target X / Y** | Destination pixel coordinates on the scene canvas |

The character pathfinds around blocked zones. Facing direction updates automatically based on movement direction.

---

### talk
Display a speech line associated with a character.

| Field | Description |
|---|---|
| **Character** | Who is speaking |
| **Text** | The dialogue line |

Waits for player acknowledgement (click/tap) before advancing to the next step.

---

### action
Display a short action label on screen (e.g., "attacks", "gives gift").

| Field | Description |
|---|---|
| **Character** | The acting character |
| **Action Label** | Short action description |

---

### wait
Pause for a fixed duration.

| Field | Description |
|---|---|
| **Duration** | Seconds to wait before advancing |

---

### show_dialog
Display a full-screen overlay text (not tied to a character).

| Field | Description |
|---|---|
| **Text** | Dialog or narration text |

Waits for player acknowledgement before advancing.

---

### set_variable
Set a game state variable mid-cinematic.

| Field | Description |
|---|---|
| **Variable** | `name=value` format (e.g., `gate_unlocked=true`) |

---

### play_sound
Play an audio asset.

| Field | Description |
|---|---|
| **Asset** | Select an audio asset from the library |

---

## Completion Actions

After the final step completes, one of the following happens:

| Action | Description |
|---|---|
| **return_to_game** | Resume normal gameplay in the current scene |
| **navigate_scene** | Transition to a different scene |
| **show_dialog** | Show a final dialog box before returning |
| **set_variable** | Set a variable, then return to gameplay |

---

## Tips

- Chain a `walk_to` + `talk` to have a character walk up before speaking.
- Use `set_variable` steps to track that a cinematic has been seen, then disable the triggering event so it doesn't replay.
- NPCs controlled by a cinematic override their autonomous movement for the duration — they resume their movement instruction afterwards.
- Use `wait` steps to time audio and action labels with each other.
