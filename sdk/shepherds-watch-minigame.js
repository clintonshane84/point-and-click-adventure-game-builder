/**
 * Adventure Game Builder — Mini-Game
 * "Shepherd's Watch — Guard the Flock"
 *
 * USAGE:
 *   1. Open the Mini-Games editor in Adventure Game Builder.
 *   2. Click the library (book) icon → "Shepherd's Watch — Guard the Flock".
 *   3. Click "Test Launch" to play immediately.
 *
 * CONTROLS:
 *   PC     — Click the predator (lion or bear) before it reaches a sheep
 *   Mobile — Tap the predator to drive it away
 *
 * WIN CONDITION:
 *   Protect the flock for 60 seconds without losing 4 sheep.
 *
 * LOSE CONDITION:
 *   Four or more sheep are taken by predators.
 *
 * SPRITE SLOTS (optional — assign in the Mini-Games editor):
 *   background  — Pasture background (PNG, full canvas)
 *   sheep       — Sheep sprite       (PNG, ~36×30, origin centre)
 *   lion        — Lion predator      (PNG, ~60×52, origin centre)
 *   bear        — Bear predator      (PNG, ~64×54, origin centre)
 *   david       — David character    (PNG, shown on the result screen)
 *
 * All slots fall back to procedural Phaser Graphics if no image is assigned.
 */

/** @type {import('./minigame-sdk').MiniGameModule} */
const ShepherdsWatch = {
  name: "Shepherd's Watch — Guard the Flock",
  version: '1.1.0',

  launch(ctx) {
    const { canvas, Phaser, onComplete } = ctx
    const spriteMap = ctx.spriteMap || {}

    const W = canvas.width  || 800
    const H = canvas.height || 600

    // ── Layout ─────────────────────────────────────────────────────────────────
    const HUD_H       = 52
    const PASTURE_TOP = HUD_H + 8
    const PASTURE_BOT = H - 16
    const FLOCK_L     = W * 0.16
    const FLOCK_R     = W * 0.84
    const FLOCK_T     = PASTURE_TOP + 70
    const FLOCK_B     = PASTURE_BOT - 55

    // ── Game constants ──────────────────────────────────────────────────────────
    const TOTAL_SHEEP   = 10
    const MAX_LOST      = 4      // lose condition: this many sheep taken
    const GAME_SECS     = 60
    const MAX_PREDS     = 3      // max simultaneous predators

    // ── Difficulty (ms, ramps up) ───────────────────────────────────────────────
    let spawnIntervalMs = 2500
    let lungeBaseMs     = 2800   // lunge time at 480 px distance
    const SPAWN_MIN     = 850
    const LUNGE_MIN     = 1250
    const RAMP_EVERY    = 12     // seconds between difficulty steps
    let nextRamp        = RAMP_EVERY

    // ── State ──────────────────────────────────────────────────────────────────
    let gameState = 'INTRO'
    let sheepLost = 0
    let elapsed   = 0
    let spawnMs   = spawnIntervalMs   // countdown to next spawn

    const sheep = []    // { x, y, go, alive, targeted }
    const preds = []    // { type, go, tween, target, spawnX, spawnY, scared }

    // ── Phaser config ──────────────────────────────────────────────────────────
    const config = {
      type:            Phaser.CANVAS,
      canvas,
      width:           W,
      height:          H,
      backgroundColor: '#2d5a1a',
      scene: { preload, create, update },
    }

    function preload() {
      if (spriteMap.background) this.load.image('spr_bg',    spriteMap.background)
      if (spriteMap.sheep)      this.load.image('spr_sheep', spriteMap.sheep)
      if (spriteMap.lion)       this.load.image('spr_lion',  spriteMap.lion)
      if (spriteMap.bear)       this.load.image('spr_bear',  spriteMap.bear)
      if (spriteMap.david)      this.load.image('spr_david', spriteMap.david)
    }

    // ── create ─────────────────────────────────────────────────────────────────
    function create() {
      const scene = this

      if (scene.textures.exists('spr_bg')) {
        scene.add.image(W / 2, H / 2, 'spr_bg').setDisplaySize(W, H).setDepth(0)
      } else {
        drawPasture(scene)
      }

      drawBushesAndRocks(scene)
      placeSheep(scene)
      createHUD(scene)
      createIntroOverlay(scene)
      createExitButton(scene)
    }

    // ── update ─────────────────────────────────────────────────────────────────
    function update(time, delta) {
      if (gameState !== 'PLAYING') return
      const dt = delta / 1000
      elapsed += dt

      // Difficulty ramp
      if (elapsed >= nextRamp) {
        spawnIntervalMs = Math.max(SPAWN_MIN, spawnIntervalMs - 230)
        lungeBaseMs     = Math.max(LUNGE_MIN, lungeBaseMs     - 200)
        nextRamp       += RAMP_EVERY
      }

      // Spawn countdown
      spawnMs -= delta
      if (spawnMs <= 0) {
        spawnPredator(this)
        spawnMs = spawnIntervalMs
      }

      updateHUD()

      if (elapsed >= GAME_SECS) { endGame(this, 'win'); return }
    }

    // ── Sheep placement ────────────────────────────────────────────────────────
    function placeSheep(scene) {
      // 10 sheep in a loose two-row arrangement inside the flock bounds
      const rel = [
        [0.12, 0.18], [0.32, 0.12], [0.52, 0.18], [0.72, 0.12], [0.90, 0.20],
        [0.20, 0.68], [0.40, 0.75], [0.60, 0.68], [0.78, 0.75], [0.50, 0.44],
      ]
      for (let i = 0; i < TOTAL_SHEEP; i++) {
        const [rx, ry] = rel[i]
        const x = FLOCK_L + rx * (FLOCK_R - FLOCK_L)
        const y = FLOCK_T + ry * (FLOCK_B - FLOCK_T)
        const go = makeSheep(scene, x, y)
        sheep.push({ x, y, go, alive: true, targeted: false })
      }
    }

    function makeSheep(scene, x, y) {
      if (scene.textures.exists('spr_sheep')) {
        return scene.add.image(x, y, 'spr_sheep').setDisplaySize(36, 30).setDepth(3)
      }
      const g = scene.add.graphics().setDepth(3)
      drawSheepAt(g, x, y)
      return g
    }

    function drawSheepAt(g, x, y) {
      g.clear()
      // Body
      g.fillStyle(0xeeeeee, 1)
      g.fillEllipse(x, y + 2, 32, 22)
      // Wool bumps
      g.fillStyle(0xffffff, 0.85)
      g.fillCircle(x - 9, y - 5, 9)
      g.fillCircle(x + 1, y - 9, 8)
      g.fillCircle(x + 10, y - 4, 7)
      // Head
      g.fillStyle(0xddddc8, 1)
      g.fillCircle(x + 17, y - 1, 7)
      // Legs
      g.fillStyle(0xaaaaaa, 1)
      g.fillRect(x - 9,  y + 10, 4, 9)
      g.fillRect(x - 2,  y + 10, 4, 9)
      g.fillRect(x + 4,  y + 10, 4, 9)
      g.fillRect(x + 10, y + 10, 4, 9)
    }

    // ── Predator spawning ───────────────────────────────────────────────────────
    function spawnPredator(scene) {
      if (preds.length >= MAX_PREDS) return

      const free = sheep.filter(s => s.alive && !s.targeted)
      if (free.length === 0) return
      const target = free[Math.floor(Math.random() * free.length)]
      target.targeted = true

      // Spawn from a random edge (mostly left/right)
      const roll = Math.random()
      let spawnX, spawnY
      if (roll < 0.35) {
        spawnX = -65
        spawnY = PASTURE_TOP + Math.random() * (PASTURE_BOT - PASTURE_TOP)
      } else if (roll < 0.70) {
        spawnX = W + 65
        spawnY = PASTURE_TOP + Math.random() * (PASTURE_BOT - PASTURE_TOP)
      } else if (roll < 0.85) {
        spawnX = Math.random() * W
        spawnY = PASTURE_TOP - 65
      } else {
        spawnX = Math.random() * W
        spawnY = PASTURE_BOT + 65
      }

      const type = Math.random() < 0.55 ? 'lion' : 'bear'
      const go   = makePredator(scene, type, spawnX, spawnY)
      go.setDepth(6)

      const pred = { type, go, target, spawnX, spawnY, tween: null, scared: false }
      preds.push(pred)

      go.on('pointerdown', () => scarePredator(scene, pred))

      const dist     = Math.hypot(target.x - spawnX, target.y - spawnY)
      const duration = lungeBaseMs * (dist / 480)

      pred.tween = scene.tweens.add({
        targets: go,
        x: target.x,
        y: target.y,
        duration,
        ease: 'Sine.easeIn',
        onComplete: () => {
          if (gameState !== 'PLAYING') return
          captureSheep(scene, pred)
        },
      })
    }

    function makePredator(scene, type, x, y) {
      const sprKey = type === 'lion' ? 'spr_lion' : 'spr_bear'
      if (scene.textures.exists(sprKey)) {
        return scene.add.image(x, y, sprKey)
          .setDisplaySize(type === 'lion' ? 60 : 64, type === 'lion' ? 52 : 54)
          .setInteractive({ cursor: 'pointer' })
      }
      const g = scene.add.graphics()
      g.x = x; g.y = y
      drawPredatorShape(g, type)
      g.setInteractive({
        hitArea:         new Phaser.Geom.Circle(0, 0, 34),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        cursor:          'pointer',
      })
      return g
    }

    function drawPredatorShape(g, type) {
      g.clear()
      if (type === 'lion') {
        // Mane ring
        g.fillStyle(0x7a5000, 0.88)
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2
          g.fillCircle(Math.cos(ang) * 20, Math.sin(ang) * 16, 9)
        }
        // Body
        g.fillStyle(0xb8860b, 1)
        g.fillEllipse(10, 8, 50, 28)
        // Head
        g.fillCircle(-14, -4, 20)
        // Eyes
        g.fillStyle(0xff4400, 1)
        g.fillCircle(-20, -8, 3)
        g.fillCircle(-8,  -8, 3)
        // Tail
        g.lineStyle(4, 0xb8860b, 1)
        g.lineBetween(32, 4, 46, -14)
        g.fillStyle(0x8a5000, 1)
        g.fillCircle(47, -16, 6)
      } else {
        // Bear body
        g.fillStyle(0x5a3010, 1)
        g.fillEllipse(8, 6, 56, 38)
        // Head
        g.fillCircle(-16, -6, 22)
        // Ears
        g.fillStyle(0x3a1a08, 1)
        g.fillCircle(-26, -24, 9)
        g.fillCircle(-8,  -24, 9)
        // Eyes
        g.fillStyle(0xffe060, 1)
        g.fillCircle(-22, -10, 4)
        g.fillCircle(-10, -10, 4)
        g.fillStyle(0x000000, 1)
        g.fillCircle(-22, -10, 2)
        g.fillCircle(-10, -10, 2)
        // Claws
        g.fillStyle(0xffffff, 0.85)
        g.fillRect(22, 14, 5, 8)
        g.fillRect(28, 14, 5, 8)
      }
    }

    // ── Scare / capture ─────────────────────────────────────────────────────────
    function scarePredator(scene, pred) {
      if (pred.scared || gameState !== 'PLAYING') return
      pred.scared = true
      pred.tween?.stop()
      if (pred.target) pred.target.targeted = false

      // Brief scale burst, then flee back to spawn
      scene.tweens.add({
        targets: pred.go,
        scaleX: 1.6, scaleY: 1.6,
        duration: 90,
        yoyo: true,
        onComplete: () => {
          scene.tweens.add({
            targets: pred.go,
            x: pred.spawnX,
            y: pred.spawnY,
            duration: 480,
            ease: 'Sine.easeIn',
            onComplete: () => destroyPred(pred),
          })
        },
      })

      const tx = scene.add.text(pred.go.x, pred.go.y - 30, 'SCARED OFF!', {
        fontSize: '14px', color: '#4ade80', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(12)
      scene.tweens.add({
        targets: tx, y: tx.y - 52, alpha: 0, duration: 750,
        ease: 'Sine.easeOut', onComplete: () => tx.destroy(),
      })

      scene.cameras.main.flash(70, 40, 200, 40)
    }

    function captureSheep(scene, pred) {
      if (pred.scared || gameState !== 'PLAYING') return
      pred.scared = true

      const target = pred.target
      if (!target?.alive) {
        destroyPred(pred)
        return
      }

      target.alive    = false
      target.targeted = false
      sheepLost++

      // Drag sheep toward predator then fade out
      scene.tweens.add({
        targets: target.go,
        x: pred.go.x, y: pred.go.y,
        alpha: 0,
        duration: 380,
        ease: 'Sine.easeIn',
        onComplete: () => target.go.destroy(),
      })

      scene.cameras.main.shake(280, 0.012)

      const tx = scene.add.text(target.x, target.y - 16, 'TAKEN!', {
        fontSize: '16px', color: '#f87171', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(12)
      scene.tweens.add({
        targets: tx, y: tx.y - 52, alpha: 0, duration: 900,
        ease: 'Sine.easeOut', onComplete: () => tx.destroy(),
      })

      scene.time.delayedCall(380, () => {
        if (!pred.go.active) return
        scene.tweens.add({
          targets: pred.go,
          x: pred.spawnX, y: pred.spawnY,
          duration: 560,
          ease: 'Sine.easeOut',
          onComplete: () => destroyPred(pred),
        })
      })

      if (sheepLost >= MAX_LOST) {
        scene.time.delayedCall(650, () => endGame(scene, 'lose'))
      }
    }

    function destroyPred(pred) {
      if (pred.go.active) pred.go.destroy()
      const idx = preds.indexOf(pred)
      if (idx >= 0) preds.splice(idx, 1)
    }

    // ── Background ─────────────────────────────────────────────────────────────
    function drawPasture(scene) {
      const g = scene.add.graphics().setDepth(0)

      // Base green field
      g.fillStyle(0x3a7a22, 1)
      g.fillRect(0, 0, W, H)

      // Lighter central grazing area
      g.fillStyle(0x55a030, 0.75)
      g.fillRect(W * 0.06, PASTURE_TOP + 18, W * 0.88, PASTURE_BOT - PASTURE_TOP - 28)

      // Horizon hills
      g.fillStyle(0x4a8a28, 0.55)
      const pts = [
        { x: 0,       y: PASTURE_TOP + 65 },
        { x: W * 0.10, y: PASTURE_TOP + 22 },
        { x: W * 0.24, y: PASTURE_TOP + 48 },
        { x: W * 0.40, y: PASTURE_TOP + 12 },
        { x: W * 0.56, y: PASTURE_TOP + 36 },
        { x: W * 0.72, y: PASTURE_TOP + 14 },
        { x: W * 0.88, y: PASTURE_TOP + 42 },
        { x: W,        y: PASTURE_TOP + 30 },
        { x: W,        y: PASTURE_TOP + 70 },
        { x: 0,        y: PASTURE_TOP + 70 },
      ]
      g.fillPoints(pts, true)

      // Subtle grass-texture horizontal lines
      g.lineStyle(1, 0x2a6010, 0.22)
      for (let y = PASTURE_TOP + 30; y < PASTURE_BOT; y += 20) {
        g.lineBetween(0, y, W, y)
      }
    }

    function drawBushesAndRocks(scene) {
      const g = scene.add.graphics().setDepth(2)

      // Edge bushes (predator hiding spots)
      const bushes = [
        [12,    H * 0.32], [12,    H * 0.52], [12,    H * 0.70],
        [W - 12, H * 0.28], [W - 12, H * 0.50], [W - 12, H * 0.68],
        [W * 0.18, PASTURE_TOP + 4 ], [W * 0.52, PASTURE_TOP + 4 ], [W * 0.82, PASTURE_TOP + 4],
        [W * 0.12, PASTURE_BOT - 4 ], [W * 0.48, PASTURE_BOT - 4 ], [W * 0.80, PASTURE_BOT - 4],
      ]
      for (const [bx, by] of bushes) {
        g.fillStyle(0x1a4a10, 0.92)
        g.fillEllipse(bx, by, 46, 28)
        g.fillStyle(0x2a6a18, 0.72)
        g.fillEllipse(bx - 8, by - 5, 30, 18)
        g.fillStyle(0x3a8a22, 0.50)
        g.fillEllipse(bx + 6, by - 7, 22, 14)
      }

      // Scattered rocks
      const rocks = [
        [W * 0.08, H * 0.58, 28, 18], [W * 0.92, H * 0.42, 26, 16],
        [W * 0.28, PASTURE_TOP + 14, 22, 14], [W * 0.70, PASTURE_BOT - 8, 24, 15],
      ]
      for (const [rx, ry, rw, rh] of rocks) {
        g.fillStyle(0x7a6a5a, 1)
        g.fillEllipse(rx, ry, rw, rh)
        g.fillStyle(0x5a4a3a, 0.65)
        g.fillEllipse(rx + 3, ry - 3, rw * 0.5, rh * 0.6)
      }
    }

    // ── HUD ────────────────────────────────────────────────────────────────────
    let timerText, flockText

    function createHUD(scene) {
      const hg = scene.add.graphics().setDepth(9)
      hg.fillStyle(0x0a1008, 0.84)
      hg.fillRect(0, 0, W, HUD_H)
      hg.lineStyle(1, 0x2a4a18, 0.8)
      hg.lineBetween(0, HUD_H, W, HUD_H)

      scene.add.text(16, HUD_H / 2, 'Flock:', {
        fontSize: '12px', color: '#94a3b8', fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(10)

      flockText = scene.add.text(66, HUD_H / 2, flockLabel(), {
        fontSize: '13px', color: '#e2e8f0',
      }).setOrigin(0, 0.5).setDepth(10)

      timerText = scene.add.text(W / 2, HUD_H / 2, `${GAME_SECS}s`, {
        fontSize: '20px', color: '#fbbf24', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10)

      // Danger indicator — right side
      scene.add.text(W - 16, HUD_H / 2, `Lose if ${MAX_LOST} taken`, {
        fontSize: '11px', color: '#64748b',
      }).setOrigin(1, 0.5).setDepth(10)
    }

    function flockLabel() {
      return `${TOTAL_SHEEP - sheepLost} / ${TOTAL_SHEEP} safe`
    }

    function updateHUD() {
      flockText.setText(flockLabel())
      const secsLeft = Math.ceil(Math.max(0, GAME_SECS - elapsed))
      timerText.setText(`${secsLeft}s`)
      const frac = secsLeft / GAME_SECS
      timerText.setColor(frac > 0.40 ? '#fbbf24' : frac > 0.20 ? '#f97316' : '#ef4444')
    }

    // ── Intro overlay ──────────────────────────────────────────────────────────
    function createIntroOverlay(scene) {
      const cx = W / 2
      const cy = H / 2

      const objs = []

      objs.push(scene.add.rectangle(cx, cy, W * 0.72, H * 0.62, 0x000000, 0.87)
        .setOrigin(0.5).setDepth(12))

      objs.push(scene.add.text(cx, cy - H * 0.21, "Shepherd's Watch", {
        fontSize: '28px', color: '#fbbf24', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(13))

      objs.push(scene.add.text(cx, cy - H * 0.11, 'Guard the Flock', {
        fontSize: '17px', color: '#94a3b8',
      }).setOrigin(0.5).setDepth(13))

      objs.push(scene.add.text(cx, cy + H * 0.00, 'Lions and bears will lunge at your sheep!', {
        fontSize: '13px', color: '#cbd5e1',
      }).setOrigin(0.5).setDepth(13))

      objs.push(scene.add.text(cx, cy + H * 0.09, 'Click or tap the predator to drive it away.', {
        fontSize: '13px', color: '#cbd5e1',
      }).setOrigin(0.5).setDepth(13))

      objs.push(scene.add.text(cx, cy + H * 0.18, `Don't let ${MAX_LOST} sheep be taken!`, {
        fontSize: '13px', color: '#fca5a5',
      }).setOrigin(0.5).setDepth(13))

      const prompt = scene.add.text(cx, cy + H * 0.28, 'Click or tap to begin', {
        fontSize: '15px', color: '#4ade80', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(13)
      objs.push(prompt)
      scene.tweens.add({ targets: prompt, alpha: 0.20, duration: 600, yoyo: true, repeat: -1 })

      scene._introObjs = objs

      function onIntroClick(ptr) {
        if (gameState !== 'INTRO') return
        // Ignore exit button zone
        if (ptr.x > W - 105 && ptr.y < 42) return
        gameState = 'PLAYING'
        scene._introObjs?.forEach(o => o.destroy())
        scene._introObjs = null
        // First predator arrives quickly
        spawnMs = spawnIntervalMs * 0.35
        scene.input.off('pointerdown', onIntroClick)
      }
      scene.input.on('pointerdown', onIntroClick)
    }

    // ── Exit button ────────────────────────────────────────────────────────────
    function createExitButton(scene) {
      const btn = scene.add.text(W - 12, 10, 'Exit', {
        fontSize: '13px', color: '#94a3b8',
        backgroundColor: '#1e293b',
        padding: { x: 8, y: 4 },
      }).setOrigin(1, 0).setDepth(14).setInteractive({ cursor: 'pointer' })
      btn.on('pointerover', () => btn.setColor('#e2e8f0'))
      btn.on('pointerout',  () => btn.setColor('#94a3b8'))
      btn.on('pointerdown', () => onComplete('exit', { sheepLost }))
    }

    // ── End game ───────────────────────────────────────────────────────────────
    function endGame(scene, reason) {
      if (gameState === 'RESULT') return
      gameState = 'RESULT'

      // Stop and remove all active predators
      for (const p of preds) {
        p.tween?.stop()
        p.scared = true
        if (p.go.active) p.go.destroy()
        if (p.target) p.target.targeted = false
      }
      preds.length = 0

      const isWin = reason === 'win'
      const cx = W / 2
      const cy = H / 2

      scene.add.rectangle(cx, cy, W * 0.70, H * 0.52, isWin ? 0x003300 : 0x330000, 0.88)
        .setOrigin(0.5).setDepth(12)

      scene.add.text(cx, cy - H * 0.16, isWin ? 'Flock Protected!' : 'The Flock Was Scattered!', {
        fontSize: '26px', color: isWin ? '#4ade80' : '#f87171', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(13)

      const detail = isWin
        ? `You lost only ${sheepLost} of ${TOTAL_SHEEP} sheep`
        : `${sheepLost} sheep were taken by predators`
      scene.add.text(cx, cy - H * 0.04, detail, {
        fontSize: '14px', color: '#cbd5e1',
      }).setOrigin(0.5).setDepth(13)

      const survived = TOTAL_SHEEP - sheepLost
      scene.add.text(cx, cy + H * 0.06,
        isWin ? `${survived} sheep safe after ${Math.ceil(elapsed)}s` : '', {
          fontSize: '13px', color: '#86efac',
        }).setOrigin(0.5).setDepth(13)

      // David sprite on result screen if provided
      if (scene.textures.exists('spr_david')) {
        scene.add.image(cx + W * 0.26, cy + H * 0.04, 'spr_david')
          .setDisplaySize(56, 88).setDepth(13)
      }

      scene.add.text(cx, cy + H * 0.18, 'Returning to game…', {
        fontSize: '13px', color: '#64748b',
      }).setOrigin(0.5).setDepth(13)

      if (isWin) {
        scene.cameras.main.flash(450, 40, 180, 40)
      } else {
        scene.cameras.main.shake(350, 0.014)
      }

      scene.time.delayedCall(2600, () => {
        onComplete(isWin ? 'win' : 'lose', {
          sheepLost,
          timeSecs: Math.ceil(elapsed),
        })
      })
    }

    // ── Launch ─────────────────────────────────────────────────────────────────
    const game = new Phaser.Game(config)
    return { destroy() { game.destroy(false) } }
  },
}

export default ShepherdsWatch
