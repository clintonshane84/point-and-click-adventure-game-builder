---
layout: default
title: Event Editor
nav_order: 5
---

# Event Editor

The Event Editor connects player interactions to game actions. Every interactive element in your game — a hotspot you click, a door you walk through, a key you press — is wired up here.

---

## Concepts

An **Event** has two parts:

| Part | Description |
|---|---|
| **Trigger** | What the player does to fire this event |
| **Actions** | What happens when the event fires (one or more, in order) |

Events are attached to a specific **object** in a specific **scene**.

---

## Creating an Event

1. Open the **Event Editor** from the sidebar.
2. Click **+ Add Event**.
3. Choose the **Scene** and **Object** this event is attached to.
4. Choose a **Trigger type** (see below).
5. Add one or more **Actions** (see below).
6. Toggle **Enabled** on/off to activate or disable the event without deleting it.

---

## Trigger Types

| Trigger | When it fires |
|---|---|
| **click** | Player clicks or taps the object |
| **hover** | Player moves the cursor over the object |
| **enter** | Player character walks into the object's bounding box |
| **exit** | Player character walks out of the object's bounding box |
| **keypress** | A specific keyboard key is pressed (value = key code) |

---

## Action Types

Actions execute in the order they appear. Each action can have an optional **delay** (in milliseconds) before it runs.

### navigate_scene
Transition to another scene.

- **Value:** Scene ID (pick from the dropdown)

---

### play_sound
Play an audio asset.

- **Value:** Asset ID of an audio file from the [Assets Manager](assets)

---

### show_dialog
Display a text overlay at the bottom of the screen.

- **Value:** The text to display

---

### set_variable
Set an arbitrary game state variable.

- **Value:** `variableName=variableValue` (e.g., `door_open=true`)

Variables can be checked in [Goal conditions](stages-goals) and referenced in [Cinematics](cinematics).

---

### show_object
Make a hidden scene object visible.

- **Value:** Object ID

---

### hide_object
Hide a visible scene object.

- **Value:** Object ID

---

### play_animation
Start playing a sprite animation on an object.

- **Value:** Object ID

---

### stop_animation
Stop a playing animation and return to the first frame.

- **Value:** Object ID

---

### play_cinematic
Trigger a [Cinematic sequence](cinematics).

- **Value:** Cinematic ID

---

## Action Delays

Each action has an optional **Delay (ms)** field. This delays the start of that specific action, counting from when the trigger fires. Use delays to stagger a sequence — for example:

1. `show_dialog` "The door creaks open..." — delay 0
2. `show_object` door-open-sprite — delay 1500
3. `play_sound` door-creak — delay 1500
4. `navigate_scene` inside-house — delay 3000

---

## Tips

- A single object can have multiple events (e.g., a `hover` event to change the cursor and a `click` event to trigger dialogue).
- Use `set_variable` + [Goal conditions](stages-goals) to track player progress without writing any code.
- Disable an event (toggle off) to temporarily deactivate it without losing its configuration — useful for events that should only fire after a goal is completed.
