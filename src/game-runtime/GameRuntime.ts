import type {
  GameProject, Scene, SceneObject, EventTrigger, EventAction,
  FacingDirection, SpriteSheet, Animation,
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
    if (scene) this.checkHotspots(scene)
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

  // ── Character movement ────────────────────────────────────────────────────

  private updateCharacter(dt: number) {
    const char = this.state.character
    const mc = this.project.mainCharacter
    if (!char || !char.moving || !mc) return

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

    const step = CHAR_SPEED * (dt / 1000)
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

    const sheet = this.getCharSheet(char.facing)
    const img = sheet ? this.imageCache.get(sheet.imageUrl) : null

    if (img && sheet) {
      const col = char.animFrame % sheet.cols
      const row = Math.floor(char.animFrame / sheet.cols)
      ctx.drawImage(
        img,
        col * sheet.frameWidth, row * sheet.frameHeight,
        sheet.frameWidth, sheet.frameHeight,
        Math.round(char.x), Math.round(char.y), cw, ch
      )
    } else {
      // Fallback while image loads
      ctx.save()
      ctx.fillStyle = 'rgba(99,102,241,0.7)'
      ctx.fillRect(char.x, char.y, cw, ch)
      ctx.fillStyle = '#fff'
      ctx.font = `${Math.min(12, ch * 0.18)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(mc.name ?? 'Player', char.x + cw / 2, char.y + ch / 2)
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
