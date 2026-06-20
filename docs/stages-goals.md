---
layout: default
title: Stages & Goals
nav_order: 7
---

# Stages & Goals

Stages and Goals let you structure game progression — defining chapters or acts and the conditions that must be met to advance through them.

---

## Stages

A **Stage** is an ordered chapter or act in your game. Stages give structure to longer adventures and let you group scenes and goals meaningfully.

### Creating a Stage

1. Open **Stage Editor** from the sidebar.
2. Click **+ Add Stage**.
3. Fill in:
   - **Name** — e.g., "Chapter 1: The Village"
   - **Description** — optional internal notes
   - **Starting Scene** — the scene that loads when this stage begins
   - **Scene List** — the scenes that belong to this stage

4. Use the up/down arrows to reorder stages. The game progresses through stages in listed order.

### How Stages Work at Runtime

- The game begins in Stage 1's starting scene.
- When a Goal in the current stage completes with action `advance_stage`, the next stage loads at its starting scene.
- Stages give goals a home — each goal belongs to exactly one stage.

---

## Goals

A **Goal** defines the win condition for a stage — what the player must accomplish to trigger an outcome (advance to the next stage, end the game, or show a message).

### Creating a Goal

1. Open **Goal Editor** from the sidebar.
2. Click **+ Add Goal**.
3. Choose the **Stage** this goal belongs to.
4. Give it a **Name** and **Description**.
5. Add one or more **Conditions** (see below).
6. Choose the **Logic** (AND / OR).
7. Choose the **Completion Action** and its value.

---

## Goal Conditions

Each condition checks one aspect of game state. Multiple conditions can be combined.

### variable_equals
Checks whether a game variable matches a value.

| Field | Description |
|---|---|
| **Target** | Variable name (set via `set_variable` events or cinematics) |
| **Operator** | equals / not_equals / greater_than / less_than / contains |
| **Value** | The value to compare against |

**Example:** `door_open` equals `true`

---

### scene_visited
Checks whether the player has entered a specific scene.

| Field | Description |
|---|---|
| **Target** | Scene ID |
| **Operator** | equals (visited) / not_equals (not yet visited) |

---

### item_collected
Checks whether a specific item has been collected. Items are tracked by their object ID.

| Field | Description |
|---|---|
| **Target** | Item object ID |
| **Operator** | equals `true` (collected) |

---

### event_triggered
Checks whether a specific event has fired at least once.

| Field | Description |
|---|---|
| **Target** | Event ID |
| **Operator** | equals `true` (fired) |

---

## Condition Logic

| Logic | Meaning |
|---|---|
| **AND** | All conditions must be true for the goal to complete |
| **OR** | Any single condition being true completes the goal |

---

## Completion Actions

When all required conditions are met, the goal triggers one of:

| Action | Description |
|---|---|
| **advance_stage** | Move to the next stage (loads its starting scene) |
| **end_game** | End the game (returns to title screen or shows credits) |
| **show_dialog** | Display a message to the player (value = dialog text) |

---

## Tips

- Most stages will have one primary goal with `advance_stage`, but you can add supplementary goals (optional sidequests) with `show_dialog` outcomes.
- Use `set_variable` in events and cinematics to feed `variable_equals` conditions — this is the most flexible way to track progress.
- Goals are evaluated continuously by the runtime. As soon as conditions are satisfied, the completion action fires.
