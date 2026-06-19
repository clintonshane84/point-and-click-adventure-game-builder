/**
 * Adventure Game Builder — Example Mini-Game
 * "Click the Target" — a simple Phaser 3 mini-game.
 *
 * USAGE:
 *   1. Open the Mini-Games editor in Adventure Game Builder.
 *   2. Click "Add Mini-Game".
 *   3. Paste or upload this file as the source.
 *   4. Click "Test Launch" to try it immediately, or wire up a
 *      "Launch Mini-Game" event action in any scene.
 *
 * INTERFACE CONTRACT (see sdk/minigame-sdk.d.ts for full TypeScript types):
 *   - Default export must be an object with { name, version, launch }.
 *   - launch(ctx) receives a MiniGameContext and must return { destroy() }.
 *   - Call ctx.onComplete('win'|'lose'|'exit', optionalVars) to finish.
 *   - Pass ctx.canvas to Phaser's config so it renders inside the overlay.
 *   - ctx.Phaser is Phaser 3.80.1 — no separate import needed.
 */

/** @type {import('./minigame-sdk').MiniGameModule} */
const ClickTheTarget = {
  name: 'Click the Target',
  version: '1.0.0',

  launch(ctx) {
    const { canvas, Phaser, onComplete } = ctx

    // ── Phaser config ────────────────────────────────────────────────────────
    const config = {
      type: Phaser.CANVAS,
      canvas,           // render into the builder-provided canvas
      width: canvas.width || 800,
      height: canvas.height || 600,
      backgroundColor: '#1a1a2e',
      scene: {
        preload,
        create,
        update,
      },
    }

    // ── Scene state ──────────────────────────────────────────────────────────
    let timeLeft = 10
    let score = 0
    let timeText
    let scoreText
    let circle
    let gameOver = false

    function preload() { /* no external assets in this demo */ }

    function create() {
      const cx = this.scale.width / 2
      const cy = this.scale.height / 2

      // Title
      this.add.text(cx, 48, 'Click the Target!', {
        fontSize: '28px',
        color: '#e2e8f0',
        fontStyle: 'bold',
      }).setOrigin(0.5)

      // Score / timer labels
      scoreText = this.add.text(24, 90, 'Score: 0', {
        fontSize: '18px', color: '#94a3b8',
      })
      timeText = this.add.text(cx, 90, 'Time: 10', {
        fontSize: '18px', color: '#94a3b8',
      }).setOrigin(0.5)

      // Target circle
      circle = this.add.circle(cx, cy, 40, 0xe74c3c)
      circle.setInteractive()
      circle.on('pointerdown', () => {
        if (gameOver) return
        score++
        scoreText.setText('Score: ' + score)
        // Move target to a random position
        const margin = 60
        const nx = margin + Math.random() * (config.width - margin * 2)
        const ny = 120 + Math.random() * (config.height - 180)
        circle.setPosition(nx, ny)
      })

      // 10-second countdown
      this.time.addEvent({
        delay: 1000,
        repeat: 9,
        callback: () => {
          timeLeft--
          timeText.setText('Time: ' + timeLeft)
          if (timeLeft <= 0) {
            gameOver = true
            circle.disableInteractive()
            // Show result overlay
            const result = score >= 5 ? 'win' : 'lose'
            const msg = result === 'win'
              ? `You win!  Score: ${score}`
              : `Time's up!  Score: ${score}`
            this.add.rectangle(cx, cy, 320, 120, 0x000000, 0.8).setOrigin(0.5)
            this.add.text(cx, cy - 16, msg, {
              fontSize: '22px', color: '#e2e8f0', fontStyle: 'bold',
            }).setOrigin(0.5)
            this.add.text(cx, cy + 20, 'Click anywhere to continue', {
              fontSize: '14px', color: '#94a3b8',
            }).setOrigin(0.5)
            // Wait for a click, then signal completion
            this.input.once('pointerdown', () => {
              onComplete(result, { score })
            })
          }
        },
      })

      // Exit button (top-right)
      const exitBtn = this.add.text(config.width - 16, 16, '✕ Exit', {
        fontSize: '14px', color: '#94a3b8',
        backgroundColor: '#1e293b',
        padding: { x: 8, y: 4 },
      }).setOrigin(1, 0).setInteractive({ cursor: 'pointer' })
      exitBtn.on('pointerdown', () => onComplete('exit', { score }))
    }

    function update() { /* no per-frame logic needed */ }

    const game = new Phaser.Game(config)

    // ── MiniGameInstance ─────────────────────────────────────────────────────
    return {
      destroy() {
        game.destroy(false)   // false = don't remove the canvas from DOM
      },
    }
  },
}

export default ClickTheTarget
