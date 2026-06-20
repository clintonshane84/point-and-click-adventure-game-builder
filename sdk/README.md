# Adventure Game Builder — Mini-Game SDK

This directory contains the contract and tooling for building external mini-games that plug into **Adventure Game Builder**.

---

## How it works

Mini-games are **self-contained ES modules** (`.js` files) that the builder loads at runtime using a `Blob URL` dynamic import. The builder:

1. Lazy-loads Phaser 3.80.1 from CDN (`window.Phaser`).
2. Imports your module.
3. Calls `module.launch(ctx)` passing a `MiniGameContext`.
4. When your game calls `ctx.onComplete(...)`, the builder destroys the overlay, merges any returned variables, sets `minigame_result`, and returns to the calling scene.

---

## Interface contract

See `minigame-sdk.d.ts` for the full TypeScript types.

### `MiniGameContext`

| Property | Type | Description |
|---|---|---|
| `canvas` | `HTMLCanvasElement` | The canvas to render into. Pass directly to Phaser config. |
| `Phaser` | `typeof Phaser` | Phaser 3 global (v3.80.1). |
| `assets` | `MiniGameAsset[]` | Project assets (images, audio, video). |
| `variables` | `Record<string,…>` | Snapshot of game variables at launch time. |
| `onComplete` | `(result, vars?) => void` | Call to finish. `result` must be `'win'`, `'lose'`, or `'exit'`. |

### `MiniGameModule` (your default export)

```js
export default {
  name: 'My Mini-Game',     // displayed in the editor
  version: '1.0.0',
  launch(ctx) {
    // set up Phaser, return { destroy() }
  }
}
```

---

## Writing a mini-game

```js
// my-minigame.js

/** @type {import('./minigame-sdk').MiniGameModule} */
export default {
  name: 'My Mini-Game',
  version: '1.0.0',

  launch(ctx) {
    const { canvas, Phaser, onComplete } = ctx

    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      canvas,           // IMPORTANT: use the provided canvas
      width: canvas.width || 800,
      height: canvas.height || 600,
      scene: {
        create() {
          // your game logic here …

          // When done:
          onComplete('win', { myVariable: 'value' })
        }
      }
    })

    return {
      destroy() {
        game.destroy(false)
      }
    }
  }
}
```

---

## Variable passing

After `onComplete`, the runtime automatically sets:
- `minigame_result` → `'win'` | `'lose'` | `'exit'`
- Any additional key/value pairs from the `updatedVariables` argument.

You can react to these with **Set Variable** conditions in goals or **Show Dialog** events that interpolate `{minigame_result}`.

---

## Testing

### In-editor Test Launch
1. Open **Mini-Games** in the sidebar.
2. Paste your source into the code area.
3. Click **Test Launch** — the mini-game opens in an overlay immediately.
4. Call `ctx.onComplete(...)` or click ✕ Exit to return.

### In-game Preview
1. Add a **Launch Mini-Game** action to any scene event.
2. Open **Preview Game**.
3. Trigger the event — mini-game launches over the game canvas.

### Exported ZIP
The builder writes each mini-game's source to `src/minigames/{id}.js` inside the exported ZIP. The exported `index.html` includes the Phaser CDN script in `<head>` so `window.Phaser` is available.

---

## Example

See `example-minigame.js` for a fully-commented "Click the Target" mini-game that demonstrates the complete lifecycle: setup, interactive gameplay, win/lose detection, variable passing, and clean `destroy()`.

---

## Tips

- **Always** pass `ctx.canvas` to Phaser — never create your own canvas.
- Call `game.destroy(false)` (not `true`) in `destroy()` to avoid removing the canvas from the DOM; the builder handles that.
- Keep your `onComplete` call inside the Phaser scene, not outside — Phaser re-uses the `canvas` context.
- Use `ctx.assets` to load project images/sounds via their `url` property inside Phaser's `preload()`.
- Mini-game modules are isolated (blob import) — you cannot import other project files.
