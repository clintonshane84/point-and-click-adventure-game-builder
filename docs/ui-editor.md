---
layout: default
title: UI Editor
nav_order: 9
---

# UI Editor

The UI Editor lets you design the in-game HUD (heads-up display) — the overlay layer that sits on top of the game scene. Use it for health bars, score displays, inventory slots, and action buttons.

---

## Canvas

The UI canvas uses a **1280 × 720** reference resolution. Elements placed here appear at the same relative positions regardless of the player's actual screen resolution.

---

## Element Types

| Type | Description |
|---|---|
| **Text** | A static or dynamic label |
| **Button** | A clickable button |
| **Image** | An image from the Assets library |
| **Progress Bar** | A fillable bar (health, mana, stamina, etc.) |
| **Inventory Slot** | A slot for displaying held items |

### Adding an Element

1. Click **+ Add Element** and choose a type.
2. The element appears in the centre of the canvas — drag it to position.
3. Use the properties panel on the right to configure it.

---

## Element Properties

All element types share these base properties:

| Property | Description |
|---|---|
| **Name** | Internal identifier |
| **X / Y** | Position in pixels (top-left of element) |
| **Width / Height** | Dimensions in pixels |
| **Content** | Text content or image asset ID |
| **Visible** | Show or hide at load time |
| **Z-Index** | Stacking order (higher = in front) |

### Style Properties

| Property | Description |
|---|---|
| **Color** | Text or foreground colour |
| **Background Color** | Fill colour |
| **Font Size** | Text size in pixels |
| **Border Radius** | Corner rounding (pixels) |
| **Border Color** | Outline colour |
| **Border Width** | Outline thickness (pixels) |
| **Opacity** | 0 (transparent) – 1 (opaque) |

---

## Tips

- Combine `show_object` and `hide_object` events to toggle UI elements dynamically during gameplay (e.g., show an item icon once it's collected).
- Use a **Progress Bar** element and drive its value via game variables to represent health or progress.
- Inventory Slot elements provide placeholder cells for an inventory grid — wire them up with events to track which items are held.
- Set an element's **Visible** to false at scene load if it should only appear after a specific event fires.
