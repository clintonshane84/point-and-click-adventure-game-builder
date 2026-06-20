/**
 * Adventure Game Builder — Mini-Game
 * "Chase & Rescue — David and the Lion"
 *
 * USAGE:
 *   1. Open the Mini-Games editor in Adventure Game Builder.
 *   2. Click the library (book) icon → "Chase & Rescue — David and the Lion".
 *   3. Click "Test Launch" to play immediately.
 *
 * CONTROLS:
 *   PC     — Space or Up arrow to jump over obstacles
 *   Mobile — Tap anywhere to jump
 *
 * WIN CONDITION:
 *   Close the gap to 0 (catch the lion) before it reaches its den.
 *
 * LOSE CONDITIONS:
 *   The lion reaches its den (22 seconds), OR the gap becomes too large (you fall too far behind).
 *
 * SPRITE SLOTS (optional — assign in the Mini-Games editor):
 *   david_run  — David running animation  (sprite sheet, origin bottom-centre)
 *   david_jump — David jumping animation  (sprite sheet, origin bottom-centre)
 *   lion_run   — Lion running animation   (sprite sheet, origin bottom-centre)
 *   sheep      — Sheep sprite             (PNG or sheet, origin centre) — displayed in lion's mouth
 *   background — Scene background         (PNG, full canvas)
 *
 * Each slot may point to a different named animation on the same or different sprite sheets.
 * All slots fall back to procedural Phaser Graphics if no image is assigned.
 */

/** @type {import('./minigame-sdk').MiniGameModule} */
const ChaseRescue = {
  name: 'Chase & Rescue — David and the Lion',
  version: '1.0.0',

  launch(ctx) {
    const { canvas, Phaser, onComplete } = ctx
    const spriteMap    = ctx.spriteMap    || {}
    const spriteFrames = ctx.spriteFrames || {}

    const W = canvas.width  || 800
    const H = canvas.height || 600

    // ── Layout ───────────────────────────────────────────────────────────────
    const GROUND_Y  = H * 0.73
    const DAVID_X   = W * 0.20
    const PRED_X    = W * 0.72
    const HUD_H     = 52

    // ── Physics ───────────────────────────────────────────────────────────────
    const GRAVITY   = 850
    const JUMP_VEL  = -460

    // ── Chase mechanics ───────────────────────────────────────────────────────
    const BASE_SPEED  = 190     // obstacle scroll speed (px/s)
    const INITIAL_GAP = 280     // starting gap (px, conceptual)
    const MAX_GAP     = 480     // gap this large = lost
    const GAP_CLOSE   = 18      // px/s gap shrinks while running clean
    const GAP_PENALTY = 105     // gap increase per obstacle hit
    const DEN_SECS    = 22      // seconds until lion reaches den

    // ── State ─────────────────────────────────────────────────────────────────
    let gameState  = 'INTRO'   // INTRO | RUNNING | RESULT
    let davidY     = GROUND_Y
    let davidVelY  = 0
    let grounded   = true
    let animFrame  = 0          // 0 or 1 — running leg toggle
    let gap        = INITIAL_GAP
    let denProgress = 0         // 0 → 1
    let elapsed    = 0          // seconds since RUNNING started
    let stumbling  = false      // brief penalty window after hit
    let stumbleTimer = 0

    const obstacles = []        // { type, x, w, h, gfx, hit }
    let nextObstacleX = W + 180 // x when next obstacle should spawn

    // HUD graphic references (updated each frame)
    let gapBarFill, denBarFill
    let gapBarBg

    // Character graphics (cleared + redrawn each frame)
    let davidGfx, predGfx

    // Sprite objects (set in create() when spriteMap slots are provided)
    let davidRunSprite  = null   // visible when grounded
    let davidJumpSprite = null   // visible when airborne
    let lionRunSprite   = null
    let sheepSprite     = null

    // Mid-ground tree objects (scrolling parallax)
    const bgTrees = []

    // ── Obstacle type definitions ─────────────────────────────────────────────
    const OBS_DEFS = [
      { type: 'rock',   w: 38, h: 30 },
      { type: 'tree',   w: 24, h: 74 },
      { type: 'stream', w: 72, h: 10 },
    ]

    // ── Phaser config ─────────────────────────────────────────────────────────
    const config = {
      type:            Phaser.CANVAS,
      canvas,
      width:           W,
      height:          H,
      backgroundColor: '#1a2a1a',
      scene: { preload, create, update },
    }

    function preload() {
      function loadSlot(slot, texKey) {
        const sf = spriteFrames[slot]
        if (sf) {
          this.load.spritesheet(texKey, sf.url, { frameWidth: sf.frameWidth, frameHeight: sf.frameHeight })
        } else if (spriteMap[slot]) {
          this.load.image(texKey, spriteMap[slot])
        }
      }
      loadSlot.call(this, 'david_run',  'tex_david_run')
      loadSlot.call(this, 'david_jump', 'tex_david_jump')
      loadSlot.call(this, 'lion_run',   'tex_lion_run')
      loadSlot.call(this, 'sheep',      'tex_sheep')
      loadSlot.call(this, 'background', 'tex_bg')
    }

    // ── create ────────────────────────────────────────────────────────────────
    function create() {
      const scene = this

      // Background — sprite or procedural
      if (scene.textures.exists('tex_bg')) {
        scene.add.image(W / 2, H / 2, 'tex_bg').setDisplaySize(W, H).setDepth(0)
      } else {
        drawBackground(scene)
      }

      createBgTrees(scene)
      drawDenCave(scene)
      drawGround(scene)

      // Dynamic character graphics (depth 5 so they appear above ground/trees)
      davidGfx = scene.add.graphics().setDepth(5)
      predGfx  = scene.add.graphics().setDepth(5)

      // Sprite objects for characters (when provided via spriteMap slots)
      function makeAnimSprite(texKey, animKey, sfInfo, x, y, fallbackW, fallbackH) {
        if (!scene.textures.exists(texKey)) return null
        if (sfInfo) {
          const spr = scene.add.sprite(x, y, texKey).setOrigin(0.5, 1).setDepth(5)
          scene.anims.create({
            key:       animKey,
            frames:    scene.anims.generateFrameNumbers(texKey, { start: sfInfo.startFrame, end: sfInfo.endFrame }),
            frameRate: sfInfo.frameRate || 8,
            repeat:    sfInfo.loop ? -1 : 0,
          })
          spr.play(animKey)
          return spr
        } else {
          return scene.add.image(x, y, texKey)
            .setOrigin(0.5, 1).setDepth(5).setDisplaySize(fallbackW, fallbackH)
        }
      }

      davidRunSprite  = makeAnimSprite('tex_david_run',  'chase_david_run',  spriteFrames.david_run,  DAVID_X, GROUND_Y, 52, 80)
      davidJumpSprite = makeAnimSprite('tex_david_jump', 'chase_david_jump', spriteFrames.david_jump, DAVID_X, GROUND_Y, 52, 80)
      lionRunSprite   = makeAnimSprite('tex_lion_run',   'chase_lion_run',   spriteFrames.lion_run,   PRED_X,  GROUND_Y, 80, 56)

      // Jump sprite starts hidden — shown only when airborne
      if (davidJumpSprite) davidJumpSprite.setVisible(false)

      if (scene.textures.exists('tex_sheep')) {
        // Sheep is a static carried prop — show frame 0 if sprite sheet, full image otherwise
        sheepSprite = spriteFrames.sheep
          ? scene.add.sprite(PRED_X - 30, GROUND_Y - 30, 'tex_sheep', 0).setOrigin(0.5, 0.5).setDepth(5).setDisplaySize(28, 24)
          : scene.add.image(PRED_X - 30, GROUND_Y - 30, 'tex_sheep').setOrigin(0.5, 0.5).setDepth(5).setDisplaySize(28, 24)
      }

      // Draw initial poses
      drawDavid(scene)
      drawPredator(scene)

      // Running animation timer
      scene.time.addEvent({
        delay: 150,
        loop: true,
        callback: () => { animFrame = 1 - animFrame },
      })

      createHUD(scene)
      createIntroOverlay(scene)
      createExitButton(scene)
      setupInput(scene)
    }

    // ── update ────────────────────────────────────────────────────────────────
    function update(time, delta) {
      if (gameState !== 'RUNNING') return

      const dt = Math.min(delta / 1000, 0.05)
      elapsed += dt

      // David physics
      if (!grounded) {
        davidVelY += GRAVITY * dt
        davidY    += davidVelY * dt
        if (davidY >= GROUND_Y) {
          davidY    = GROUND_Y
          davidVelY = 0
          grounded  = true
          spawnDust(this, DAVID_X, GROUND_Y)
        }
      }

      // Gap closes naturally (stumbling halves the rate)
      const closeRate = stumbling ? GAP_CLOSE * 0.4 : GAP_CLOSE
      gap = Math.max(0, gap - closeRate * dt)

      // Stumble timer
      if (stumbling) {
        stumbleTimer -= dt
        if (stumbleTimer <= 0) stumbling = false
      }

      // Den progress
      denProgress = Math.min(1, elapsed / DEN_SECS)

      // Scroll mid-ground trees (parallax at 30%)
      for (const t of bgTrees) {
        t.x -= BASE_SPEED * 0.30 * dt
        if (t.x < -60) t.x += W + 260
        t.gfx.x = t.x
      }

      // Scroll and collision-check obstacles
      for (let i = obstacles.length - 1; i >= 0; i--) {
        if (gameState !== 'RUNNING') break
        const obs = obstacles[i]
        obs.x -= BASE_SPEED * dt
        obs.gfx.x = obs.x

        // Cull off left edge
        if (obs.x + obs.w < 0) {
          obs.gfx.destroy()
          obstacles.splice(i, 1)
          continue
        }

        // Collision
        if (!obs.hit) {
          const inX = DAVID_X + 10 > obs.x && DAVID_X - 10 < obs.x + obs.w
          let hit = false
          if (obs.type === 'stream') {
            hit = inX && grounded
          } else {
            const obsTopY = GROUND_Y - obs.h
            const davidTopY = davidY - 56
            hit = inX && davidY > obsTopY && davidTopY < GROUND_Y
          }
          if (hit) hitObstacle(this, obs)
        }
      }

      // Spawn new obstacle when tracker reaches screen
      nextObstacleX -= BASE_SPEED * dt
      if (nextObstacleX <= W) {
        spawnObstacle(this)
        const spacing = 230 + Math.random() * 220
        nextObstacleX = W + spacing
      }

      // Redraw characters
      drawDavid(this)
      drawPredator(this)

      // Update HUD bars
      updateHUD()

      // Win / lose checks
      if (gap <= 0) { endGame(this, 'win'); return }
      if (denProgress >= 1) { endGame(this, 'den'); return }
      if (gap >= MAX_GAP)   { endGame(this, 'far'); return }
    }

    // ── Obstacle management ───────────────────────────────────────────────────
    function spawnObstacle(scene) {
      const def = OBS_DEFS[Math.floor(Math.random() * OBS_DEFS.length)]
      const x   = W + 10
      const g   = scene.add.graphics().setDepth(4)
      g.x       = x

      if (def.type === 'rock') {
        g.fillStyle(0x7a7060, 1)
        g.fillEllipse(18, -10, def.w, def.h * 1.2)
        g.fillStyle(0x5a5040, 1)
        g.fillEllipse(20, -8, def.w * 0.6, def.h * 0.7)
      } else if (def.type === 'tree') {
        // Trunk
        g.fillStyle(0x5a3010, 1)
        g.fillRect(8, -def.h, 8, def.h)
        // Canopy
        g.fillStyle(0x2a5a10, 1)
        g.fillEllipse(12, -def.h - 14, 34, 30)
        g.fillEllipse(12, -def.h + 4,  28, 22)
      } else {
        // Stream — shallow blue strip at ground level
        g.fillStyle(0x3a7dc0, 0.85)
        g.fillRect(0, -8, def.w, 12)
        // Water ripple lines
        g.lineStyle(1, 0x6aadff, 0.5)
        g.lineBetween(6, -4, 14, -4)
        g.lineBetween(20, -2, 32, -2)
        g.lineBetween(42, -5, 58, -5)
      }

      g.y = GROUND_Y

      obstacles.push({ type: def.type, x, w: def.w, h: def.h, gfx: g, hit: false })
    }

    function hitObstacle(scene, obs) {
      obs.hit    = true
      gap       += GAP_PENALTY
      stumbling  = true
      stumbleTimer = 0.60

      // Red flash on David
      const flash = scene.add.rectangle(DAVID_X, davidY - 28, 28, 58, 0xff2222, 0.55)
        .setDepth(6)
      scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 350,
        ease: 'Sine.easeOut',
        onComplete: () => flash.destroy(),
      })

      // Camera shake
      scene.cameras.main.shake(200, 0.008)

      // Stumble text
      const tx = scene.add.text(DAVID_X, davidY - 70, 'STUMBLE!', {
        fontSize: '13px', color: '#ff4444', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(8)
      scene.tweens.add({
        targets: tx,
        y: davidY - 115,
        alpha: 0,
        duration: 600,
        ease: 'Sine.easeOut',
        onComplete: () => tx.destroy(),
      })
    }

    // ── Character drawing ──────────────────────────────────────────────────────
    function drawDavid(scene) {
      davidGfx.clear()

      if (davidRunSprite || davidJumpSprite) {
        const airborne = !grounded
        if (davidRunSprite) {
          davidRunSprite.y = davidY
          davidRunSprite.setVisible(!airborne)
          if (!(davidRunSprite instanceof Phaser.GameObjects.Sprite)) {
            davidRunSprite.setFlipX(animFrame === 1)
          }
        }
        if (davidJumpSprite) {
          davidJumpSprite.y = davidY
          davidJumpSprite.setVisible(airborne)
          if (!(davidJumpSprite instanceof Phaser.GameObjects.Sprite)) {
            davidJumpSprite.setFlipX(animFrame === 1)
          }
        } else if (davidRunSprite) {
          // No jump sprite: keep run sprite visible during jump too
          davidRunSprite.setVisible(true)
        }
        return
      }

      const x = DAVID_X
      const y = davidY
      const f = animFrame  // 0 or 1
      const air = !grounded

      // Shadow
      davidGfx.fillStyle(0x000000, 0.18)
      davidGfx.fillEllipse(x, GROUND_Y + 2, 28, 8)

      // Legs
      davidGfx.lineStyle(4, 0x3a2010, 1)
      if (air) {
        // Tuck legs
        davidGfx.lineBetween(x - 4, y - 8, x - 10, y - 22)
        davidGfx.lineBetween(x + 4, y - 8, x + 12, y - 18)
      } else if (f === 0) {
        davidGfx.lineBetween(x - 4, y - 8, x - 14, y)
        davidGfx.lineBetween(x + 4, y - 8, x + 10, y)
      } else {
        davidGfx.lineBetween(x - 4, y - 8, x - 10, y)
        davidGfx.lineBetween(x + 4, y - 8, x + 14, y)
      }

      // Tunic / body
      davidGfx.fillStyle(0x7a4020, 1)
      davidGfx.fillRect(x - 9, y - 42, 18, 34)

      // Belt
      davidGfx.fillStyle(0x3a2010, 1)
      davidGfx.fillRect(x - 9, y - 18, 18, 4)

      // Arms (running swing)
      davidGfx.lineStyle(4, 0xc4956a, 1)
      if (f === 0) {
        davidGfx.lineBetween(x - 9, y - 36, x - 18, y - 50)
        davidGfx.lineBetween(x + 9, y - 36, x + 18, y - 24)
      } else {
        davidGfx.lineBetween(x - 9, y - 36, x - 18, y - 24)
        davidGfx.lineBetween(x + 9, y - 36, x + 18, y - 50)
      }

      // Head
      davidGfx.fillStyle(0xc4956a, 1)
      davidGfx.fillCircle(x, y - 50, 12)

      // Hair / headband
      davidGfx.fillStyle(0x5a3010, 0.9)
      davidGfx.fillRect(x - 12, y - 62, 24, 6)
    }

    function drawPredator(scene) {
      predGfx.clear()

      if (lionRunSprite) {
        if (!(lionRunSprite instanceof Phaser.GameObjects.Sprite)) {
          lionRunSprite.setFlipX(animFrame === 1)
        }
        if (sheepSprite) {
          sheepSprite.x = PRED_X - 30
          sheepSprite.y = GROUND_Y - 30
        }
        return
      }

      const x = PRED_X
      const y = GROUND_Y
      const f = animFrame

      // Shadow
      predGfx.fillStyle(0x000000, 0.18)
      predGfx.fillEllipse(x, y + 2, 60, 10)

      // Sheep (dangling from mouth) — procedural only when no sheep sprite
      if (!sheepSprite) {
        predGfx.fillStyle(0xeeeeee, 1)
        predGfx.fillCircle(x - 28, y - 28, 10)
        predGfx.fillStyle(0xc8956a, 0.9)
        predGfx.fillCircle(x - 35, y - 22, 5)   // sheep head
        // Wool texture
        predGfx.fillStyle(0xdddddd, 0.7)
        predGfx.fillCircle(x - 24, y - 33, 6)
        predGfx.fillCircle(x - 32, y - 30, 5)
      } else {
        sheepSprite.x = x - 30
        sheepSprite.y = y - 30
      }

      // Legs
      predGfx.lineStyle(5, 0x8a5a00, 1)
      if (f === 0) {
        predGfx.lineBetween(x - 14, y - 14, x - 20, y)
        predGfx.lineBetween(x - 4,  y - 14, x - 2,  y)
        predGfx.lineBetween(x + 4,  y - 14, x + 6,  y)
        predGfx.lineBetween(x + 14, y - 14, x + 20, y)
      } else {
        predGfx.lineBetween(x - 14, y - 14, x - 8,  y)
        predGfx.lineBetween(x - 4,  y - 14, x - 16, y)
        predGfx.lineBetween(x + 4,  y - 14, x + 16, y)
        predGfx.lineBetween(x + 14, y - 14, x + 8,  y)
      }

      // Body
      predGfx.fillStyle(0xb8860b, 1)
      predGfx.fillEllipse(x, y - 24, 62, 32)

      // Mane (ring of circles)
      predGfx.fillStyle(0x7a5000, 0.85)
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2
        predGfx.fillCircle(x - 18 + Math.cos(ang) * 16, y - 42 + Math.sin(ang) * 12, 7)
      }

      // Head
      predGfx.fillStyle(0xb8860b, 1)
      predGfx.fillCircle(x - 18, y - 40, 18)

      // Eyes
      predGfx.fillStyle(0xff4400, 1)
      predGfx.fillCircle(x - 24, y - 44, 3)
      predGfx.fillCircle(x - 12, y - 44, 3)

      // Tail (curved up)
      predGfx.lineStyle(4, 0xb8860b, 1)
      predGfx.lineBetween(x + 28, y - 22, x + 38, y - 38)
      predGfx.fillStyle(0x8a5000, 1)
      predGfx.fillCircle(x + 38, y - 40, 6)
    }

    // ── Background ─────────────────────────────────────────────────────────────
    function drawBackground(scene) {
      const g = scene.add.graphics().setDepth(0)

      // Sky
      g.fillStyle(0x1a3a1a, 1)
      g.fillRect(0, 0, W, H * 0.55)
      g.fillStyle(0x2a5a28, 1)
      g.fillRect(0, H * 0.30, W, H * 0.28)

      // Sun
      g.fillStyle(0xffe060, 0.85)
      g.fillCircle(W * 0.80, H * 0.12, 28)
      g.fillStyle(0xffef90, 0.30)
      g.fillCircle(W * 0.80, H * 0.12, 42)

      // Distant hills
      g.fillStyle(0x3a5a2a, 1)
      const hillPts = [
        { x: 0,       y: H * 0.50 },
        { x: W * 0.10, y: H * 0.38 },
        { x: W * 0.22, y: H * 0.44 },
        { x: W * 0.38, y: H * 0.34 },
        { x: W * 0.52, y: H * 0.41 },
        { x: W * 0.68, y: H * 0.32 },
        { x: W * 0.80, y: H * 0.40 },
        { x: W,        y: H * 0.36 },
        { x: W,        y: H * 0.55 },
        { x: 0,        y: H * 0.55 },
      ]
      g.fillPoints(hillPts, true)
    }

    function createBgTrees(scene) {
      const positions = [60, 180, 310, 460, 590, 720]
      for (const startX of positions) {
        const g = scene.add.graphics().setDepth(1)
        const h = 55 + Math.random() * 30
        // Trunk
        g.fillStyle(0x4a2a08, 1)
        g.fillRect(-5, -h, 10, h)
        // Canopy layers
        g.fillStyle(0x1a4a10, 0.9)
        g.fillEllipse(0, -h - 10, 38, 28)
        g.fillStyle(0x2a6a18, 0.7)
        g.fillEllipse(-4, -h + 2, 30, 20)
        g.x = startX
        g.y = GROUND_Y
        bgTrees.push({ gfx: g, x: startX })
      }
    }

    function drawGround(scene) {
      const g = scene.add.graphics().setDepth(2)
      // Ground band
      g.fillStyle(0x4a3010, 1)
      g.fillRect(0, GROUND_Y, W, H - GROUND_Y)
      // Top edge
      g.fillStyle(0x5a6030, 1)
      g.fillRect(0, GROUND_Y, W, 6)
      // Texture lines
      g.lineStyle(1, 0x3a2808, 0.4)
      for (let y = GROUND_Y + 14; y < H; y += 16) {
        g.lineBetween(0, y, W, y)
      }
    }

    function drawDenCave(scene) {
      const g = scene.add.graphics().setDepth(3)
      const cx = W - 24
      const cy = GROUND_Y

      // Cave mouth
      g.fillStyle(0x0a0a0a, 1)
      g.fillRect(cx - 28, cy - 62, 56, 62)
      g.fillCircle(cx, cy - 62, 28)

      // Cave surround rocks
      g.fillStyle(0x5a4a3a, 1)
      g.fillEllipse(cx - 30, cy - 20, 24, 44)
      g.fillEllipse(cx + 30, cy - 18, 22, 40)
      g.fillEllipse(cx, cy - 78, 70, 28)

      // "DEN" label
      scene.add.text(cx, cy - 84, 'DEN', {
        fontSize: '11px', color: '#8a6a4a', fontStyle: 'bold',
      }).setOrigin(0.5, 1).setDepth(4)
    }

    // ── HUD ────────────────────────────────────────────────────────────────────
    function createHUD(scene) {
      const hudBg = scene.add.graphics().setDepth(9)
      hudBg.fillStyle(0x0a1008, 0.84)
      hudBg.fillRect(0, 0, W, HUD_H)
      hudBg.lineStyle(1, 0x2a4a18, 0.8)
      hudBg.lineBetween(0, HUD_H, W, HUD_H)

      // Distance (gap) bar — left side
      scene.add.text(16, HUD_H / 2, 'DISTANCE', {
        fontSize: '11px', color: '#94a3b8', fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(10)

      const barW = 140
      const barX = 96
      const barY = HUD_H / 2

      gapBarBg = scene.add.rectangle(barX + barW / 2, barY, barW, 12, 0x1e2a18, 1)
        .setOrigin(0.5).setDepth(10)

      gapBarFill = scene.add.rectangle(barX, barY, barW, 12, 0x22c55e, 1)
        .setOrigin(0, 0.5).setDepth(10)

      // Den progress bar — right side
      scene.add.text(W - 16, HUD_H / 2, 'DEN', {
        fontSize: '11px', color: '#94a3b8', fontStyle: 'bold',
      }).setOrigin(1, 0.5).setDepth(10)

      const denBarW = 130
      const denBarX = W - 60 - denBarW
      const denBarY = HUD_H / 2

      scene.add.rectangle(denBarX + denBarW / 2, denBarY, denBarW, 12, 0x1e2a18, 1)
        .setOrigin(0.5).setDepth(10)

      denBarFill = scene.add.rectangle(denBarX, denBarY, 2, 12, 0x4a1010, 1)
        .setOrigin(0, 0.5).setDepth(10)

      // Store bar metrics on objects for updateHUD
      gapBarFill._barW  = barW
      denBarFill._barW  = denBarW
    }

    function updateHUD() {
      // Gap bar: full = low gap (green), empty = large gap (red)
      const gapRatio = Math.max(0, 1 - gap / MAX_GAP)
      gapBarFill.setSize(Math.max(2, gapBarFill._barW * gapRatio), 12)
      const gapColor = gapRatio > 0.5 ? 0x22c55e : gapRatio > 0.25 ? 0xfacc15 : 0xef4444
      gapBarFill.setFillStyle(gapColor)

      // Den bar: fills up as den approaches
      const denRatio = Math.min(1, denProgress)
      denBarFill.setSize(Math.max(2, denBarFill._barW * denRatio), 12)
      const denColor = denRatio < 0.5 ? 0x4a1010 : denRatio < 0.80 ? 0xef4444 : 0xff2222
      denBarFill.setFillStyle(denColor)
    }

    // ── Intro overlay ──────────────────────────────────────────────────────────
    function createIntroOverlay(scene) {
      const cx = W / 2
      const cy = H / 2

      const bg = scene.add.rectangle(cx, cy, W * 0.68, H * 0.52, 0x000000, 0.85)
        .setOrigin(0.5).setDepth(12)

      const title = scene.add.text(cx, cy - H * 0.18, 'Chase & Rescue', {
        fontSize: '28px', color: '#fbbf24', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(13)

      const sub = scene.add.text(cx, cy - H * 0.08, 'David and the Lion', {
        fontSize: '17px', color: '#94a3b8',
      }).setOrigin(0.5).setDepth(13)

      const inst1 = scene.add.text(cx, cy + H * 0.02,
        'The lion seized a sheep — chase it down!', {
          fontSize: '13px', color: '#cbd5e1',
        }).setOrigin(0.5).setDepth(13)

      const inst2 = scene.add.text(cx, cy + H * 0.09,
        'SPACE / tap to jump over obstacles', {
          fontSize: '13px', color: '#cbd5e1',
        }).setOrigin(0.5).setDepth(13)

      const prompt = scene.add.text(cx, cy + H * 0.20, 'Click or tap to begin', {
        fontSize: '15px', color: '#4ade80', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(13)

      scene.tweens.add({
        targets: prompt, alpha: 0.15,
        duration: 650, yoyo: true, repeat: -1,
      })

      scene._introObjs = [bg, title, sub, inst1, inst2, prompt]
    }

    function startGame(scene) {
      if (gameState !== 'INTRO') return
      gameState = 'RUNNING'
      if (scene._introObjs) {
        scene._introObjs.forEach(o => o.destroy())
        scene._introObjs = null
      }
    }

    // ── Exit button ────────────────────────────────────────────────────────────
    function createExitButton(scene) {
      const btn = scene.add.text(W - 12, 10, '✕ Exit', {
        fontSize: '13px', color: '#94a3b8',
        backgroundColor: '#1e293b',
        padding: { x: 8, y: 4 },
      }).setOrigin(1, 0).setDepth(14).setInteractive({ cursor: 'pointer' })

      btn.on('pointerover', () => btn.setColor('#e2e8f0'))
      btn.on('pointerout',  () => btn.setColor('#94a3b8'))
      btn.on('pointerdown', () => onComplete('exit', { gap: Math.round(gap) }))
    }

    // ── Input ──────────────────────────────────────────────────────────────────
    function setupInput(scene) {
      const keys = scene.input.keyboard.addKeys('SPACE,UP')

      function doJump() {
        if (gameState === 'INTRO') { startGame(scene); return }
        if (gameState !== 'RUNNING') return
        if (grounded) {
          davidVelY = JUMP_VEL
          grounded  = false
          spawnDust(scene, DAVID_X, GROUND_Y)
        }
      }

      keys.SPACE.on('down', doJump)
      keys.UP.on('down', doJump)

      scene.input.on('pointerdown', (ptr) => {
        // Ignore clicks on the exit button area (top-right)
        if (ptr.x > W - 100 && ptr.y < 40) return
        doJump()
      })
    }

    // ── Dust particle ──────────────────────────────────────────────────────────
    function spawnDust(scene, x, y) {
      for (let i = 0; i < 3; i++) {
        const dx = (Math.random() - 0.5) * 20
        const d  = scene.add.graphics().setDepth(6)
        d.fillStyle(0xc4a35a, 0.6)
        d.fillCircle(x + dx, y, 4 + Math.random() * 4)
        scene.tweens.add({
          targets: d,
          alpha: 0,
          y: d.y - 14,
          duration: 380 + Math.random() * 200,
          ease: 'Sine.easeOut',
          onComplete: () => d.destroy(),
        })
      }
    }

    // ── End game ───────────────────────────────────────────────────────────────
    function endGame(scene, reason) {
      if (gameState === 'RESULT') return
      gameState = 'RESULT'

      // Clean up obstacles
      for (const obs of obstacles) obs.gfx.destroy()
      obstacles.length = 0

      const isWin = reason === 'win'
      const cx = W / 2
      const cy = H / 2

      const overlayColor = isWin ? 0x003300 : 0x330000
      scene.add.rectangle(cx, cy, W * 0.68, H * 0.46, overlayColor, 0.88)
        .setOrigin(0.5).setDepth(12)

      const titleMsg = isWin
        ? 'Caught it!  Sheep Saved!'
        : reason === 'den'
          ? 'The lion reached its den!'
          : 'Lost the trail!'
      const titleColor = isWin ? '#4ade80' : '#f87171'

      scene.add.text(cx, cy - H * 0.12, titleMsg, {
        fontSize: '24px', color: titleColor, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(13)

      const detail = isWin
        ? `Rescued in ${elapsed.toFixed(1)} seconds`
        : `Gap remaining: ${Math.round(gap)} units`
      scene.add.text(cx, cy - H * 0.02, detail, {
        fontSize: '14px', color: '#cbd5e1',
      }).setOrigin(0.5).setDepth(13)

      scene.add.text(cx, cy + H * 0.10, 'Returning to game…', {
        fontSize: '13px', color: '#64748b',
      }).setOrigin(0.5).setDepth(13)

      if (isWin) {
        // Briefly flash a golden glow
        const glow = scene.add.rectangle(cx, cy, W, H, 0xffd700, 0)
          .setDepth(11)
        scene.tweens.add({
          targets: glow, alpha: 0.18,
          duration: 300, yoyo: true,
          onComplete: () => glow.destroy(),
        })
      } else {
        scene.cameras.main.shake(250, 0.01)
      }

      scene.time.delayedCall(2400, () => {
        onComplete(isWin ? 'win' : 'lose', {
          gap: Math.round(gap),
          timeSecs: Math.round(elapsed),
        })
      })
    }

    // ── Launch ─────────────────────────────────────────────────────────────────
    const game = new Phaser.Game(config)

    return {
      destroy() { game.destroy(false) },
    }
  },
}

export default ChaseRescue
