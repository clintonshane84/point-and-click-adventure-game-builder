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
 * Per-slot animation info resolved when a sprite sheet + animation are both assigned
 * to a sprite slot in the Mini-Game editor.
 *
 * When present in `ctx.spriteFrames[slot]`, the slot is backed by a specific named
 * animation.  Load the texture with `this.load.spritesheet()` and create a Phaser
 * animation from `startFrame`→`endFrame`.
 *
 * When absent (slot has a sheet but no animation selected), only `ctx.spriteMap[slot]`
 * is populated — treat that URL as a plain image.
 */
export interface SpriteAnimInfo {
  /** The sprite-sheet image URL (same as `spriteMap[slot]`). */
  url:         string
  /** Width of each frame in the sprite strip (pixels). */
  frameWidth:  number
  /** Height of each frame in the sprite strip (pixels). */
  frameHeight: number
  /** Index of the first frame of this animation. */
  startFrame:  number
  /** Index of the last frame of this animation (inclusive). */
  endFrame:    number
  /** Playback speed in frames per second. */
  frameRate:   number
  /** Whether the animation loops continuously. */
  loop:        boolean
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
   * Use `ctx.spriteFrames[slot]` to check whether a named animation was also selected.
   */
  spriteMap: Record<string, string>

  /**
   * Full animation info for each slot where both a sprite sheet AND a named animation
   * were selected in the Mini-Game editor.  If a slot only has a sheet (no animation
   * selected), it appears in `spriteMap` but NOT here.
   *
   * Usage in preload():
   *   const info = ctx.spriteFrames['david_run']
   *   if (info) {
   *     // Load as sprite sheet so individual frames are addressable
   *     this.load.spritesheet('tex_david_run', info.url, {
   *       frameWidth: info.frameWidth, frameHeight: info.frameHeight
   *     })
   *   } else if (ctx.spriteMap['david_run']) {
   *     // Sheet assigned but no animation — use as plain image
   *     this.load.image('tex_david_run', ctx.spriteMap['david_run'])
   *   }
   *
   * Usage in create():
   *   const info = ctx.spriteFrames['david_run']
   *   if (info && scene.textures.exists('tex_david_run')) {
   *     scene.anims.create({
   *       key: 'david_run',
   *       frames: scene.anims.generateFrameNumbers('tex_david_run', {
   *         start: info.startFrame, end: info.endFrame
   *       }),
   *       frameRate: info.frameRate,
   *       repeat: info.loop ? -1 : 0,
   *     })
   *     scene.add.sprite(x, y, 'tex_david_run').play('david_run')
   *   }
   */
  spriteFrames: Record<string, SpriteAnimInfo>

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
