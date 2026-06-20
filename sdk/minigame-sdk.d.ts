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
