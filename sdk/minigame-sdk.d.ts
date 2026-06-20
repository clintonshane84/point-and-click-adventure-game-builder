/**
 * Adventure Game Builder — Mini-Game SDK
 * TypeScript interface contract for external mini-game modules.
 */

export interface MiniGameAsset {
  id: string
  name: string
  url: string
  type: string  // 'image' | 'audio' | 'video'
}

/**
 * Per-slot frame information provided when a sprite-sheet (not a plain image)
 * is assigned to a sprite slot in the Mini-Game editor.
 */
export interface SpriteFrameInfo {
  /** Width of each individual frame in pixels. */
  frameWidth: number
  /** Height of each individual frame in pixels. */
  frameHeight: number
  /** Total number of frames in the sprite sheet. */
  frameCount: number
}

/**
 * Context object provided by the builder when launching your mini-game.
 * Access via the `ctx` parameter of your `launch()` function.
 */
export interface MiniGameContext {
  /** The canvas element your game should render into. Pass this to Phaser config as `canvas`. */
  canvas: HTMLCanvasElement

  /** Phaser 3 global (version 3.80.1). Same as `window.Phaser`. */
  Phaser: typeof Phaser

  /** Project assets (images, sounds, videos) available to the mini-game. */
  assets: MiniGameAsset[]

  /**
   * Resolved sprite map: slotName → asset URL.
   * Slots are configured in the Mini-Game editor. If no asset is assigned to a slot, the key will be absent.
   * Example slots used by the Chase & Rescue game: 'david', 'lion', 'sheep', 'background'.
   *
   * When the slot is backed by a sprite sheet, the URL points to the full sprite-strip image.
   * Use `ctx.spriteFrames[slot]` to get frame dimensions for `this.load.spritesheet()`.
   */
  spriteMap: Record<string, string>

  /**
   * Frame info for each slot that was assigned a sprite sheet (rather than a plain image).
   * If a slot has no entry here, treat `spriteMap[slot]` as a plain image URL.
   *
   * Usage in preload():
   *   const sf = ctx.spriteFrames['david']
   *   if (sf) {
   *     this.load.spritesheet('spr_david', ctx.spriteMap['david'], {
   *       frameWidth: sf.frameWidth, frameHeight: sf.frameHeight
   *     })
   *   } else {
   *     this.load.image('spr_david', ctx.spriteMap['david'])
   *   }
   */
  spriteFrames: Record<string, SpriteFrameInfo>

  /** Current game variables at the time the mini-game was launched. Read-only — changes are not reflected back unless passed to onComplete. */
  variables: Record<string, string | number | boolean>

  /**
   * Call this when the mini-game is finished.
   * @param result  'win' | 'lose' | 'exit'
   * @param updatedVariables  Optional variables to merge back into the main game state.
   */
  onComplete(
    result: 'win' | 'lose' | 'exit',
    updatedVariables?: Record<string, string | number | boolean>
  ): void
}

/**
 * Returned by your `launch()` function. The builder calls `destroy()` automatically
 * after `onComplete` is invoked.
 */
export interface MiniGameInstance {
  destroy(): void
}

/**
 * The shape of your module's default export.
 *
 * @example
 * const myGame: MiniGameModule = {
 *   name: 'My Mini-Game',
 *   version: '1.0.0',
 *   launch(ctx) {
 *     // start Phaser, set up game …
 *     return { destroy() { game.destroy(false) } }
 *   }
 * }
 * export default myGame
 */
export interface MiniGameModule {
  name: string
  version: string
  launch(context: MiniGameContext): MiniGameInstance
}
