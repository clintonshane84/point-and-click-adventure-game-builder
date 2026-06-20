---
layout: default
title: Characters & NPCs
nav_order: 3
---

# Characters & NPCs

CAPAB supports one **main character** (the player's avatar) and any number of **NPC characters** (non-playable characters). Both are configured in the **Character Editor**.

---

## Main Character

The main character is the player-controlled hero. Click **Character** in the left sidebar to open the editor.

### Properties

| Property | Description |
|---|---|
| **Name** | Displayed in cinematics and dialogue |
| **Description** | Internal notes |
| **Width / Height** | Sprite dimensions in pixels |
| **Default Facing** | Direction the character faces when first placed |
| **Animations** | Sprite sheet animation per direction (up/down/left/right) |

### Assigning Animations

For each direction, choose:
1. **Sprite Sheet** — select from the Sprite Manager library
2. **Animation** — choose a named animation from that sheet

During gameplay the runtime automatically switches animations based on which direction the character is walking.

---

## NPC Characters

NPCs are defined in the same Character Editor — click **+ Add NPC** to create one.

NPC definitions share the same fields as the main character (name, dimensions, per-direction animations). Once defined, an NPC can be **placed** in a scene as a Character object and given a **Movement Instruction**.

---

## Placing an NPC in a Scene

1. Open the **Scene Editor**.
2. Add a new object of type **Character**.
3. In the right panel, choose the NPC from the **NPC** dropdown.
4. The object's width and height are automatically synced from the NPC definition.
5. Position the object on the canvas.
6. Set a **Movement Instruction** (see below).

---

## NPC Movement Instructions

Each character object in a scene can be given one of the following autonomous movement behaviours. The NPC movement engine runs every game frame.

### None
The NPC stands still at its placed position. Use this for static characters (shopkeepers, guards at a post) that you'll animate via [Cinematics](cinematics) or [Events](events).

---

### Roam — Slow & Eat Grass
Gentle, slow wandering. Suited to livestock or idle villagers.

- **Speed:** 50 px/sec
- **Wander distance:** 80 – 200 px per move
- **Idle pause:** 3 – 8 seconds between moves
- Pathfinds around blocked zones

---

### Roam — Human in Field
Purposeful, faster wandering. Suited to NPCs going about daily routines.

- **Speed:** 120 px/sec
- **Wander distance:** across the full scene
- **Idle pause:** 1 – 3 seconds between moves
- Pathfinds around blocked zones

---

### Follow Hero
The NPC pursues the player at a moderate pace and stops when close.

- **Speed:** 150 px/sec
- **Stop distance:** 80 px from player
- Recalculates path every 1.5 – 2.5 seconds
- Suited to companion animals, quest followers

---

### Follow & Attack Hero
Aggressive pursuit — the NPC chases and attacks when it catches up.

- **Speed:** 180 px/sec
- **Stop distance:** 40 px from player
- Sets the game variable `npc_attacked_<objectId>` to `true` on contact
- The attack fires once per scene load
- Use an [Event](events) trigger on that variable to handle game logic (e.g., reduce health, show dialogue)

---

## Scale & Pathfinding Behaviour

All characters — main hero and every NPC with a movement instruction — respect the scene's [pathfinding zones](scene-editor#pathfinding-zones):

- **Blocked Zones** prevent passage; the A* pathfinder routes around them.
- **Scale Zones** shrink the character's visual size and walk speed. Pathfinding uses the **scaled dimensions**, so a character that is 50% scale can pass through gaps that the full-size character cannot.

Scale is anchored at the character's **feet (bottom-centre)** to simulate depth perspective.
