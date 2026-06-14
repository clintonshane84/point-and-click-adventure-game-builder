import type {
  GameProject, Scene, SceneObject, EventTrigger, EventAction,
  FacingDirection, SpriteSheet, Animation, NpcCharacter, CinematicStep,
  CinematicCompletionAction,
} from '../types'
import { findPath } from './pathfinding'
import type { PathPoint } from './pathfinding'

interface CharacterState {
  x: number
  y: number
  waypoints: PathPoint[]
  waypointIndex: number
  facing: FacingDirection
  moving: boolean
  animFrame: number
  animTimer: number   // ms since last frame advance
  scale: number       // current visual scale (lerps toward targetScale)
  targetScale: number
  speedMult: number   // current speed multiplier (lerps toward targetSpeedMult)
  targetSpeedMult: number
}

type CinematicMode =
  | 'walking_main'   // waiting for main character to finish walk
  | 'walking_npc'    // waiting for NPC to reach target
  | 'waiting'        // countdown timer
  | 'action'         // showing action label countdown
  | 'waiting_dialog' // waiting for dialog click

interface CinematicPlayState {
  steps: CinematicStep[]
  stepIndex: number
  mode: CinematicMode | null
  waitMs: number
  npcOverrides: Map<string, { x: number; y: number }>
  npcTargets: Map<string, { x: number; y: number }>
  activeNpcId: string | null
  actionText: string | null
  actionTimer: number
  completionAction: CinematicCompletionAction
  completionValue: string
}

interface GameState {
  currentSceneId: string
  variables: Record<string, string | number | boolean>
  visitedScenes: string[]
  running: boolean
  dialogText: string | null
  dialogCallback: (() => void) | null
  character: CharacterState | null
  activeHotspots: Set<string>
  cinematic: CinematicPlayState | null
}

const CHAR_SPEED = 250  // scene px / second

export class GameRuntime {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private project: GameProject
  private state: GameState
  private imageCache = new Map<string, HTMLImageElement>()
  private objectVisibility = new Map<string, boolean>()
  private frameId: number | null = null
  private lastFrameTime = 0
  private boundClick: (e: MouseEvent) => void
  private boundMouseMove: (e: MouseEvent) => void

  constructor(canvas: HTMLCanvasElement, project: GameProject) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
    this.project = project
    this.state = this.freshState()
    this.boundClick = this.handleClick.bind(this)
    this.boundMouseMove = this.handleMouseMove.bind(this)
  }

  private freshState(): GameState {
    return {
      currentSceneId: this.project.settings.startingSceneId || this.project.scenes[0]?.id || '',
      variables: {},
      visitedScenes: [],
      running: false,
      dialogText: null,
      dialogCallback: null,
      character: null,
      activeHotspots: new Set(),
      cinematic: null,
    }
  }

  start() {
    if (this.state.running) return
    this.state.running = true
    this.lastFrameTime = 0
    this.canvas.addEventListener('click', this.boundClick)
    this.canvas.addEventListener('mousemove', this.boundMouseMove)
    this.loadScene(this.state.currentSceneId)
    this.renderLoop()
  }

  stop() {
    this.state.running = false
    this.canvas.removeEventListener('click', this.boundClick)
    this.canvas.removeEventListener('mousemove', this.boundMouseMove)
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
  }

  reset() {
    this.stop()
    this.objectVisibility.clear()
    this.imageCache.clear()
    this.state = this.freshState()
    this.start()
  }

  // ── Scene loading ─────────────────────────────────────────────────────────

  private loadScene(sceneId: string) {
    this.state.currentSceneId = sceneId
    this.state.activeHotspots = new Set()
    if (!this.state.visitedScenes.includes(sceneId)) {
      this.state.visitedScenes.push(sceneId)
    }

    const scene = this.project.scenes.find((s) => s.id === sceneId)
    if (scene) {
      if (scene.backgroundImageUrl) this.loadImage(scene.backgroundImageUrl)
      scene.objects.forEach((o) => {
        if (o.imageUrl) this.loadImage(o.imageUrl)
        if (o.spriteSheetId) {
          const sheet = this.project.spriteSheets?.find((s) => s.id === o.spriteSheetId)
          if (sheet?.imageUrl) this.loadImage(sheet.imageUrl)
        }
      })

      // Pre-load character sprite sheets
      const mc = this.project.mainCharacter
      if (mc) {
        for (const dir of ['up', 'down', 'left', 'right'] as FacingDirection[]) {
          const sheet = this.getCharSheet(dir)
          if (sheet?.imageUrl) this.loadImage(sheet.imageUrl)
        }
      }

      // Pre-load NPC sprite sheets
      for (const npc of (this.project.npcs ?? [])) {
        for (const dir of ['up', 'down', 'left', 'right'] as FacingDirection[]) {
          const animCfg = npc.animations[dir]
          if (animCfg?.spriteSheetId) {
            const sheet = this.project.spriteSheets?.find((s) => s.id === animCfg.spriteSheetId)
            if (sheet?.imageUrl) this.loadImage(sheet.imageUrl)
          }
        }
      }

      // Initialize character position from scene placement
      const cp = scene.characterPlacement
      if (cp?.visible && mc) {
        const facing = cp.facing ?? mc.defaultFacing ?? 'down'
        this.state.character = {
          x: cp.x,
          y: cp.y,
          waypoints: [],
          waypointIndex: 0,
          facing,
          moving: false,
          animFrame: this.getAnimStartFrame(facing),
          animTimer: 0,
          scale: 1,
          targetScale: 1,
          speedMult: 1,
          targetSpeedMult: 1,
        }
      } else {
        this.state.character = null
      }
    }

    // Fire scene-level 'enter' events — skip hotspot-bound events (those fire via zone detection)
    const hotspotIds = new Set(scene?.objects.filter((o) => o.type === 'hotspot').map((o) => o.id) ?? [])
    this.project.events
      .filter((e) => e.sceneId === sceneId && e.trigger === 'enter' && e.enabled && !hotspotIds.has(e.objectId))
      .forEach((ev) => this.executeEvent(ev))
  }

  // ── Render loop ───────────────────────────────────────────────────────────

  private renderLoop() {
    if (!this.state.running) return
    const now = performance.now()
    const dt = this.lastFrameTime ? Math.min(now - this.lastFrameTime, 100) : 16
    this.lastFrameTime = now
    this.updateCharacter(dt)
    const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)
    if (scene) {
      this.checkHotspots(scene)
      this.checkScaleZones(scene)
    }
    if (this.state.cinematic) this.updateCinematic(dt)
    this.render()
    this.frameId = requestAnimationFrame(() => this.renderLoop())
  }

  // ── Hotspot zone detection ────────────────────────────────────────────────

  private checkHotspots(scene: Scene) {
    const char = this.state.character
    const mc = this.project.mainCharacter
    if (!char || !mc) return

    // Use character's foot position (bottom-center) for zone detection
    const fx = char.x + mc.width / 2
    const fy = char.y + mc.height

    for (const obj of scene.objects) {
      if (obj.type !== 'hotspot') continue
      const vis = this.objectVisibility.has(obj.id)
        ? this.objectVisibility.get(obj.id)!
        : obj.visible
      if (!vis) continue

      const inside =
        fx >= obj.x && fx <= obj.x + obj.width &&
        fy >= obj.y && fy <= obj.y + obj.height

      const wasInside = this.state.activeHotspots.has(obj.id)

      if (inside && !wasInside) {
        this.state.activeHotspots.add(obj.id)
        this.project.events
          .filter((e) => e.sceneId === scene.id && e.objectId === obj.id && e.trigger === 'enter' && e.enabled)
          .forEach((ev) => this.executeEvent(ev))
      } else if (!inside && wasInside) {
        this.state.activeHotspots.delete(obj.id)
        this.project.events
          .filter((e) => e.sceneId === scene.id && e.objectId === obj.id && e.trigger === 'exit' && e.enabled)
          .forEach((ev) => this.executeEvent(ev))
      }
    }
  }

  // ── Scale zone detection ──────────────────────────────────────────────────

  private checkScaleZones(scene: Scene) {
    const char = this.state.character
    const mc = this.project.mainCharacter
    if (!char || !mc) return

    const fx = char.x + mc.width / 2
    const fy = char.y + mc.height

    let targetScale = 1
    let targetSpeedMult = 1

    for (const zone of (scene.scaleZones ?? [])) {
      if (fx >= zone.x && fx <= zone.x + zone.width &&
          fy >= zone.y && fy <= zone.y + zone.height) {
        targetScale = zone.scale
        targetSpeedMult = zone.speedMultiplier
        break
      }
    }

    char.targetScale = targetScale
    char.targetSpeedMult = targetSpeedMult
  }

  // ── Cinematic execution ───────────────────────────────────────────────────

  private playCinematic(cinematicId: string) {
    const cinematic = (this.project.cinematics ?? []).find((c) => c.id === cinematicId)
    if (!cinematic || cinematic.steps.length === 0) return
    // Load the cinematic's scene if needed
    if (cinematic.sceneId && cinematic.sceneId !== this.state.currentSceneId) {
      this.loadScene(cinematic.sceneId)
    }
    this.state.cinematic = {
      steps: cinematic.steps,
      stepIndex: 0,
      mode: null,
      waitMs: 0,
      npcOverrides: new Map(),
      npcTargets: new Map(),
      activeNpcId: null,
      actionText: null,
      actionTimer: 0,
      completionAction: cinematic.completionAction,
      completionValue: cinematic.completionValue,
    }
    this.executeCinematicStep(cinematic.steps[0])
  }

  private executeCinematicStep(step: CinematicStep) {
    const cine = this.state.cinematic
    if (!cine) return
    cine.actionText = null
    cine.activeNpcId = null

    switch (step.type) {
      case 'walk_to': {
        if (!step.characterId || step.characterId === 'main-character') {
          // Move main character via pathfinding
          const char = this.state.character
          const mc = this.project.mainCharacter
          const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)
          if (char && mc && scene) {
            const path = findPath(
              scene.blockedZones ?? [], scene.width, scene.height,
              char.x + mc.width / 2, char.y + mc.height / 2,
              step.targetX ?? 0, step.targetY ?? 0,
              mc.width, mc.height,
            )
            if (path.length > 0) {
              char.waypoints = path
              char.waypointIndex = 0
              char.moving = true
            }
          }
          cine.mode = 'walking_main'
        } else {
          // Move NPC linearly
          const npcId = step.characterId
          const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)
          const npcObj = scene?.objects.find((o) => o.type === 'character' && o.npcId === npcId)
          const start = cine.npcOverrides.get(npcId) ?? { x: npcObj?.x ?? 0, y: npcObj?.y ?? 0 }
          cine.npcOverrides.set(npcId, { ...start })
          cine.npcTargets.set(npcId, { x: step.targetX ?? 0, y: step.targetY ?? 0 })
          cine.activeNpcId = npcId
          cine.mode = 'walking_npc'
        }
        break
      }
      case 'talk': {
        const npc = step.characterId && step.characterId !== 'main-character'
          ? (this.project.npcs ?? []).find((n: NpcCharacter) => n.id === step.characterId)
          : null
        const speaker = npc?.name ?? this.project.mainCharacter.name ?? 'Player'
        this.state.dialogText = `[${speaker}]: ${step.text ?? ''}`
        this.state.dialogCallback = () => this.advanceCinematicStep()
        cine.mode = 'waiting_dialog'
        break
      }
      case 'show_dialog': {
        this.state.dialogText = step.text ?? ''
        this.state.dialogCallback = () => this.advanceCinematicStep()
        cine.mode = 'waiting_dialog'
        break
      }
      case 'action': {
        const npc = step.characterId && step.characterId !== 'main-character'
          ? (this.project.npcs ?? []).find((n: NpcCharacter) => n.id === step.characterId)
          : null
        const actor = npc?.name ?? this.project.mainCharacter.name ?? 'Player'
        cine.actionText = `${actor} ${step.actionLabel ?? 'performs action'}`
        cine.actionTimer = 2000
        cine.mode = 'action'
        break
      }
      case 'wait': {
        cine.waitMs = (step.duration ?? 1) * 1000
        cine.mode = 'waiting'
        break
      }
      case 'set_variable': {
        if (step.variable) {
          const i = step.variable.indexOf('=')
          if (i !== -1) {
            this.state.variables[step.variable.slice(0, i).trim()] = step.variable.slice(i + 1).trim()
          }
        }
        this.advanceCinematicStep()
        break
      }
      case 'play_sound': {
        // Sound playback not yet implemented in runtime
        this.advanceCinematicStep()
        break
      }
    }
  }

  private advanceCinematicStep() {
    const cine = this.state.cinematic
    if (!cine) return
    cine.stepIndex++
    if (cine.stepIndex >= cine.steps.length) {
      this.completeCinematic()
      return
    }
    this.executeCinematicStep(cine.steps[cine.stepIndex])
  }

  private completeCinematic() {
    const cine = this.state.cinematic
    if (!cine) return
    const { completionAction, completionValue } = cine
    this.state.cinematic = null
    switch (completionAction) {
      case 'navigate_scene': {
        const scene = this.project.scenes.find((s) => s.id === completionValue || s.name === completionValue)
        if (scene) this.loadScene(scene.id)
        break
      }
      case 'show_dialog': {
        this.state.dialogText = completionValue
        break
      }
      case 'set_variable': {
        const i = completionValue.indexOf('=')
        if (i !== -1) {
          this.state.variables[completionValue.slice(0, i).trim()] = completionValue.slice(i + 1).trim()
        }
        break
      }
      case 'return_to_game':
      default:
        break
    }
  }

  private updateCinematic(dt: number) {
    const cine = this.state.cinematic
    if (!cine || cine.mode === null) return

    switch (cine.mode) {
      case 'walking_main': {
        const char = this.state.character
        if (!char || !char.moving) this.advanceCinematicStep()
        break
      }
      case 'walking_npc': {
        const npcId = cine.activeNpcId
        if (!npcId) { this.advanceCinematicStep(); break }
        const pos = cine.npcOverrides.get(npcId)
        const target = cine.npcTargets.get(npcId)
        if (!pos || !target) { this.advanceCinematicStep(); break }
        const dx = target.x - pos.x
        const dy = target.y - pos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const step = 150 * (dt / 1000)
        if (dist <= step) {
          pos.x = target.x
          pos.y = target.y
          this.advanceCinematicStep()
        } else {
          pos.x += (dx / dist) * step
          pos.y += (dy / dist) * step
        }
        break
      }
      case 'waiting': {
        cine.waitMs -= dt
        if (cine.waitMs <= 0) this.advanceCinematicStep()
        break
      }
      case 'action': {
        cine.actionTimer -= dt
        if (cine.actionTimer <= 0) {
          cine.actionText = null
          this.advanceCinematicStep()
        }
        break
      }
      case 'waiting_dialog':
        break  // handled by dialogCallback
    }
  }

  private renderActionLabel() {
    const cine = this.state.cinematic
    if (!cine?.actionText) return
    const { canvas, ctx } = this
    const text = cine.actionText
    const fontSize = 20
    ctx.font = `bold ${fontSize}px sans-serif`
    const w = ctx.measureText(text).width + 32
    const h = 44
    const x = (canvas.width - w) / 2
    const y = 32
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 8)
    ctx.fill()
    ctx.strokeStyle = '#f97316'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#fed7aa'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, y + h / 2)
  }

  // ── Character movement ────────────────────────────────────────────────────

  private updateCharacter(dt: number) {
    const char = this.state.character
    const mc = this.project.mainCharacter
    if (!char || !mc) return

    // Smooth lerp toward zone target scale and speed
    const lerpFactor = Math.min(1, dt * 3 / 1000)
    char.scale += (char.targetScale - char.scale) * lerpFactor
    char.speedMult += (char.targetSpeedMult - char.speedMult) * lerpFactor

    if (!char.moving) return

    const target = char.waypoints[char.waypointIndex]
    if (!target) { char.moving = false; return }

    // Target is centre of character → convert to top-left
    const tx = target.x - mc.width / 2
    const ty = target.y - mc.height / 2
    const dx = tx - char.x
    const dy = ty - char.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 3) {
      char.x = tx
      char.y = ty
      char.waypointIndex++
      if (char.waypointIndex >= char.waypoints.length) {
        // Arrived at final destination
        char.moving = false
        char.animFrame = this.getAnimStartFrame(char.facing)
        char.animTimer = 0
      }
      return
    }

    // Determine facing from dominant axis
    if (Math.abs(dx) >= Math.abs(dy)) {
      char.facing = dx > 0 ? 'right' : 'left'
    } else {
      char.facing = dy > 0 ? 'down' : 'up'
    }

    const step = CHAR_SPEED * char.speedMult * (dt / 1000)
    const ratio = Math.min(step / dist, 1)
    char.x += dx * ratio
    char.y += dy * ratio

    // Advance animation frame
    const animDef = this.getCharAnim(char.facing)
    if (animDef && animDef.fps > 0) {
      const frameMs = 1000 / animDef.fps
      char.animTimer += dt
      while (char.animTimer >= frameMs) {
        char.animTimer -= frameMs
        char.animFrame++
        if (char.animFrame > animDef.endFrame) char.animFrame = animDef.startFrame
      }
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private render() {
    const { canvas, ctx } = this
    const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!scene) {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '20px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No scene — add scenes in the Scene Editor', canvas.width / 2, canvas.height / 2)
      return
    }

    const scaleX = canvas.width / scene.width
    const scaleY = canvas.height / scene.height

    ctx.save()
    ctx.scale(scaleX, scaleY)
    this.renderScene(scene)
    ctx.restore()

    if (this.state.dialogText) this.renderDialog()
    if (this.state.cinematic?.actionText) this.renderActionLabel()
  }

  private renderScene(scene: Scene) {
    const { ctx } = this
    ctx.fillStyle = scene.backgroundColor || '#000'
    ctx.fillRect(0, 0, scene.width, scene.height)

    if (scene.backgroundImageUrl) {
      const img = this.imageCache.get(scene.backgroundImageUrl)
      if (img) ctx.drawImage(img, 0, 0, scene.width, scene.height)
    }

    const objects = [...scene.objects].sort((a, b) => a.zIndex - b.zIndex)

    const char = this.state.character
    const mc = this.project.mainCharacter
    // Character's depth in the scene = bottom edge of the character (feet Y).
    // Objects with zIndex greater than this value render in front of the character.
    const charDepth = char && mc ? char.y + mc.height : null

    let charDrawn = false
    for (const obj of objects) {
      const visible = this.objectVisibility.has(obj.id)
        ? this.objectVisibility.get(obj.id)!
        : obj.visible
      if (!visible) continue

      // Insert character draw before the first object whose z-index exceeds charDepth
      if (!charDrawn && charDepth !== null && obj.zIndex > charDepth) {
        this.renderCharacter()
        charDrawn = true
      }

      this.renderObject(obj)
    }

    if (!charDrawn) this.renderCharacter()
  }

  private renderObject(obj: SceneObject) {
    const { ctx } = this
    ctx.save()
    ctx.globalAlpha = obj.opacity

    // Apply cinematic NPC position override
    const npcOverride = (obj.type === 'character' && obj.npcId && this.state.cinematic)
      ? this.state.cinematic.npcOverrides.get(obj.npcId)
      : undefined
    if (npcOverride) {
      // Temporarily patch obj for rendering (shadow copy to avoid mutation)
      obj = { ...obj, x: npcOverride.x, y: npcOverride.y }
    }

    if (obj.spriteSheetId) {
      const sheet = this.project.spriteSheets?.find((s) => s.id === obj.spriteSheetId)
      if (sheet) {
        const img = this.imageCache.get(sheet.imageUrl)
        if (img) {
          const fi = obj.frameIndex ?? 0
          const col = fi % sheet.cols
          const row = Math.floor(fi / sheet.cols)
          ctx.drawImage(
            img,
            col * sheet.frameWidth, row * sheet.frameHeight,
            sheet.frameWidth, sheet.frameHeight,
            obj.x, obj.y, obj.width, obj.height,
          )
          ctx.restore()
          return
        }
      }
    }

    // Render NPC sprite for character-type objects
    if (obj.type === 'character' && obj.npcId) {
      const npc = (this.project.npcs ?? []).find((n: NpcCharacter) => n.id === obj.npcId)
      if (npc) {
        const facingAnim = npc.animations[npc.defaultFacing]
        if (facingAnim?.spriteSheetId) {
          const sheet = this.project.spriteSheets?.find((s) => s.id === facingAnim.spriteSheetId)
          if (sheet) {
            const img = this.imageCache.get(sheet.imageUrl)
            if (img) {
              const animDef = sheet.animations.find((a) => a.id === facingAnim.animationId)
              const fi = animDef?.startFrame ?? 0
              const col = fi % sheet.cols
              const row = Math.floor(fi / sheet.cols)
              ctx.drawImage(
                img,
                col * sheet.frameWidth, row * sheet.frameHeight,
                sheet.frameWidth, sheet.frameHeight,
                obj.x, obj.y, obj.width, obj.height,
              )
              ctx.restore()
              return
            }
          }
        }
      }
    }

    if (obj.imageUrl) {
      const img = this.imageCache.get(obj.imageUrl)
      if (img) {
        ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height)
        ctx.restore()
        return
      }
    }

    const placeholderColors: Record<string, string> = {
      sprite: '#4f46e5',
      character: '#7c3aed',
      item: '#d97706',
      hotspot: 'rgba(99,102,241,0.15)',
      background: '#1e293b',
    }
    ctx.fillStyle = placeholderColors[obj.type] ?? '#4f46e5'
    ctx.fillRect(obj.x, obj.y, obj.width, obj.height)

    if (obj.type !== 'hotspot') {
      ctx.fillStyle = '#fff'
      const fontSize = Math.max(10, Math.min(14, obj.height * 0.25))
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(obj.name, obj.x + obj.width / 2, obj.y + obj.height / 2)
    }
    ctx.restore()
  }

  private renderCharacter() {
    const char = this.state.character
    const mc = this.project.mainCharacter
    if (!char || !mc) return

    const { ctx } = this
    const cw = mc.width
    const ch = mc.height

    // Scale character from feet anchor point
    const scale = char.scale ?? 1
    const scaledW = cw * scale
    const scaledH = ch * scale
    const renderX = Math.round(char.x + (cw - scaledW) / 2)
    const renderY = Math.round(char.y + ch - scaledH)

    const sheet = this.getCharSheet(char.facing)
    const img = sheet ? this.imageCache.get(sheet.imageUrl) : null

    if (img && sheet) {
      const col = char.animFrame % sheet.cols
      const row = Math.floor(char.animFrame / sheet.cols)
      ctx.drawImage(
        img,
        col * sheet.frameWidth, row * sheet.frameHeight,
        sheet.frameWidth, sheet.frameHeight,
        renderX, renderY, scaledW, scaledH
      )
    } else {
      ctx.save()
      ctx.fillStyle = 'rgba(99,102,241,0.7)'
      ctx.fillRect(renderX, renderY, scaledW, scaledH)
      ctx.fillStyle = '#fff'
      ctx.font = `${Math.min(12, scaledH * 0.18)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(mc.name ?? 'Player', renderX + scaledW / 2, renderY + scaledH / 2)
      ctx.restore()
    }
  }

  private renderDialog() {
    const { canvas, ctx } = this
    const padding = 24
    const boxH = 130
    const boxY = canvas.height - boxH - 12

    ctx.fillStyle = 'rgba(0,0,0,0.88)'
    ctx.fillRect(8, boxY, canvas.width - 16, boxH)
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2
    ctx.strokeRect(8, boxY, canvas.width - 16, boxH)

    const fontSize = Math.max(12, Math.min(16, canvas.width / 50))
    ctx.font = `${fontSize}px sans-serif`
    ctx.fillStyle = '#e2e8f0'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    const maxWidth = canvas.width - 16 - padding * 2
    const words = (this.state.dialogText ?? '').split(' ')
    let line = ''
    let lineY = boxY + padding
    const lineHeight = fontSize + 6

    for (const word of words) {
      const test = line + word + ' '
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line.trim(), 8 + padding, lineY)
        line = word + ' '
        lineY += lineHeight
      } else {
        line = test
      }
    }
    if (line.trim()) ctx.fillText(line.trim(), 8 + padding, lineY)

    ctx.fillStyle = '#6366f1'
    ctx.font = `12px sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('▶ Click to continue', canvas.width - 16, boxY + boxH - 8)
  }

  // ── Input handling ────────────────────────────────────────────────────────

  private getScenePos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left) * (this.canvas.width / rect.width)
    const canvasY = (e.clientY - rect.top) * (this.canvas.height / rect.height)
    const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)
    if (!scene) return { x: canvasX, y: canvasY }
    return {
      x: canvasX / (this.canvas.width / scene.width),
      y: canvasY / (this.canvas.height / scene.height),
    }
  }

  private handleClick(e: MouseEvent) {
    if (this.state.dialogText) {
      this.state.dialogText = null
      const cb = this.state.dialogCallback
      this.state.dialogCallback = null
      if (cb) cb()
      return
    }

    const pos = this.getScenePos(e)
    const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)
    if (!scene) return

    const obj = this.getObjectAt(scene, pos.x, pos.y)
    if (obj) {
      const events = this.project.events.filter(
        (ev) => ev.sceneId === scene.id && ev.objectId === obj.id && ev.trigger === 'click' && ev.enabled
      )
      events.forEach((ev) => this.executeEvent(ev))
      return
    }

    // Nothing clicked — pathfind character to this position
    const char = this.state.character
    const mc = this.project.mainCharacter
    if (char && mc) {
      const path = findPath(
        scene.blockedZones ?? [],
        scene.width, scene.height,
        char.x + mc.width / 2,
        char.y + mc.height / 2,
        pos.x, pos.y,
        mc.width,
        mc.height,
      )
      if (path.length > 0) {
        char.waypoints = path
        char.waypointIndex = 0
        char.moving = true
      }
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.state.dialogText) return
    const pos = this.getScenePos(e)
    const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)
    if (!scene) return
    const obj = this.getObjectAt(scene, pos.x, pos.y)
    this.canvas.style.cursor = obj ? 'pointer' : 'default'
  }

  private getObjectAt(scene: Scene, x: number, y: number): SceneObject | null {
    return [...scene.objects]
      .filter((o) => {
        if (o.type === 'hotspot') return false   // hotspots don't intercept clicks or cursor
        const vis = this.objectVisibility.has(o.id) ? this.objectVisibility.get(o.id)! : o.visible
        return vis
      })
      .sort((a, b) => b.zIndex - a.zIndex)
      .find((o) => x >= o.x && x <= o.x + o.width && y >= o.y && y <= o.y + o.height) ?? null
  }

  // ── Event / action execution ──────────────────────────────────────────────

  private executeEvent(event: EventTrigger) {
    event.actions.forEach((a) => this.executeAction(a))
  }

  private executeAction(action: EventAction) {
    switch (action.type) {
      case 'navigate_scene': {
        const scene = this.project.scenes.find(
          (s) => s.id === action.value || s.name === action.value
        )
        if (scene) this.loadScene(scene.id)
        break
      }
      case 'show_dialog':
        this.state.dialogText = action.value
        break
      case 'set_variable': {
        const eqIdx = action.value.indexOf('=')
        if (eqIdx !== -1) {
          const key = action.value.slice(0, eqIdx).trim()
          const val = action.value.slice(eqIdx + 1).trim()
          this.state.variables[key] = val
        }
        break
      }
      case 'show_object':
        this.objectVisibility.set(action.value, true)
        break
      case 'hide_object':
        this.objectVisibility.set(action.value, false)
        break
      case 'play_sound': {
        const asset = this.project.assets.find(
          (a) => a.id === action.value || a.name === action.value
        )
        if (asset?.url) {
          new Audio(asset.url).play().catch(() => {})
        }
        break
      }
      case 'play_cinematic': {
        this.playCinematic(action.value)
        break
      }
    }
  }

  // ── Sprite sheet helpers ──────────────────────────────────────────────────

  private getCharSheet(facing: FacingDirection): SpriteSheet | null {
    const mc = this.project.mainCharacter
    if (!mc) return null
    const animCfg = mc.animations[facing]
    if (!animCfg?.spriteSheetId) return null
    return this.project.spriteSheets?.find((s) => s.id === animCfg.spriteSheetId) ?? null
  }

  private getCharAnim(facing: FacingDirection): Animation | null {
    const mc = this.project.mainCharacter
    if (!mc) return null
    const animCfg = mc.animations[facing]
    const sheet = this.getCharSheet(facing)
    if (!sheet || !animCfg?.animationId) return null
    return sheet.animations.find((a) => a.id === animCfg.animationId) ?? null
  }

  private getAnimStartFrame(facing: FacingDirection): number {
    return this.getCharAnim(facing)?.startFrame ?? 0
  }

  // ── Image loader ──────────────────────────────────────────────────────────

  private loadImage(url: string) {
    if (this.imageCache.has(url)) return
    const img = new Image()
    img.onload = () => this.imageCache.set(url, img)
    img.src = url
  }
}
