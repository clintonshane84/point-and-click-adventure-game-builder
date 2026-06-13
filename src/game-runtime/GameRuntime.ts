import type { GameProject, Scene, SceneObject, EventTrigger, EventAction } from '../types'

interface GameState {
  currentSceneId: string
  variables: Record<string, string | number | boolean>
  visitedScenes: string[]
  running: boolean
  dialogText: string | null
  dialogCallback: (() => void) | null
}

export class GameRuntime {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private project: GameProject
  private state: GameState
  private imageCache = new Map<string, HTMLImageElement>()
  private objectVisibility = new Map<string, boolean>()
  private frameId: number | null = null
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
    }
  }

  start() {
    if (this.state.running) return
    this.state.running = true
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

  private loadScene(sceneId: string) {
    this.state.currentSceneId = sceneId
    if (!this.state.visitedScenes.includes(sceneId)) {
      this.state.visitedScenes.push(sceneId)
    }
    // Fire 'enter' events for the scene
    const enterEvents = this.project.events.filter(
      (e) => e.sceneId === sceneId && e.trigger === 'enter' && e.enabled
    )
    enterEvents.forEach((ev) => this.executeEvent(ev))
    // Pre-cache scene images
    const scene = this.project.scenes.find((s) => s.id === sceneId)
    if (scene) {
      if (scene.backgroundImageUrl) this.loadImage(scene.backgroundImageUrl)
      scene.objects.forEach((o) => { if (o.imageUrl) this.loadImage(o.imageUrl) })
    }
  }

  private renderLoop() {
    if (!this.state.running) return
    this.render()
    this.frameId = requestAnimationFrame(() => this.renderLoop())
  }

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
    for (const obj of objects) {
      const visible = this.objectVisibility.has(obj.id)
        ? this.objectVisibility.get(obj.id)!
        : obj.visible
      if (!visible) continue
      this.renderObject(obj)
    }
  }

  private renderObject(obj: SceneObject) {
    const { ctx } = this
    ctx.save()
    ctx.globalAlpha = obj.opacity

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
      hotspot: 'rgba(99,102,241,0.25)',
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
    if (!obj) return

    const events = this.project.events.filter(
      (ev) => ev.sceneId === scene.id && ev.objectId === obj.id && ev.trigger === 'click' && ev.enabled
    )
    events.forEach((ev) => this.executeEvent(ev))
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

  private loadImage(url: string) {
    if (this.imageCache.has(url)) return
    const img = new Image()
    img.onload = () => this.imageCache.set(url, img)
    img.src = url
  }
}
