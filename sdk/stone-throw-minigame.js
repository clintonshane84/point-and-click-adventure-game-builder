/**
 * Adventure Game Builder — Mini-Game
 * "David vs Goliath — Stone Throw"
 *
 * USAGE:
 *   1. Open the Mini-Games editor in Adventure Game Builder.
 *   2. Click "Add Mini-Game".
 *   3. Paste or upload this file as the source.
 *   4. Click "Test Launch" to try it, or wire a "Launch Mini-Game" action in any scene.
 *
 * CONTROLS:
 *   PC  — Move mouse in clockwise circles over the canvas to swing the sling.
 *          Left-click to release the stone.
 *   Mobile — Drag one finger in circles to swing.
 *            Tap a second finger to release.
 *
 * WIN CONDITION: Release when the power needle is in the GREEN zone (high speed).
 */

/** @type {import('./minigame-sdk').MiniGameModule} */
const StoneThrow = {
  name: 'David vs Goliath — Stone Throw',
  version: '1.0.0',

  launch(ctx) {
    const { canvas, Phaser, onComplete } = ctx

    const W = canvas.width  || 800
    const H = canvas.height || 600

    // ── Sling physics constants ──────────────────────────────────────────────
    const PIVOT_X   = W * 0.72   // player hand pivot
    const PIVOT_Y   = H * 0.80
    const ROPE_RX   = 90         // horizontal orbit radius
    const ROPE_RY   = Math.round(ROPE_RX * 0.47)  // vertical (perspective)

    // Power bar geometry (left side)
    const BAR_X  = 30
    const BAR_Y  = H * 0.30
    const BAR_W  = 22
    const BAR_H  = H * 0.38

    // Zone thresholds (fraction of bar from bottom = high power)
    const GREEN_THRESH  = 0.65
    const ORANGE_THRESH = 0.35

    // Angular velocity range (rad/s) that maps to 0→1 power
    const MIN_VEL = 1.5
    const MAX_VEL = 5.0

    // EMA factor for smoothing angular velocity (lower = smoother / more lag)
    const EMA_ALPHA = 0.12

    // ── State ────────────────────────────────────────────────────────────────
    let state          = 'INTRO'   // INTRO | SWINGING | THROWN | RESULT
    let slingAngle     = -Math.PI / 2
    let targetAngle    = -Math.PI / 2
    let angularVel     = 0         // smoothed rad/s
    let prevAngle      = slingAngle
    let prevTime       = 0
    let powerScore     = 0
    let releaseScore   = 0
    let mouseX         = PIVOT_X
    let mouseY         = PIVOT_Y - ROPE_RY - 10
    let primaryId      = null      // pointer id that is driving the sling
    let ropeGfx, barGfx, stoneGfx
    let stoneX, stoneY            // current stone world position (updated in update)
    let goliathTipTween = null

    // ── Phaser config ────────────────────────────────────────────────────────
    const config = {
      type:            Phaser.CANVAS,
      canvas,
      width:           W,
      height:          H,
      backgroundColor: '#1a2a4a',
      scene: { create, update },
    }

    // ── Helper: clamp ────────────────────────────────────────────────────────
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

    // ── Helper: shortest angle delta ─────────────────────────────────────────
    function angleDelta(a, b) {
      let d = ((b - a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI
      return d
    }

    // ── Scene: create ────────────────────────────────────────────────────────
    function create() {
      const scene = this

      drawBackground(scene)
      drawGoliath(scene)
      drawArm(scene)

      // Dynamic graphics layers (cleared each frame in update)
      ropeGfx  = scene.add.graphics()
      stoneGfx = scene.add.graphics()
      barGfx   = scene.add.graphics()

      drawPowerBarLabels(scene)
      createIntroOverlay(scene)
      createExitButton(scene)

      // Initial stone position
      stoneX = PIVOT_X + ROPE_RX * Math.cos(slingAngle)
      stoneY = PIVOT_Y + ROPE_RY * Math.sin(slingAngle)

      // ── Input ────────────────────────────────────────────────────────────
      scene.input.on('pointermove', (ptr) => {
        if (state !== 'SWINGING') return
        if (primaryId !== null && ptr.id !== primaryId) return
        if (primaryId === null) primaryId = ptr.id
        mouseX = ptr.x
        mouseY = ptr.y
      })

      scene.input.on('pointerdown', (ptr) => {
        if (state === 'INTRO') {
          startSwinging(scene)
          primaryId = ptr.id
          mouseX = ptr.x
          mouseY = ptr.y
          return
        }
        if (state !== 'SWINGING') return
        // PC: any click releases. Mobile: second pointer releases.
        if (primaryId === null || ptr.id === primaryId) {
          // First pointer — becomes primary if not set
          if (primaryId === null) {
            primaryId = ptr.id
            mouseX = ptr.x
            mouseY = ptr.y
          } else {
            // Same pointer as primary on PC = release
            releaseStone(scene)
          }
        } else {
          // Second pointer (mobile) = release
          releaseStone(scene)
        }
      })

      // PC left-click release (pointerup on primary)
      scene.input.on('pointerup', (ptr) => {
        if (state !== 'SWINGING') return
        if (ptr.id === primaryId) {
          releaseStone(scene)
        }
      })

      prevTime = scene.time.now
    }

    // ── Scene: update ────────────────────────────────────────────────────────
    function update(time) {
      if (state === 'SWINGING') {
        const dt = clamp((time - prevTime) / 1000, 0.001, 0.05)
        prevTime = time

        // Drive sling angle from mouse position relative to pivot
        const dx = mouseX - PIVOT_X
        const dy = mouseY - PIVOT_Y
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          targetAngle = Math.atan2(dy / ROPE_RY, dx / ROPE_RX)
        }

        // Lerp current angle toward target (smooth follow)
        const delta = angleDelta(slingAngle, targetAngle)
        slingAngle += delta * clamp(dt * 8, 0, 1)

        // Angular velocity (EMA)
        const rawVel = Math.abs(angleDelta(prevAngle, slingAngle)) / dt
        angularVel   = angularVel * (1 - EMA_ALPHA) + rawVel * EMA_ALPHA
        prevAngle    = slingAngle

        // Power score
        powerScore = clamp((angularVel - MIN_VEL) / (MAX_VEL - MIN_VEL), 0, 1)

        // Stone position on ellipse
        stoneX = PIVOT_X + ROPE_RX * Math.cos(slingAngle)
        stoneY = PIVOT_Y + ROPE_RY * Math.sin(slingAngle)

        drawRopeAndStone()
        drawPowerBar()
      }
    }

    // ── Background ───────────────────────────────────────────────────────────
    function drawBackground(scene) {
      const g = scene.add.graphics()

      // Sky — deep blue gradient via two large rects
      g.fillStyle(0x0d1b3e, 1)
      g.fillRect(0, 0, W, H * 0.55)
      g.fillStyle(0x1e3a6e, 1)
      g.fillRect(0, H * 0.30, W, H * 0.30)

      // Sun / light source (upper left)
      g.fillStyle(0xfff5c0, 0.7)
      g.fillCircle(W * 0.18, H * 0.12, 34)
      g.fillStyle(0xffec80, 0.3)
      g.fillCircle(W * 0.18, H * 0.12, 52)

      // Rolling distant hills
      g.fillStyle(0x2d5a27, 1)
      const hills = [
        [0, H * 0.56, W * 0.18, H * 0.46, W * 0.36, H * 0.52,
         W * 0.55, H * 0.42, W * 0.72, H * 0.50, W, H * 0.47, W, H * 0.62, 0, H * 0.62],
      ]
      g.fillPoints(hills[0].reduce((acc, v, i) =>
        i % 2 === 0 ? acc.concat({ x: v, y: hills[0][i + 1] }) : acc, []), true)

      // Mid-ground earth band
      g.fillStyle(0x8b6f47, 1)
      g.fillRect(0, H * 0.60, W, H * 0.10)

      // Dusty ground (bottom 30%)
      g.fillStyle(0xc4a35a, 1)
      g.fillRect(0, H * 0.68, W, H * 0.32)

      // Ground texture lines
      g.lineStyle(1, 0xa8883c, 0.4)
      for (let yy = H * 0.72; yy < H; yy += 18) {
        g.lineBetween(0, yy, W, yy)
      }

      // Rocks
      g.fillStyle(0x9e8b6b, 1)
      const rocks = [[W*0.05,H*0.76,22,12],[W*0.88,H*0.80,16,9],[W*0.62,H*0.73,12,7]]
      rocks.forEach(([rx,ry,rw,rh]) => g.fillEllipse(rx,ry,rw,rh))
    }

    // ── Goliath silhouette ───────────────────────────────────────────────────
    function drawGoliath(scene) {
      const g = scene.add.graphics()
      const gx = W * 0.50   // center x
      const gy = H * 0.58   // feet y
      const scale = H * 0.34 / 200  // normalize to 200 px height

      function px(x, y) { return { x: gx + x * scale, y: gy - y * scale } }

      // Body color
      const BODY  = 0x3a2a1e
      const ARMOR = 0x5a4a3e
      const METAL = 0x7a8a9a

      // Legs
      g.fillStyle(BODY, 1)
      g.fillRect(px(-18, 0).x, px(0, 80).y, 16 * scale, 80 * scale)
      g.fillRect(px(2,  0).x, px(2, 80).y, 16 * scale, 80 * scale)

      // Torso (armored)
      g.fillStyle(ARMOR, 1)
      g.fillRect(px(-26, 80).x, px(-26, 160).y, 52 * scale, 80 * scale)

      // Scale armor lines on torso
      g.lineStyle(1, 0x4a3a2e, 0.8)
      for (let row = 0; row < 5; row++) {
        const yy = px(0, 88 + row * 14).y
        g.lineBetween(px(-26, 0).x, yy, px(26, 0).x, yy)
      }

      // Left arm (shield side — toward viewer left)
      g.fillStyle(BODY, 1)
      g.fillRect(px(-38, 100).x, px(-38, 160).y, 12 * scale, 60 * scale)

      // Shield (large round on left arm)
      g.fillStyle(METAL, 1)
      g.fillCircle(px(-48, 120).x, px(-48, 120).y, 28 * scale)
      g.lineStyle(2, 0x9aacbc, 1)
      g.strokeCircle(px(-48, 120).x, px(-48, 120).y, 28 * scale)
      // Shield boss
      g.fillStyle(0xc0b030, 1)
      g.fillCircle(px(-48, 120).x, px(-48, 120).y, 6 * scale)

      // Right arm (spear side)
      g.fillStyle(BODY, 1)
      g.fillRect(px(26, 100).x, px(26, 160).y, 12 * scale, 60 * scale)

      // Spear shaft
      g.lineStyle(3, 0x6b4a2a, 1)
      g.lineBetween(px(32, 60).x, px(32, 60).y, px(32, 230).x, px(32, 230).y)

      // Spear head
      g.fillStyle(METAL, 1)
      const spearTip = px(32, 230)
      g.fillTriangle(
        spearTip.x - 5 * scale, spearTip.y,
        spearTip.x + 5 * scale, spearTip.y,
        spearTip.x,              spearTip.y - 22 * scale
      )

      // Neck
      g.fillStyle(BODY, 1)
      g.fillRect(px(-8, 156).x, px(-8, 180).y, 16 * scale, 24 * scale)

      // Head
      g.fillStyle(BODY, 1)
      g.fillCircle(px(0, 192).x, px(0, 192).y, 22 * scale)

      // Helmet
      g.fillStyle(METAL, 1)
      g.fillRect(px(-22, 186).x, px(-22, 210).y, 44 * scale, 24 * scale)
      // Helmet crest
      g.fillStyle(0xcc2200, 1)
      g.fillRect(px(-4, 206).x, px(-4, 218).y, 8 * scale, 12 * scale)

      // Eyes (two small dots, slightly menacing)
      g.fillStyle(0xff3300, 1)
      g.fillCircle(px(-7, 190).x, px(-7, 190).y, 3 * scale)
      g.fillCircle(px( 7, 190).x, px( 7, 190).y, 3 * scale)
    }

    // ── Player arm / grip ────────────────────────────────────────────────────
    function drawArm(scene) {
      const g = scene.add.graphics()

      // Arm: thick curved path from bottom-right toward pivot
      g.lineStyle(14, 0xc8956a, 1)
      const armCurve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(W, H),
        new Phaser.Math.Vector2(W * 0.88, H * 0.92),
        new Phaser.Math.Vector2(PIVOT_X + 10, PIVOT_Y + 8)
      )
      const armPts = armCurve.getPoints(20)
      g.strokePoints(armPts, false)

      // Sleeve/tunic detail
      g.lineStyle(4, 0x7a5030, 0.6)
      g.strokePoints(armPts.slice(0, 12), false)

      // Hand (small filled circle at pivot)
      g.fillStyle(0xc8956a, 1)
      g.fillCircle(PIVOT_X, PIVOT_Y, 10)
      g.lineStyle(2, 0x8a6040, 1)
      g.strokeCircle(PIVOT_X, PIVOT_Y, 10)
    }

    // ── Rope + stone (redrawn each frame) ────────────────────────────────────
    function drawRopeAndStone() {
      ropeGfx.clear()
      stoneGfx.clear()

      // Two rope lines from pivot (slightly offset) to stone pouch
      ropeGfx.lineStyle(2, 0xc8a46e, 0.9)
      ropeGfx.lineBetween(PIVOT_X - 4, PIVOT_Y, stoneX, stoneY)
      ropeGfx.lineBetween(PIVOT_X + 4, PIVOT_Y, stoneX, stoneY)

      // Pouch (small ellipse around stone)
      ropeGfx.lineStyle(1, 0xa08050, 0.7)
      ropeGfx.strokeEllipse(stoneX, stoneY, 20, 14)

      // Stone
      stoneGfx.fillStyle(0x999999, 1)
      stoneGfx.fillCircle(stoneX, stoneY, 8)
      stoneGfx.lineStyle(1, 0x666666, 1)
      stoneGfx.strokeCircle(stoneX, stoneY, 8)
    }

    // ── Power bar ─────────────────────────────────────────────────────────────
    function drawPowerBarLabels(scene) {
      const lx = BAR_X + BAR_W + 6
      scene.add.text(BAR_X - 2, BAR_Y - 22, 'POWER', {
        fontSize: '11px', color: '#94a3b8', fontStyle: 'bold',
      })
      scene.add.text(lx, BAR_Y,                        'RED',    { fontSize: '9px', color: '#ef4444' })
      scene.add.text(lx, BAR_Y + BAR_H * 0.35,        'ORANGE', { fontSize: '9px', color: '#f97316' })
      scene.add.text(lx, BAR_Y + BAR_H * 0.65,        'GREEN',  { fontSize: '9px', color: '#22c55e' })
    }

    function drawPowerBar() {
      barGfx.clear()

      // Bar background
      barGfx.fillStyle(0x1e293b, 0.85)
      barGfx.fillRect(BAR_X, BAR_Y, BAR_W, BAR_H)

      // Zones (top = red = low power, bottom = green = high power)
      const redH    = BAR_H * (1 - GREEN_THRESH)   // top portion
      const orangeH = BAR_H * (GREEN_THRESH - ORANGE_THRESH)
      const greenH  = BAR_H * ORANGE_THRESH

      barGfx.fillStyle(0xef4444, 1)
      barGfx.fillRect(BAR_X, BAR_Y, BAR_W, redH)

      barGfx.fillStyle(0xf97316, 1)
      barGfx.fillRect(BAR_X, BAR_Y + redH, BAR_W, orangeH)

      barGfx.fillStyle(0x22c55e, 1)
      barGfx.fillRect(BAR_X, BAR_Y + redH + orangeH, BAR_W, greenH)

      // Bar border
      barGfx.lineStyle(1, 0x475569, 1)
      barGfx.strokeRect(BAR_X, BAR_Y, BAR_W, BAR_H)

      // Needle (horizontal line; high power = needle near bottom = green)
      const needleY = BAR_Y + BAR_H * (1 - powerScore)
      barGfx.lineStyle(2, 0xffffff, 1)
      barGfx.lineBetween(BAR_X - 3, needleY, BAR_X + BAR_W + 3, needleY)

      // Small triangle indicator on left of needle
      barGfx.fillStyle(0xffffff, 1)
      barGfx.fillTriangle(
        BAR_X - 10, needleY - 4,
        BAR_X - 10, needleY + 4,
        BAR_X - 3,  needleY
      )
    }

    // ── Intro overlay ─────────────────────────────────────────────────────────
    function createIntroOverlay(scene) {
      const cx = W / 2
      const cy = H / 2

      const bg = scene.add.rectangle(cx, cy, W * 0.70, H * 0.52, 0x000000, 0.82)
        .setOrigin(0.5)

      const title = scene.add.text(cx, cy - H * 0.18, 'David vs Goliath', {
        fontSize: '28px', color: '#f8e46a', fontStyle: 'bold',
      }).setOrigin(0.5)

      const sub = scene.add.text(cx, cy - H * 0.07, 'Stone Throw', {
        fontSize: '18px', color: '#94a3b8',
      }).setOrigin(0.5)

      const inst1 = scene.add.text(cx, cy + H * 0.03,
        'Move your mouse in circles to swing the sling', {
          fontSize: '13px', color: '#cbd5e1',
        }).setOrigin(0.5)

      const inst2 = scene.add.text(cx, cy + H * 0.09,
        'Release (click / tap 2nd finger) when POWER is in GREEN zone', {
          fontSize: '13px', color: '#cbd5e1',
        }).setOrigin(0.5)

      const prompt = scene.add.text(cx, cy + H * 0.20, 'Click or tap to begin', {
        fontSize: '15px', color: '#22c55e', fontStyle: 'bold',
      }).setOrigin(0.5)

      // Pulse the prompt
      scene.tweens.add({
        targets: prompt,
        alpha: 0.2,
        duration: 700,
        yoyo: true,
        repeat: -1,
      })

      // Group for easy destroy
      scene._introObjects = [bg, title, sub, inst1, inst2, prompt]
    }

    function startSwinging(scene) {
      state = 'SWINGING'
      // Destroy intro UI
      if (scene._introObjects) {
        scene._introObjects.forEach(o => o.destroy())
        scene._introObjects = null
      }
      prevTime = scene.time.now
      prevAngle = slingAngle
    }

    // ── Exit button ───────────────────────────────────────────────────────────
    function createExitButton(scene) {
      const btn = scene.add.text(W - 12, 12, '✕ Exit', {
        fontSize: '13px', color: '#94a3b8',
        backgroundColor: '#1e293b',
        padding: { x: 8, y: 4 },
      }).setOrigin(1, 0).setInteractive({ cursor: 'pointer' }).setDepth(10)

      btn.on('pointerover', () => btn.setColor('#e2e8f0'))
      btn.on('pointerout',  () => btn.setColor('#94a3b8'))
      btn.on('pointerdown', () => onComplete('exit', { slingPower: releaseScore }))
    }

    // ── Release stone ─────────────────────────────────────────────────────────
    function releaseStone(scene) {
      if (state !== 'SWINGING') return
      state = 'THROWN'
      releaseScore = powerScore

      // Stop dynamic drawing
      ropeGfx.clear()
      stoneGfx.clear()
      barGfx.clear()

      // Determine outcome
      const isWin = releaseScore > GREEN_THRESH

      // Stone throw animation — tween a proxy object through a parabolic arc
      const proxy = { t: 0 }
      const startX = stoneX
      const startY = stoneY
      const endX   = W * 0.50        // Goliath head x
      const endY   = H * (1 - 0.34 * 0.92)  // approx head y

      // Arc midpoint (above straight line)
      const midX = (startX + endX) / 2
      const midY = Math.min(startY, endY) - H * 0.18

      // Flying stone graphic (separate from sling stone)
      const flyGfx = scene.add.graphics().setDepth(5)

      scene.tweens.add({
        targets: proxy,
        t: 1,
        duration: isWin ? 900 : 750,
        ease: 'Sine.easeIn',
        onUpdate: () => {
          const t  = proxy.t
          const t1 = 1 - t
          // Quadratic Bézier: P = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
          const fx = t1*t1*startX + 2*t1*t*midX + t*t*endX
          const fy = t1*t1*startY + 2*t1*t*midY + t*t*endY
          flyGfx.clear()
          flyGfx.fillStyle(0xaaaaaa, 1)
          flyGfx.fillCircle(fx, fy, 7)
          // Motion blur tail
          flyGfx.fillStyle(0x888888, 0.4)
          flyGfx.fillCircle(fx - (endX - startX) * 0.03, fy - (endY - startY) * 0.03, 5)
        },
        onComplete: () => {
          flyGfx.clear()
          showHitEffect(scene, endX, endY, isWin)
          scene.time.delayedCall(1800, () => showResult(scene, isWin))
        },
      })
    }

    // ── Hit effect ────────────────────────────────────────────────────────────
    function showHitEffect(scene, hx, hy, isWin) {
      const flashColor = isWin ? 0xffff00 : 0xff4444
      const flash = scene.add.circle(hx, hy, 40, flashColor, 0.85).setDepth(6)
      scene.tweens.add({
        targets: flash,
        scaleX: 2.5,
        scaleY: 2.5,
        alpha: 0,
        duration: 600,
        ease: 'Sine.easeOut',
        onComplete: () => flash.destroy(),
      })

      // Shake canvas on hit
      scene.cameras.main.shake(300, isWin ? 0.015 : 0.006)

      if (isWin) {
        // Goliath tips/fades — no direct object to tween, use a mask flash
        const goliathFlash = scene.add.rectangle(W * 0.5, H * 0.45, 120, 220, 0xffff88, 0.4)
          .setDepth(6)
        scene.tweens.add({
          targets: goliathFlash,
          alpha: 0,
          angle: 8,
          y: H * 0.60,
          duration: 900,
          ease: 'Sine.easeIn',
          onComplete: () => goliathFlash.destroy(),
        })
      }
    }

    // ── Result overlay ────────────────────────────────────────────────────────
    function showResult(scene, isWin) {
      state = 'RESULT'
      const cx = W / 2
      const cy = H / 2

      const overlayColor = isWin ? 0x003300 : 0x330000
      const overlayAlpha = 0.78
      scene.add.rectangle(cx, cy, W * 0.68, H * 0.46, overlayColor, overlayAlpha)
        .setOrigin(0.5).setDepth(8)

      const titleText = isWin ? 'HIT!  Goliath Falls!' : 'MISS!  Stone Went Wide'
      const titleColor = isWin ? '#4ade80' : '#f87171'
      scene.add.text(cx, cy - H * 0.12, titleText, {
        fontSize: '26px', color: titleColor, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(9)

      const pct = Math.round(releaseScore * 100)
      const zoneLabel = releaseScore > GREEN_THRESH
        ? 'Green zone — perfect release!'
        : releaseScore > ORANGE_THRESH
          ? 'Orange zone — slightly off'
          : 'Red zone — too slow'

      scene.add.text(cx, cy - H * 0.02, `Power: ${pct}%  (${zoneLabel})`, {
        fontSize: '14px', color: '#cbd5e1',
      }).setOrigin(0.5).setDepth(9)

      scene.add.text(cx, cy + H * 0.08, 'Returning to game…', {
        fontSize: '13px', color: '#64748b',
      }).setOrigin(0.5).setDepth(9)

      scene.time.delayedCall(2200, () => {
        onComplete(isWin ? 'win' : 'lose', { slingPower: releaseScore })
      })
    }

    // ── Launch Phaser ─────────────────────────────────────────────────────────
    const game = new Phaser.Game(config)

    // ── MiniGameInstance ──────────────────────────────────────────────────────
    return {
      destroy() {
        game.destroy(false)
      },
    }
  },
}

export default StoneThrow
