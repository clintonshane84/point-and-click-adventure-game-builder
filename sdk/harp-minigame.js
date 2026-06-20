/**
 * Adventure Game Builder — Mini-Game
 * "Harp of David — Heal the King"
 *
 * USAGE:
 *   1. Open the Mini-Games editor in Adventure Game Builder.
 *   2. Click "Add Mini-Game".
 *   3. Paste or upload this file as the source.
 *   4. Click "Test Launch" to try it.
 *
 * BACKGROUND IMAGE (optional):
 *   Upload any image asset to the project and name it so it contains one of:
 *   "background", "scene", "palace", "harp", or "throne" (case-insensitive).
 *   The game will use it as the scene backdrop automatically.
 *
 * CONTROLS (PC):
 *   A S D F J — pluck harp strings left → right
 *
 * CONTROLS (mobile):
 *   Tap the coloured string zone at the bottom of the screen when a note reaches it.
 *
 * WIN CONDITION:
 *   Complete the psalm melody with ≥ 70% hit rate and at least 1 life remaining.
 */

/** @type {import('./minigame-sdk').MiniGameModule} */
const HarpGame = {
  name: 'Harp of David — Heal the King',
  version: '1.0.0',

  launch(ctx) {
    const { canvas, Phaser, assets, onComplete } = ctx

    const W = canvas.width  || 800
    const H = canvas.height || 600

    // ── Layout constants ─────────────────────────────────────────────────────
    const HUD_H      = 56          // top HUD strip height
    const PLAY_TOP   = HUD_H + 36  // y where note spawns
    const HIT_LINE_Y = H * 0.80    // y of the hit bar
    const LANE_COUNT = 5

    // Lane X positions (evenly spaced across centre of canvas)
    const LANE_LEFT  = W * 0.24
    const LANE_RIGHT = W * 0.76
    const LANE_STEP  = (LANE_RIGHT - LANE_LEFT) / (LANE_COUNT - 1)
    function laneX(i) { return LANE_LEFT + i * LANE_STEP }

    // ── Music / chart ────────────────────────────────────────────────────────
    // D Dorian pentatonic + F (Jewish sixth) → evokes ancient Hebrew psalmody
    // Lane indices:  0=D4  1=F4  2=G4  3=A4  4=C5
    const NOTE_FREQ = [293.66, 349.23, 392.00, 440.00, 523.25]
    const NOTE_NAME = ['D', 'F', 'G', 'A', 'C']
    const LANE_COLOR = [0xe57373, 0xffb74d, 0xfff176, 0x81c784, 0x64b5f6]
    const LANE_CSS   = ['#e57373','#ffb74d','#fff176','#81c784','#64b5f6']

    const BPM     = 108
    const BEAT_MS = 60000 / BPM   // ~556 ms per beat

    // "Psalm of David" — 22 notes
    const CHART = [
      {lane:2,beat:0  }, {lane:3,beat:1  }, {lane:4,beat:2  }, {lane:3,beat:3  },
      {lane:2,beat:4  }, {lane:1,beat:5  }, {lane:0,beat:6  },
      {lane:1,beat:7  }, {lane:2,beat:8  }, {lane:3,beat:9  },
      {lane:4,beat:10 }, {lane:4,beat:11 }, {lane:3,beat:12 },
      {lane:2,beat:13 }, {lane:1,beat:13.5}, {lane:0,beat:14 },
      {lane:2,beat:15 }, {lane:3,beat:16 }, {lane:4,beat:17 },
      {lane:3,beat:18 }, {lane:2,beat:19 }, {lane:0,beat:20.5},
    ]
    const TOTAL_NOTES = CHART.length

    // Note fall physics
    const NOTE_SPEED  = 220        // px per second
    const TRAVEL_MS   = ((HIT_LINE_Y - PLAY_TOP) / NOTE_SPEED) * 1000
    const HIT_WINDOW  = 55         // px either side of hit line = "in window"
    const PERF_WINDOW = 24         // px → Perfect
    const MISS_WINDOW = HIT_WINDOW + 10  // past this Y → auto-miss

    // Compute absolute spawn/hit times for each chart entry
    const schedule = CHART.map(n => ({
      lane:     n.lane,
      hitMs:    n.beat * BEAT_MS,
      spawnMs:  n.beat * BEAT_MS - TRAVEL_MS,
      spawned:  false,
      resolved: false,
    }))

    // ── State ────────────────────────────────────────────────────────────────
    let gameState   = 'INTRO'    // INTRO | PLAYING | RESULT
    let lives       = 3
    let score       = 0
    let hits        = 0
    let startTime   = 0          // scene time when PLAYING began
    let audioCtx    = null       // Web Audio context (created on first gesture)

    // Active Phaser game-objects for falling notes
    const activeNotes = []       // { gfx, lane, idx, destroyed }

    // HUD text references
    let scoreText, livesText

    // ── Check if an image asset matches our scene names ───────────────────────
    const bgAsset = assets.find(a =>
      a.type === 'image' &&
      /background|scene|palace|harp|throne/i.test(a.name)
    )

    // ── Phaser config ─────────────────────────────────────────────────────────
    const phaserConfig = {
      type:            Phaser.CANVAS,
      canvas,
      width:           W,
      height:          H,
      backgroundColor: '#1a1228',
      scene: { preload, create, update },
    }

    // ── Audio helpers ─────────────────────────────────────────────────────────
    function ensureAudio() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      } else if (audioCtx.state === 'suspended') {
        audioCtx.resume()
      }
    }

    function pluckNote(laneIdx) {
      if (!audioCtx) return
      const freq = NOTE_FREQ[laneIdx]
      const osc  = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.type = 'triangle'
      osc.frequency.value = freq
      const t = audioCtx.currentTime
      gain.gain.setValueAtTime(0.45, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6)
      osc.start(t)
      osc.stop(t + 1.6)
    }

    // ── preload ───────────────────────────────────────────────────────────────
    function preload() {
      if (bgAsset) {
        this.load.image('harp_bg', bgAsset.url)
      }
    }

    // ── create ────────────────────────────────────────────────────────────────
    function create() {
      const scene = this

      // Background
      if (bgAsset && scene.textures.exists('harp_bg')) {
        scene.add.image(W / 2, H / 2, 'harp_bg').setDisplaySize(W, H).setDepth(0)
      } else {
        drawPalaceBackground(scene)
      }

      drawHarp(scene)
      drawLaneGuides(scene)
      drawHitLine(scene)
      drawHUD(scene)
      createIntroOverlay(scene)
      createExitButton(scene)
      setupInput(scene)
    }

    // ── update ────────────────────────────────────────────────────────────────
    function update(time, delta) {
      if (gameState !== 'PLAYING') return

      const elapsed = time - startTime

      // Spawn notes
      for (const entry of schedule) {
        if (!entry.spawned && elapsed >= entry.spawnMs) {
          entry.spawned = true
          spawnNote(this, entry)
        }
      }

      // Move active notes downward
      for (let i = activeNotes.length - 1; i >= 0; i--) {
        if (gameState !== 'PLAYING') break   // endGame may have been triggered
        const n = activeNotes[i]
        if (n.destroyed) { activeNotes.splice(i, 1); continue }
        n.gfx.y += NOTE_SPEED * (delta / 1000)

        // Auto-miss if note scrolled past hit window
        if (n.gfx.y > HIT_LINE_Y + MISS_WINDOW) {
          missNote(this, n)
          activeNotes.splice(i, 1)
          if (gameState !== 'PLAYING') break // missNote may have called endGame
        }
      }

      // Check song completion
      const allResolved = schedule.every(e => e.resolved)
      if (allResolved && gameState === 'PLAYING') {
        const hitRate = hits / TOTAL_NOTES
        endGame(this, lives > 0 && hitRate >= 0.70)
      }
    }

    // ── Note spawning ─────────────────────────────────────────────────────────
    function spawnNote(scene, entry) {
      const x   = laneX(entry.lane)
      const y   = PLAY_TOP - 16
      const col = LANE_COLOR[entry.lane]

      const container = scene.add.container(x, y).setDepth(5)

      // Glow ring
      const glow = scene.add.graphics()
      glow.fillStyle(col, 0.25)
      glow.fillCircle(0, 0, 22)
      container.add(glow)

      // Main orb
      const orb = scene.add.graphics()
      orb.fillStyle(col, 1)
      orb.fillCircle(0, 0, 14)
      orb.lineStyle(2, 0xffffff, 0.6)
      orb.strokeCircle(0, 0, 14)
      container.add(orb)

      const note = { gfx: container, lane: entry.lane, entry, destroyed: false }
      activeNotes.push(note)
      entry._noteRef = note
    }

    // ── Judgment helpers ──────────────────────────────────────────────────────
    function tryHitLane(scene, laneIdx) {
      if (gameState !== 'PLAYING') return

      // Find best (closest) active note in this lane within hit window
      let best = null
      let bestDist = Infinity
      for (const n of activeNotes) {
        if (n.destroyed) continue
        if (n.lane !== laneIdx) continue
        const dist = Math.abs(n.gfx.y - HIT_LINE_Y)
        if (dist < HIT_WINDOW && dist < bestDist) {
          best = n
          bestDist = dist
        }
      }

      if (!best) {
        // Hit on empty lane — just show a small flash, no miss penalty
        showJudgment(scene, laneIdx, '', 0x888888)
        return
      }

      const isPerfect = bestDist < PERF_WINDOW
      best.entry.resolved = true
      best.destroyed = true
      best.gfx.destroy()

      pluckNote(laneIdx)
      hits++
      score += isPerfect ? 100 : 50
      scoreText.setText('SCORE: ' + score)

      showJudgment(scene, laneIdx, isPerfect ? 'PERFECT!' : 'GOOD', isPerfect ? 0x4ade80 : 0xfacc15)
      lanePulse(scene, laneIdx)
    }

    function missNote(scene, n) {
      if (n.destroyed) return
      n.entry.resolved = true
      n.destroyed = true
      n.gfx.destroy()
      lives = Math.max(0, lives - 1)
      livesText.setText(heartsStr(lives))
      showJudgment(scene, n.lane, 'MISS', 0xef4444)
      scene.cameras.main.shake(120, 0.007)
      if (lives <= 0) endGame(scene, false)
    }

    function showJudgment(scene, laneIdx, label, color) {
      if (!label) return
      const x = laneX(laneIdx)
      const txt = scene.add.text(x, HIT_LINE_Y - 10, label, {
        fontSize: '16px',
        color: '#' + color.toString(16).padStart(6, '0'),
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(9)

      scene.tweens.add({
        targets: txt,
        y: HIT_LINE_Y - 70,
        alpha: 0,
        duration: 700,
        ease: 'Sine.easeOut',
        onComplete: () => txt.destroy(),
      })
    }

    function lanePulse(scene, laneIdx) {
      const flash = scene.add.rectangle(laneX(laneIdx), HIT_LINE_Y, 28, 60,
        LANE_COLOR[laneIdx], 0.7).setDepth(4)
      scene.tweens.add({
        targets: flash,
        alpha: 0,
        scaleY: 2,
        duration: 300,
        ease: 'Sine.easeOut',
        onComplete: () => flash.destroy(),
      })
    }

    function heartsStr(n) {
      return '♥'.repeat(n) + '♡'.repeat(3 - n)
    }

    // ── End game ──────────────────────────────────────────────────────────────
    function endGame(scene, isWin) {
      if (gameState === 'RESULT') return
      gameState = 'RESULT'

      // Kill all remaining notes
      for (const n of activeNotes) {
        if (!n.destroyed) { n.destroyed = true; n.gfx.destroy() }
      }
      activeNotes.length = 0

      const cx = W / 2
      const cy = H / 2
      const overlayColor = isWin ? 0x003300 : 0x330000
      scene.add.rectangle(cx, cy, W * 0.66, H * 0.46, overlayColor, 0.88)
        .setOrigin(0.5).setDepth(10)

      const titleMsg  = isWin
        ? 'The King is Healed!'
        : 'The Song is Broken'
      const titleColor = isWin ? '#4ade80' : '#f87171'
      scene.add.text(cx, cy - H * 0.12, titleMsg, {
        fontSize: '26px', color: titleColor, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(11)

      const pct = Math.round((hits / TOTAL_NOTES) * 100)
      scene.add.text(cx, cy - H * 0.02, `Notes hit: ${hits} / ${TOTAL_NOTES}  (${pct}%)`, {
        fontSize: '15px', color: '#cbd5e1',
      }).setOrigin(0.5).setDepth(11)

      scene.add.text(cx, cy + H * 0.06, `Score: ${score}`, {
        fontSize: '18px', color: '#e2e8f0', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(11)

      scene.add.text(cx, cy + H * 0.14, 'Returning to game…', {
        fontSize: '13px', color: '#64748b',
      }).setOrigin(0.5).setDepth(11)

      scene.time.delayedCall(2500, () => {
        onComplete(isWin ? 'win' : 'lose', { harpscore: score })
      })
    }

    // ── Scene elements ────────────────────────────────────────────────────────
    function drawPalaceBackground(scene) {
      const g = scene.add.graphics().setDepth(0)

      // Stone wall gradient
      g.fillStyle(0x1a1228, 1)
      g.fillRect(0, 0, W, H)

      // Upper stone wall texture
      g.fillStyle(0x2a1f3d, 1)
      g.fillRect(0, 0, W, H * 0.65)

      // Stone block rows
      g.lineStyle(1, 0x3d2f57, 0.5)
      for (let y = 60; y < H * 0.65; y += 48) {
        g.lineBetween(0, y, W, y)
        const offset = (Math.floor(y / 48) % 2) * 80
        for (let x = offset; x < W; x += 160) {
          g.lineBetween(x, y, x, y + 48)
        }
      }

      // Two arched windows — left and right
      drawWindow(g, W * 0.15, H * 0.28)
      drawWindow(g, W * 0.85, H * 0.28)

      // Torch on left wall
      drawTorch(g, W * 0.08, H * 0.42)
      drawTorch(g, W * 0.92, H * 0.42)

      // Floor
      g.fillStyle(0x2c1e42, 1)
      g.fillRect(0, H * 0.65, W, H * 0.35)

      // Floor tiles
      g.lineStyle(1, 0x3d2f55, 0.35)
      for (let y = H * 0.65; y < H; y += 40) {
        g.lineBetween(0, y, W, y)
      }
      for (let x = 0; x < W; x += 80) {
        g.lineBetween(x, H * 0.65, x, H)
      }

      // Throne silhouette (right side, partially behind harp)
      drawThrone(g, W * 0.80, H * 0.62)

      // King silhouette (seated)
      drawKing(scene, W * 0.78, H * 0.58)
    }

    function drawWindow(g, cx, cy) {
      // Window glow
      g.fillStyle(0xffd080, 0.12)
      g.fillEllipse(cx, cy, 80, 120)
      // Window arch
      g.lineStyle(3, 0x5a4570, 0.9)
      g.strokeRect(cx - 28, cy - 44, 56, 88)
      // Arch top
      g.lineStyle(3, 0x5a4570, 0.9)
      g.strokeCircle(cx, cy - 44, 28)
      // Cross divider
      g.lineStyle(2, 0x5a4570, 0.7)
      g.lineBetween(cx, cy - 70, cx, cy + 44)
      g.lineBetween(cx - 28, cy, cx + 28, cy)
    }

    function drawTorch(g, x, y) {
      // Handle
      g.fillStyle(0x6b4a2a, 1)
      g.fillRect(x - 4, y, 8, 30)
      // Flame
      g.fillStyle(0xff9000, 0.9)
      g.fillEllipse(x, y - 8, 16, 24)
      g.fillStyle(0xffcc00, 0.8)
      g.fillEllipse(x, y - 12, 10, 18)
    }

    function drawThrone(g, x, y) {
      g.fillStyle(0x3d2010, 0.85)
      // Seat
      g.fillRect(x - 36, y, 72, 18)
      // Back
      g.fillRect(x - 30, y - 80, 60, 82)
      // Armrests
      g.fillRect(x - 42, y - 22, 14, 22)
      g.fillRect(x + 28, y - 22, 14, 22)
      // Legs
      g.fillRect(x - 30, y + 18, 10, 24)
      g.fillRect(x + 20, y + 18, 10, 24)
    }

    function drawKing(scene, x, y) {
      const g = scene.add.graphics().setDepth(1)
      // Body / robe
      g.fillStyle(0x6b1a1a, 0.9)
      g.fillRect(x - 18, y, 36, 55)
      // Head
      g.fillStyle(0xc4956a, 0.9)
      g.fillCircle(x, y - 14, 16)
      // Crown
      g.fillStyle(0xd4a000, 0.9)
      g.fillRect(x - 16, y - 26, 32, 10)
      g.fillTriangle(x - 16, y - 26, x - 8, y - 38, x, y - 26)
      g.fillTriangle(x,      y - 26, x + 8, y - 38, x + 16, y - 26)
      // Hands (limp, ill)
      g.fillStyle(0xc4956a, 0.7)
      g.fillEllipse(x - 22, y + 38, 12, 8)
      g.fillEllipse(x + 22, y + 38, 12, 8)
    }

    function drawHarp(scene) {
      const g = scene.add.graphics().setDepth(3)

      // Position the harp at bottom-centre, overlapping the lane area
      const HX = W / 2      // harp centre x
      const HY_TOP = H * 0.05  // top of neck
      const HY_BOT = H * 0.96  // bottom of resonator

      // Resonator box (trapezoidal base)
      g.fillStyle(0x6b3f12, 1)
      const rx = HX
      const ry = HY_BOT - 40
      g.fillRect(rx - 95, ry - 20, 190, 60)
      // Wood grain lines
      g.lineStyle(1, 0x8b5e3c, 0.5)
      for (let y = ry - 18; y < ry + 36; y += 8) {
        g.lineBetween(rx - 93, y, rx + 93, y)
      }

      // Pillar (left vertical post)
      g.fillStyle(0x4a2c0a, 1)
      g.fillRect(laneX(0) - 16, HY_TOP + 40, 14, HY_BOT - HY_TOP - 62)
      g.lineStyle(1, 0x7a5030, 0.5)
      g.lineBetween(laneX(0) - 12, HY_TOP + 44, laneX(0) - 12, HY_BOT - 24)

      // Neck curve (Bezier from top of pillar → above rightmost string)
      g.lineStyle(18, 0x6b3f12, 1)
      const neckCurve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(laneX(0) - 9, HY_TOP + 50),
        new Phaser.Math.Vector2(laneX(0) - 9, HY_TOP),
        new Phaser.Math.Vector2(laneX(4) + 20, HY_TOP + 70)
      )
      const neckPts = neckCurve.getPoints(24)
      g.strokePoints(neckPts, false)

      // Neck highlight
      g.lineStyle(4, 0x9a6030, 0.5)
      g.strokePoints(neckPts.slice(0, 18), false)

      // 5 harp strings — these align exactly with note lanes
      for (let i = 0; i < LANE_COUNT; i++) {
        const sx = laneX(i)
        g.lineStyle(2, LANE_COLOR[i], 0.55)
        g.lineBetween(sx, HY_TOP + 55 + i * 14, sx, HY_BOT - 20)
      }
    }

    function drawLaneGuides(scene) {
      // Faint vertical dashed guide for each lane
      for (let i = 0; i < LANE_COUNT; i++) {
        const x = laneX(i)
        const g = scene.add.graphics().setDepth(2)
        g.lineStyle(1, LANE_COLOR[i], 0.18)
        for (let y = PLAY_TOP; y < HIT_LINE_Y - 10; y += 18) {
          g.lineBetween(x, y, x, y + 10)
        }
        // Lane key label below hit line
        scene.add.text(x, HIT_LINE_Y + 16, NOTE_NAME[i], {
          fontSize: '13px',
          color: LANE_CSS[i],
          fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(6)

        // Key shortcut label
        const KEY_LABELS = ['A','S','D','F','J']
        scene.add.text(x, HIT_LINE_Y + 33, `[${KEY_LABELS[i]}]`, {
          fontSize: '11px',
          color: '#64748b',
        }).setOrigin(0.5, 0).setDepth(6)

        // Touch hit zone (mobile)
        const zone = scene.add
          .rectangle(x, HIT_LINE_Y + 6, LANE_STEP * 0.9, 60, LANE_COLOR[i], 0)
          .setDepth(7)
          .setInteractive({ cursor: 'pointer' })
        zone.on('pointerdown', () => tryHitLane(scene, i))
      }
    }

    function drawHitLine(scene) {
      const g = scene.add.graphics().setDepth(6)
      // Glow
      g.lineStyle(6, 0xffffff, 0.10)
      g.lineBetween(LANE_LEFT - 30, HIT_LINE_Y, LANE_RIGHT + 30, HIT_LINE_Y)
      // Main line
      g.lineStyle(2, 0xffffff, 0.65)
      g.lineBetween(LANE_LEFT - 30, HIT_LINE_Y, LANE_RIGHT + 30, HIT_LINE_Y)
    }

    function drawHUD(scene) {
      // HUD backdrop
      const bg = scene.add.graphics().setDepth(7)
      bg.fillStyle(0x0f0a1a, 0.82)
      bg.fillRect(0, 0, W, HUD_H)
      bg.lineStyle(1, 0x3d2f57, 0.8)
      bg.lineBetween(0, HUD_H, W, HUD_H)

      scoreText = scene.add.text(16, HUD_H / 2, 'SCORE: 0', {
        fontSize: '15px', color: '#e2e8f0', fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(8)

      livesText = scene.add.text(W / 2, HUD_H / 2, heartsStr(lives), {
        fontSize: '18px', color: '#f87171',
      }).setOrigin(0.5, 0.5).setDepth(8)

      scene.add.text(W - W * 0.28, HUD_H / 2, 'HARP OF DAVID', {
        fontSize: '13px', color: '#94a3b8', fontStyle: 'italic',
      }).setOrigin(0.5, 0.5).setDepth(8)
    }

    function createIntroOverlay(scene) {
      const cx = W / 2
      const cy = H / 2

      const bg = scene.add.rectangle(cx, cy, W * 0.68, H * 0.52, 0x000000, 0.84)
        .setOrigin(0.5).setDepth(10)

      const title = scene.add.text(cx, cy - H * 0.18, 'Harp of David', {
        fontSize: '30px', color: '#fbbf24', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(11)

      const sub = scene.add.text(cx, cy - H * 0.08, 'Heal the King', {
        fontSize: '17px', color: '#94a3b8',
      }).setOrigin(0.5).setDepth(11)

      const keys = scene.add.text(cx, cy + H * 0.02,
        'Press  A  S  D  F  J  when notes reach the line', {
          fontSize: '13px', color: '#cbd5e1',
        }).setOrigin(0.5).setDepth(11)

      const keys2 = scene.add.text(cx, cy + H * 0.09,
        'Hit ≥ 70 % of notes to heal the king', {
          fontSize: '13px', color: '#cbd5e1',
        }).setOrigin(0.5).setDepth(11)

      const prompt = scene.add.text(cx, cy + H * 0.19, 'Click or tap to begin', {
        fontSize: '15px', color: '#4ade80', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(11)

      scene.tweens.add({
        targets: prompt, alpha: 0.15,
        duration: 650, yoyo: true, repeat: -1,
      })

      scene._introObjs = [bg, title, sub, keys, keys2, prompt]

      // Clicking anywhere (including the intro) starts the game
      scene.input.once('pointerdown', () => startGame(scene))
    }

    function startGame(scene) {
      ensureAudio()
      if (scene._introObjs) {
        scene._introObjs.forEach(o => o.destroy())
        scene._introObjs = null
      }
      startTime = scene.time.now
      gameState = 'PLAYING'
    }

    function createExitButton(scene) {
      const btn = scene.add.text(W - 12, 12, '✕ Exit', {
        fontSize: '13px', color: '#94a3b8',
        backgroundColor: '#1e293b',
        padding: { x: 8, y: 4 },
      }).setOrigin(1, 0).setDepth(12).setInteractive({ cursor: 'pointer' })

      btn.on('pointerover', () => btn.setColor('#e2e8f0'))
      btn.on('pointerout',  () => btn.setColor('#94a3b8'))
      btn.on('pointerdown', () => onComplete('exit', { harpscore: score }))
    }

    function setupInput(scene) {
      const LANE_KEYS = ['A', 'S', 'D', 'F', 'J']
      const keys = scene.input.keyboard.addKeys(LANE_KEYS.join(','))
      LANE_KEYS.forEach((k, i) => {
        keys[k].on('down', () => {
          if (gameState === 'INTRO') { startGame(scene); return }
          tryHitLane(scene, i)
        })
      })
    }

    // ── Launch ────────────────────────────────────────────────────────────────
    const game = new Phaser.Game(phaserConfig)

    return {
      destroy() { game.destroy(false) },
    }
  },
}

export default HarpGame
