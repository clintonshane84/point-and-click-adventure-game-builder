import type {
  GameProject, Scene, SceneObject, EventTrigger, EventAction,
  FacingDirection, SpriteSheet, Animation, NpcCharacter, CinematicStep,
  CinematicCompletionAction, NpcMovementInstruction, SceneExitSide,
  Stage, Goal, GoalCondition, EventCondition, TriggerType,
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

interface NpcRuntimeState {
  x: number
  y: number
  facing: FacingDirection
  animFrame: number
  animTimer: number     // ms since last anim frame advance
  waypoints: PathPoint[]
  waypointIndex: number
  behaviorTimer: number  // ms countdown before next behavior decision
  behaviorPhase: 'idle' | 'moving'
  attackFired: boolean
  scale: number          // current visual scale driven by scale zones (default 1)
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
  currentStageId: string | null
  variables: Record<string, string | number | boolean>
  visitedScenes: string[]
  running: boolean
  dialogText: string | null
  dialogCallback: (() => void) | null
  character: CharacterState | null
  activeHotspots: Set<string>
  activeTeleportZones: Set<string>
  cinematic: CinematicPlayState | null
  miniGame: { returnSceneId: string; instance: { destroy(): void } | null } | null
  npcStates: Map<string, NpcRuntimeState>
  showTitleScreen: boolean
}

const CHAR_SPEED = 250  // scene px / second

export class GameRuntime {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private project: GameProject
  private state: GameState
  private imageCache = new Map<string, HTMLImageElement>()
  private objectVisibility = new Map<string, boolean>()
  private removedObjects = new Set<string>()
  private activeCollisions = new Set<string>()
  private frameId: number | null = null
  private lastFrameTime = 0
  private boundClick: (e: MouseEvent) => void
  private boundMouseMove: (e: MouseEvent) => void
  private titleScreenButtonRects: { id: string; action: string; x: number; y: number; w: number; h: number }[] = []

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
    const ts = this.project.titleScreen
    const hasTitleScreen = !!(ts?.titleText || (ts?.buttons && ts.buttons.length > 0))
    return {
      currentSceneId: this.project.settings.startingSceneId || this.project.scenes[0]?.id || '',
      currentStageId: null,
      variables: {},
      visitedScenes: [],
      running: false,
      dialogText: null,
      dialogCallback: null,
      character: null,
      activeHotspots: new Set(),
      activeTeleportZones: new Set(),
      cinematic: null,
      npcStates: new Map(),
      showTitleScreen: hasTitleScreen,
      miniGame: null,
    }
  }

  start() {
    if (this.state.running) return
    this.state.running = true
    this.lastFrameTime = 0
    this.canvas.addEventListener('click', this.boundClick)
    this.canvas.addEventListener('mousemove', this.boundMouseMove)
    // Fire game_start events before the first scene loads
    const gameStartEvents = (this.project.events ?? []).filter((e) => this.evTriggers(e).includes('game_start') && e.enabled)
    gameStartEvents.forEach((e) => this.executeEvent(e))
    this.initStageForScene(this.state.currentSceneId)
    if (this.state.showTitleScreen) {
      const ts = this.project.titleScreen
      if (ts?.backgroundImageUrl) this.loadImage(ts.backgroundImageUrl)
    } else {
      this.loadScene(this.state.currentSceneId, undefined, true)
    }
    this.renderLoop()
  }

  // ── Stage variable helpers ────────────────────────────────────────────────

  private getStageForScene(sceneId: string): Stage | undefined {
    return (this.project.stages ?? []).find((s) => s.sceneIds.includes(sceneId))
  }

  private initStageForScene(sceneId: string): void {
    const stage = this.getStageForScene(sceneId)
    if (!stage || stage.id === this.state.currentStageId) return
    this.state.currentStageId = stage.id
    for (const v of stage.variables ?? []) {
      const val = v.type === 'number' ? (Number(v.defaultValue) || 0)
                : v.type === 'boolean' ? (v.defaultValue === 'true')
                : v.defaultValue
      this.state.variables[v.name] = val
    }
    // Fire stage_start events for this stage
    const stageStartEvents = (this.project.events ?? []).filter(
      (e) => this.evTriggers(e).includes('stage_start') && e.stageId === stage.id && e.enabled
    )
    stageStartEvents.forEach((e) => this.executeEvent(e))
  }

  // ── Variable expression parser ────────────────────────────────────────────
  // Supports:  name=value  (assign)
  //            name+=N     (add N to current numeric value)
  //            name-=N     (subtract N from current numeric value)

  private applyVariableExpression(expr: string): void {
    const addIdx = expr.indexOf('+=')
    const subIdx = expr.indexOf('-=')
    if (addIdx !== -1) {
      const key = expr.slice(0, addIdx).trim()
      const amt = Number(expr.slice(addIdx + 2).trim())
      if (key && !isNaN(amt)) this.state.variables[key] = (Number(this.state.variables[key] ?? 0) + amt)
      return
    }
    if (subIdx !== -1) {
      const key = expr.slice(0, subIdx).trim()
      const amt = Number(expr.slice(subIdx + 2).trim())
      if (key && !isNaN(amt)) this.state.variables[key] = (Number(this.state.variables[key] ?? 0) - amt)
      return
    }
    const eqIdx = expr.indexOf('=')
    if (eqIdx !== -1) {
      const key = expr.slice(0, eqIdx).trim()
      const val = expr.slice(eqIdx + 1).trim()
      if (key) this.state.variables[key] = val
    }
  }

  // ── Goal evaluation ───────────────────────────────────────────────────────

  private evaluateGoals(): void {
    const stageId = this.state.currentStageId
    if (!stageId) return
    const goals = (this.project.goals ?? []).filter((g) => g.stageId === stageId && !g.completed)
    for (const goal of goals) {
      if (this.checkGoalConditions(goal)) {
        this.completeGoal(goal)
        return
      }
    }
  }

  private checkGoalConditions(goal: Goal): boolean {
    if (goal.conditions.length === 0) return false
    const results = goal.conditions.map((c) => this.checkCondition(c))
    return goal.logic === 'AND' ? results.every(Boolean) : results.some(Boolean)
  }

  private checkCondition(cond: GoalCondition): boolean {
    const raw = this.state.variables[cond.target]
    const strVal = raw !== undefined ? String(raw) : ''
    switch (cond.operator) {
      case 'equals':       return strVal === cond.value
      case 'not_equals':   return strVal !== cond.value
      case 'greater_than': return Number(strVal) > Number(cond.value)
      case 'less_than':    return Number(strVal) < Number(cond.value)
      case 'contains':     return strVal.includes(cond.value)
      default:             return false
    }
  }

  private checkEventCondition(cond: EventCondition): boolean {
    const raw = this.state.variables[cond.variable]
    const strVal = raw !== undefined ? String(raw) : ''
    switch (cond.operator) {
      case 'equals':       return strVal === cond.value
      case 'not_equals':   return strVal !== cond.value
      case 'greater_than': return Number(strVal) > Number(cond.value)
      case 'less_than':    return Number(strVal) < Number(cond.value)
      case 'contains':     return strVal.includes(cond.value)
      default:             return false
    }
  }

  private completeGoal(goal: Goal): void {
    // Mark completed so it doesn't fire again this session
    ;(goal as Goal & { completed: boolean }).completed = true

    switch (goal.completionAction) {
      case 'advance_stage': {
        const stages = [...(this.project.stages ?? [])].sort((a, b) => a.order - b.order)
        const idx = stages.findIndex((s) => s.id === this.state.currentStageId)
        const next = stages[idx + 1]
        if (next) {
          this.state.currentStageId = next.id
          for (const v of next.variables ?? []) {
            const val = v.type === 'number' ? (Number(v.defaultValue) || 0)
                      : v.type === 'boolean' ? (v.defaultValue === 'true')
                      : v.defaultValue
            this.state.variables[v.name] = val
          }
          if (next.startingSceneId) this.loadScene(next.startingSceneId, undefined, true)
        }
        break
      }
      case 'end_game':
        this.state.dialogText = goal.completionValue || 'You completed the game!'
        break
      case 'show_dialog':
        this.state.dialogText = goal.completionValue
        break
    }
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
    this.removedObjects.clear()
    this.activeCollisions.clear()
    this.imageCache.clear()
    this.state = this.freshState()
    this.start()
  }

  // ── Scene loading ─────────────────────────────────────────────────────────

  private loadScene(sceneId: string, entryOverride?: { x: number; y: number; facing?: FacingDirection }, stageStart = false) {
    this.state.currentSceneId = sceneId
    this.state.activeHotspots = new Set()
    this.state.activeTeleportZones = new Set()
    if (!this.state.visitedScenes.includes(sceneId)) {
      this.state.visitedScenes.push(sceneId)
    }
    this.initStageForScene(sceneId)

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

      // Resolve character spawn:
      //   entryOverride (navigate_scene arrival) → characterPlacement (stage start only) → null
      const mc2 = this.project.mainCharacter
      if (entryOverride && mc2) {
        const facing = entryOverride.facing ?? mc2.defaultFacing ?? 'down'
        this.state.character = {
          x: entryOverride.x,
          y: entryOverride.y,
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
      } else if (stageStart) {
        // characterPlacement is only honoured on the first scene of a stage
        const cp = scene.characterPlacement
        if (cp?.visible && mc2) {
          const facing = cp.facing ?? mc2.defaultFacing ?? 'down'
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
      } else {
        // Scene transition with no arrival position set: hero does not appear.
        // Set Arrival Position on the navigate_scene event action to fix this.
        this.state.character = null
      }

      // Pre-seed activeHotspots with any hotspot zones the hero spawns inside.
      // Without this, checkHotspots fires 'enter' immediately on the next frame
      // for any hotspot at the spawn position — which would trigger navigate_scene
      // again and erase the character before the player ever sees them.
      if (this.state.character && mc2) {
        const spawnFx = this.state.character.x + mc2.width / 2
        const spawnFy = this.state.character.y + mc2.height
        for (const obj of scene.objects) {
          if (obj.type !== 'hotspot') continue
          if (spawnFx >= obj.x && spawnFx <= obj.x + obj.width &&
              spawnFy >= obj.y && spawnFy <= obj.y + obj.height) {
            this.state.activeHotspots.add(obj.id)
          }
        }
      }

      // Pre-seed activeTeleportZones with any teleport zones the hero spawns inside.
      if (this.state.character && mc2) {
        const spawnFx = this.state.character.x + mc2.width / 2
        const spawnFy = this.state.character.y + mc2.height
        for (const zone of (scene.teleportZones ?? [])) {
          if (spawnFx >= zone.x && spawnFx <= zone.x + zone.width &&
              spawnFy >= zone.y && spawnFy <= zone.y + zone.height) {
            this.state.activeTeleportZones.add(zone.id)
          }
        }
      }

      // Initialize NPC movement states for character objects with movement instructions
      const npcStateMap = new Map<string, NpcRuntimeState>()
      scene.objects
        .filter((o) => o.type === 'character' && o.npcId && o.movementInstruction && o.movementInstruction !== 'none')
        .forEach((o) => {
          const npc = (this.project.npcs ?? []).find((n) => n.id === o.npcId)
          npcStateMap.set(o.id, {
            x: o.x,
            y: o.y,
            facing: npc?.defaultFacing ?? 'down',
            animFrame: 0,
            animTimer: 0,
            waypoints: [],
            waypointIndex: 0,
            behaviorTimer: 0,
            behaviorPhase: 'idle',
            attackFired: false,
            scale: 1,
          })
        })
      this.state.npcStates = npcStateMap
    }

    // Fire scene-level 'enter' events — skip hotspot-bound events (those fire via zone detection)
    const hotspotIds = new Set(scene?.objects.filter((o) => o.type === 'hotspot').map((o) => o.id) ?? [])
    this.project.events
      .filter((e) => e.sceneId === sceneId && this.evTriggers(e).includes('enter') && e.enabled && !hotspotIds.has(e.objectId))
      .forEach((ev) => this.executeEvent(ev))
  }

  // ── Render loop ───────────────────────────────────────────────────────────

  private renderLoop() {
    if (!this.state.running) return
    const now = performance.now()
    const dt = this.lastFrameTime ? Math.min(now - this.lastFrameTime, 100) : 16
    this.lastFrameTime = now
    if (!this.state.showTitleScreen) {
      this.updateCharacter(dt)
      const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)
      if (scene) {
        this.updateNpcs(dt, scene)
        this.checkHotspots(scene)
        this.checkCollisions(scene)
        this.checkScaleZones(scene)
        this.checkSceneEdges(scene)
        this.checkTeleportZones(scene)
      }
      if (this.state.cinematic) this.updateCinematic(dt)
    }
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

    // Capture the scene ID so we can detect mid-loop transitions.
    // If an enter/exit event triggers navigate_scene, the scene changes and
    // the remaining objects belong to the old scene — stop immediately to
    // avoid evaluating old-scene hotspots against the new arrival position.
    const sceneIdAtEntry = this.state.currentSceneId

    for (const obj of scene.objects) {
      if (this.state.currentSceneId !== sceneIdAtEntry) break
      if (obj.type !== 'hotspot') continue
      const vis = this.objectVisibility.has(obj.id)
        ? this.objectVisibility.get(obj.id)!
        : obj.visible
      if (!vis || this.removedObjects.has(obj.id)) continue

      const inside =
        fx >= obj.x && fx <= obj.x + obj.width &&
        fy >= obj.y && fy <= obj.y + obj.height

      const wasInside = this.state.activeHotspots.has(obj.id)

      if (inside && !wasInside) {
        this.state.activeHotspots.add(obj.id)
        this.project.events
          .filter((e) => e.sceneId === scene.id && e.objectId === obj.id && this.evTriggers(e).includes('enter') && e.enabled)
          .forEach((ev) => this.executeEvent(ev))
      } else if (!inside && wasInside) {
        this.state.activeHotspots.delete(obj.id)
        this.project.events
          .filter((e) => e.sceneId === scene.id && e.objectId === obj.id && this.evTriggers(e).includes('exit') && e.enabled)
          .forEach((ev) => this.executeEvent(ev))
      }
    }
  }

  // ── Multi-trigger helper ──────────────────────────────────────────────────

  private evTriggers(ev: EventTrigger): TriggerType[] {
    return [ev.trigger, ...(ev.triggers ?? [])]
  }

  // ── Object visibility helper ──────────────────────────────────────────────

  private isObjectVisible(obj: SceneObject): boolean {
    if (this.removedObjects.has(obj.id)) return false
    return this.objectVisibility.has(obj.id) ? this.objectVisibility.get(obj.id)! : obj.visible
  }

  // ── Collision detection ───────────────────────────────────────────────────

  private checkCollisions(scene: Scene) {
    const char = this.state.character
    const mc = this.project.mainCharacter
    if (!char || !mc) return

    const scale = char.scale ?? 1
    const hx = char.x
    const hy = char.y
    const hw = mc.width * scale
    const hh = mc.height * scale

    const sceneIdAtEntry = this.state.currentSceneId
    const nowColliding = new Set<string>()

    for (const obj of scene.objects) {
      if (this.state.currentSceneId !== sceneIdAtEntry) break
      if (!this.isObjectVisible(obj)) continue
      const overlaps =
        hx < obj.x + obj.width && hx + hw > obj.x &&
        hy < obj.y + obj.height && hy + hh > obj.y
      if (!overlaps) continue
      nowColliding.add(obj.id)
      if (!this.activeCollisions.has(obj.id)) {
        this.project.events
          .filter((ev) => ev.sceneId === scene.id && ev.objectId === obj.id && this.evTriggers(ev).includes('collision') && ev.enabled)
          .forEach((ev) => this.executeEvent(ev))
      }
    }
    this.activeCollisions.forEach((id) => { if (!nowColliding.has(id)) this.activeCollisions.delete(id) })
    nowColliding.forEach((id) => this.activeCollisions.add(id))
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

  // ── Teleport zone detection ───────────────────────────────────────────────

  private checkTeleportZones(scene: Scene) {
    const char = this.state.character
    const mc = this.project.mainCharacter
    if (!char || !mc) return

    const fx = char.x + mc.width / 2
    const fy = char.y + mc.height

    for (const zone of (scene.teleportZones ?? [])) {
      const inside =
        fx >= zone.x && fx <= zone.x + zone.width &&
        fy >= zone.y && fy <= zone.y + zone.height
      const wasInside = this.state.activeTeleportZones.has(zone.id)

      if (inside && !wasInside) {
        this.state.activeTeleportZones.add(zone.id)
        if (zone.linkedSceneId && zone.linkedZoneId) {
          const targetScene = this.project.scenes.find((s) => s.id === zone.linkedSceneId)
          const targetZone = targetScene ? (targetScene.teleportZones ?? []).find((z) => z.id === zone.linkedZoneId) : null
          if (targetScene && targetZone) {
            const arrX = Math.max(0, Math.min(targetScene.width - mc.width,
              targetZone.x + targetZone.width / 2 - mc.width / 2))
            const arrY = Math.max(0, Math.min(targetScene.height - mc.height,
              targetZone.y + targetZone.height / 2 - mc.height / 2))
            const facing = zone.entryFacing ?? char.facing
            this.loadScene(targetScene.id, { x: arrX, y: arrY, facing })
            return
          }
        }
      } else if (!inside && wasInside) {
        this.state.activeTeleportZones.delete(zone.id)
      }
    }
  }

  // ── Scene edge detection ─────────────────────────────────────────────────

  private findSafeArrival(
    scene: Scene,
    mc: { width: number; height: number },
    nomX: number,
    nomY: number,
    side: SceneExitSide,
  ): { x: number; y: number } {
    const padX = Math.max(0, mc.width / 2 - 1)
    const padY = Math.max(0, mc.height / 2 - 1)
    const zones = scene.blockedZones ?? []

    const overlaps = (x: number, y: number): boolean => {
      for (const z of zones) {
        if (
          x - padX < z.x + z.width &&
          x + mc.width + padX > z.x &&
          y - padY < z.y + z.height &&
          y + mc.height + padY > z.y
        ) return true
      }
      return false
    }

    if (!overlaps(nomX, nomY)) return { x: nomX, y: nomY }

    const step = 4
    if (side === 'left' || side === 'right') {
      const maxScan = scene.height
      for (let d = step; d <= maxScan; d += step) {
        for (const cy of [nomY + d, nomY - d]) {
          const clamped = Math.max(0, Math.min(scene.height - mc.height, cy))
          if (!overlaps(nomX, clamped)) return { x: nomX, y: clamped }
        }
      }
    } else {
      const maxScan = scene.width
      for (let d = step; d <= maxScan; d += step) {
        for (const cx of [nomX + d, nomX - d]) {
          const clamped = Math.max(0, Math.min(scene.width - mc.width, cx))
          if (!overlaps(clamped, nomY)) return { x: clamped, y: nomY }
        }
      }
    }

    return { x: nomX, y: nomY }
  }

  private checkSceneEdges(scene: Scene) {
    const char = this.state.character
    const mc = this.project.mainCharacter
    if (!char || !mc) return
    if (!scene.exits || scene.exits.length === 0) return

    // Use the character's actual edges, not the foot centre.
    // Pathfinding routes the hero to grid-cell centres, so the foot centre
    // never reaches scene.width / 0 — but the character's leading edge does.
    let crossedSide: SceneExitSide | null = null
    if (char.x <= 0) crossedSide = 'left'
    else if (char.x + mc.width >= scene.width) crossedSide = 'right'
    else if (char.y <= 0) crossedSide = 'top'
    else if (char.y + mc.height >= scene.height) crossedSide = 'bottom'

    if (!crossedSide) return

    const exitDef = scene.exits.find((e) => e.side === crossedSide)
    if (!exitDef) return

    const targetScene = this.project.scenes.find((s) => s.id === exitDef.targetSceneId)
    if (!targetScene) return

    // Guard against mid-frame re-entry
    const sceneIdAtEntry = this.state.currentSceneId

    let arrivalX: number
    let arrivalY: number
    const clampedY = Math.max(0, Math.min(targetScene.height - mc.height, char.y))
    const clampedX = Math.max(0, Math.min(targetScene.width - mc.width, char.x))

    let nomX: number
    let nomY: number
    if (crossedSide === 'right') {
      nomX = 40
      nomY = clampedY
    } else if (crossedSide === 'left') {
      nomX = targetScene.width - 40 - mc.width
      nomY = clampedY
    } else if (crossedSide === 'top') {
      nomX = clampedX
      nomY = targetScene.height - 40 - mc.height
    } else {
      // bottom
      nomX = clampedX
      nomY = 40
    }

    const safe = this.findSafeArrival(targetScene, mc, nomX, nomY, crossedSide)
    arrivalX = safe.x
    arrivalY = safe.y

    const inferredFacing: FacingDirection =
      crossedSide === 'right' ? 'right' :
      crossedSide === 'left'  ? 'left'  :
      crossedSide === 'top'   ? 'up'    : 'down'

    const facing: FacingDirection = exitDef.entryFacing ?? inferredFacing

    if (this.state.currentSceneId !== sceneIdAtEntry) return
    this.loadScene(targetScene.id, { x: arrivalX, y: arrivalY, facing })
  }

  // ── Cinematic execution ───────────────────────────────────────────────────

  private playCinematic(cinematicId: string) {
    const cinematic = (this.project.cinematics ?? []).find((c) => c.id === cinematicId)
    if (!cinematic || cinematic.steps.length === 0) return
    // Load the cinematic's scene if needed
    if (cinematic.sceneId && cinematic.sceneId !== this.state.currentSceneId) {
      this.loadScene(cinematic.sceneId, undefined, true)
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
              mc.width * char.scale, mc.height * char.scale,
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
        if (step.variable) this.applyVariableExpression(step.variable)
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
        if (scene) this.loadScene(scene.id, undefined, true)
        break
      }
      case 'show_dialog': {
        this.state.dialogText = completionValue
        break
      }
      case 'set_variable': {
        this.applyVariableExpression(completionValue)
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

  // ── NPC autonomous movement ───────────────────────────────────────────────

  private updateNpcs(dt: number, scene: Scene) {
    const NPC_SPEEDS: Record<NpcMovementInstruction, number> = {
      'none': 0,
      'roam-slow-and-eat-grass': 50,
      'roam-human-in-field': 120,
      'follow-hero': 150,
      'follow-and-attack-hero': 180,
    }

    for (const obj of scene.objects) {
      if (obj.type !== 'character' || !obj.npcId) continue
      const instr = obj.movementInstruction ?? 'none'
      if (instr === 'none') continue

      const ns = this.state.npcStates.get(obj.id)
      if (!ns) continue

      const npc = (this.project.npcs ?? []).find((n) => n.id === obj.npcId)
      if (!npc) continue

      const speed = NPC_SPEEDS[instr]

      // Compute NPC's current scale from scale zones (mirrors checkScaleZones for main char)
      const npcFeetX = ns.x + obj.width / 2
      const npcFeetY = ns.y + obj.height
      let npcScale = 1
      for (const zone of (scene.scaleZones ?? [])) {
        if (npcFeetX >= zone.x && npcFeetX <= zone.x + zone.width &&
            npcFeetY >= zone.y && npcFeetY <= zone.y + zone.height) {
          npcScale = zone.scale
          break
        }
      }
      ns.scale = npcScale
      const scaledNpcW = obj.width * npcScale
      const scaledNpcH = obj.height * npcScale

      // ── Behavior decisions ────────────────────────────────────────────────────
      ns.behaviorTimer = Math.max(0, ns.behaviorTimer - dt)

      if (ns.behaviorPhase === 'idle' && ns.behaviorTimer <= 0) {
        // Decide next movement based on instruction
        if (instr === 'roam-slow-and-eat-grass') {
          const angle = Math.random() * Math.PI * 2
          const dist = 80 + Math.random() * 120
          const tx = Math.max(0, Math.min(scene.width - obj.width, ns.x + Math.cos(angle) * dist))
          const ty = Math.max(0, Math.min(scene.height - obj.height, ns.y + Math.sin(angle) * dist))
          ns.waypoints = findPath(scene.blockedZones ?? [], scene.width, scene.height, ns.x + obj.width / 2, ns.y + obj.height, tx + obj.width / 2, ty + obj.height, scaledNpcW, scaledNpcH)
          ns.waypointIndex = 0
          ns.behaviorPhase = ns.waypoints.length > 0 ? 'moving' : 'idle'
          if (ns.behaviorPhase === 'idle') ns.behaviorTimer = 2000 + Math.random() * 4000
        } else if (instr === 'roam-human-in-field') {
          const tx = Math.random() * (scene.width - obj.width)
          const ty = Math.random() * (scene.height - obj.height)
          ns.waypoints = findPath(scene.blockedZones ?? [], scene.width, scene.height, ns.x + obj.width / 2, ns.y + obj.height, tx + obj.width / 2, ty + obj.height, scaledNpcW, scaledNpcH)
          ns.waypointIndex = 0
          ns.behaviorPhase = ns.waypoints.length > 0 ? 'moving' : 'idle'
          if (ns.behaviorPhase === 'idle') ns.behaviorTimer = 1000 + Math.random() * 2000
        } else if (instr === 'follow-hero' || instr === 'follow-and-attack-hero') {
          const char = this.state.character
          const mc = this.project.mainCharacter
          if (char && mc) {
            const stopGap = instr === 'follow-and-attack-hero' ? 40 : 80
            const heroFeetX = char.x + mc.width / 2
            const heroFeetY = char.y + mc.height
            const dx = ns.x - char.x
            const dy = ns.y - char.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > stopGap) {
              ns.waypoints = findPath(scene.blockedZones ?? [], scene.width, scene.height, ns.x + obj.width / 2, ns.y + obj.height, heroFeetX, heroFeetY, scaledNpcW, scaledNpcH)
              ns.waypointIndex = 0
              ns.behaviorPhase = ns.waypoints.length > 0 ? 'moving' : 'idle'
            } else {
              // Close enough — check for attack
              if (instr === 'follow-and-attack-hero' && !ns.attackFired) {
                ns.attackFired = true
                const objName = npc.name || 'NPC'
                this.state.variables[`npc_attacked_${obj.id}`] = true
                if (!this.state.dialogText) {
                  this.state.dialogText = `${objName} attacks you!`
                  this.state.dialogCallback = null
                }
              }
              ns.behaviorTimer = 2000
            }
          } else {
            ns.behaviorTimer = 2000
          }
        }
      }

      // ── Movement along waypoints ──────────────────────────────────────────────
      if (ns.behaviorPhase === 'moving') {
        const target = ns.waypoints[ns.waypointIndex]
        if (!target) {
          ns.behaviorPhase = 'idle'
          if (instr === 'roam-slow-and-eat-grass') {
            ns.behaviorTimer = 3000 + Math.random() * 5000
          } else if (instr === 'roam-human-in-field') {
            ns.behaviorTimer = 1000 + Math.random() * 2000
          } else {
            ns.behaviorTimer = 1500 + Math.random() * 1000
          }
        } else {
          const tx = target.x - obj.width / 2
          const ty = target.y - obj.height
          const dx = tx - ns.x
          const dy = ty - ns.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 3) {
            ns.x = tx
            ns.y = ty
            ns.waypointIndex++
          } else {
            if (Math.abs(dx) >= Math.abs(dy)) {
              ns.facing = dx > 0 ? 'right' : 'left'
            } else {
              ns.facing = dy > 0 ? 'down' : 'up'
            }
            const step = speed * (dt / 1000)
            const ratio = Math.min(step / dist, 1)
            ns.x += dx * ratio
            ns.y += dy * ratio

            // Advance animation
            const animCfg = npc.animations[ns.facing]
            if (animCfg?.spriteSheetId) {
              const sheet = this.project.spriteSheets?.find((s) => s.id === animCfg.spriteSheetId)
              const animDef = sheet?.animations.find((a) => a.id === animCfg.animationId)
              if (animDef && animDef.fps > 0) {
                const frameMs = 1000 / animDef.fps
                ns.animTimer += dt
                while (ns.animTimer >= frameMs) {
                  ns.animTimer -= frameMs
                  ns.animFrame++
                  if (ns.animFrame > animDef.endFrame) ns.animFrame = animDef.startFrame
                }
              }
            }
          }
        }
      }

      // Re-check follow distance for attack trigger even while moving
      if ((instr === 'follow-hero' || instr === 'follow-and-attack-hero') && !ns.attackFired && instr === 'follow-and-attack-hero') {
        const char = this.state.character
        const mc = this.project.mainCharacter
        if (char && mc) {
          const dx = ns.x - char.x
          const dy = ns.y - char.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= 40) {
            ns.attackFired = true
            this.state.variables[`npc_attacked_${obj.id}`] = true
            if (!this.state.dialogText) {
              this.state.dialogText = `${npc.name || 'NPC'} attacks you!`
              this.state.dialogCallback = null
            }
          }
        }
      }
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private render() {
    const { canvas, ctx } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (this.state.showTitleScreen) {
      this.renderTitleScreen()
      return
    }

    const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)

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

  private renderTitleScreen() {
    const { canvas, ctx } = this
    const ts = this.project.titleScreen

    ctx.fillStyle = ts?.backgroundColor || '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (ts?.backgroundImageUrl) {
      const img = this.imageCache.get(ts.backgroundImageUrl)
      if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }

    if (ts?.titleText) {
      const fontSize = ts.titleFontSize || 48
      ctx.font = `bold ${fontSize}px sans-serif`
      ctx.fillStyle = ts.titleColor || '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ts.titleText, canvas.width / 2, canvas.height * 0.22)
    }

    if (ts?.subtitleText) {
      const fontSize = ts.subtitleFontSize || 24
      ctx.font = `${fontSize}px sans-serif`
      ctx.fillStyle = ts.subtitleColor || '#cccccc'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ts.subtitleText, canvas.width / 2, canvas.height * 0.36)
    }

    this.titleScreenButtonRects = []
    const buttons = [...(ts?.buttons ?? [])].sort((a, b) => a.order - b.order)
    const btnW = Math.min(240, canvas.width * 0.5)
    const btnH = 48
    const btnGap = 16
    const startY = canvas.height * 0.52

    buttons.forEach((btn, i) => {
      const x = (canvas.width - btnW) / 2
      const y = startY + i * (btnH + btnGap)
      this.titleScreenButtonRects.push({ id: btn.id, action: btn.action, x, y, w: btnW, h: btnH })

      ctx.fillStyle = 'rgba(99,102,241,0.9)'
      ctx.beginPath()
      ctx.roundRect(x, y, btnW, btnH, 8)
      ctx.fill()
      ctx.strokeStyle = '#818cf8'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(btn.label, x + btnW / 2, y + btnH / 2)
    })
  }

  private startGame(_buttonAction: string) {
    this.state.showTitleScreen = false
    this.loadScene(this.state.currentSceneId, undefined, true)
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
      if (!visible || this.removedObjects.has(obj.id)) continue

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

    // Apply NPC movement state position (if movement instruction set and not in cinematic)
    const npcMoveState = (obj.type === 'character' && obj.npcId && !this.state.cinematic)
      ? this.state.npcStates.get(obj.id)
      : undefined
    // Apply cinematic NPC position override (takes priority over movement state)
    const npcOverride = (obj.type === 'character' && obj.npcId && this.state.cinematic)
      ? this.state.cinematic.npcOverrides.get(obj.npcId)
      : undefined
    if (npcOverride) {
      obj = { ...obj, x: npcOverride.x, y: npcOverride.y }
    } else if (npcMoveState) {
      obj = { ...obj, x: npcMoveState.x, y: npcMoveState.y }
    }

    // Pre-compute scale-zone-adjusted render bounds for NPC character objects.
    // Scale is anchored at the feet (bottom-centre), matching how the main
    // character is rendered — the sprite shrinks upward from the ground.
    const npcScale = (obj.type === 'character' && npcMoveState) ? (npcMoveState.scale ?? 1) : 1
    const npcScaledW = obj.width * npcScale
    const npcScaledH = obj.height * npcScale
    const npcRenderX = Math.round(obj.x + (obj.width - npcScaledW) / 2)
    const npcRenderY = Math.round(obj.y + obj.height - npcScaledH)

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
            npcRenderX, npcRenderY, npcScaledW, npcScaledH,
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
        const facing = npcMoveState?.facing ?? npc.defaultFacing
        const facingAnim = npc.animations[facing]
        if (facingAnim?.spriteSheetId) {
          const sheet = this.project.spriteSheets?.find((s) => s.id === facingAnim.spriteSheetId)
          if (sheet) {
            const img = this.imageCache.get(sheet.imageUrl)
            if (img) {
              const animDef = sheet.animations.find((a) => a.id === facingAnim.animationId)
              const fi = (npcMoveState && npcMoveState.behaviorPhase === 'moving')
                ? npcMoveState.animFrame
                : (animDef?.startFrame ?? 0)
              const col = fi % sheet.cols
              const row = Math.floor(fi / sheet.cols)
              ctx.drawImage(
                img,
                col * sheet.frameWidth, row * sheet.frameHeight,
                sheet.frameWidth, sheet.frameHeight,
                npcRenderX, npcRenderY, npcScaledW, npcScaledH,
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
      terrain: '#14532d',
    }
    ctx.fillStyle = placeholderColors[obj.type] ?? '#4f46e5'
    ctx.fillRect(npcRenderX, npcRenderY, npcScaledW, npcScaledH)

    if (obj.type !== 'hotspot') {
      ctx.fillStyle = '#fff'
      const fontSize = Math.max(10, Math.min(14, npcScaledH * 0.25))
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(obj.name, npcRenderX + npcScaledW / 2, npcRenderY + npcScaledH / 2)
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
    if (this.state.showTitleScreen) {
      const rect = this.canvas.getBoundingClientRect()
      const cx = (e.clientX - rect.left) * (this.canvas.width / rect.width)
      const cy = (e.clientY - rect.top) * (this.canvas.height / rect.height)
      for (const br of this.titleScreenButtonRects) {
        if (cx >= br.x && cx <= br.x + br.w && cy >= br.y && cy <= br.y + br.h) {
          this.startGame(br.action)
          return
        }
      }
      return
    }

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
        (ev) => ev.sceneId === scene.id && ev.objectId === obj.id && this.evTriggers(ev).includes('click') && ev.enabled
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
        mc.width * char.scale,
        mc.height * char.scale,
      )
      if (path.length > 0) {
        char.waypoints = path
        char.waypointIndex = 0
        char.moving = true
      }
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.state.showTitleScreen) {
      const rect = this.canvas.getBoundingClientRect()
      const cx = (e.clientX - rect.left) * (this.canvas.width / rect.width)
      const cy = (e.clientY - rect.top) * (this.canvas.height / rect.height)
      const onBtn = this.titleScreenButtonRects.some(
        (br) => cx >= br.x && cx <= br.x + br.w && cy >= br.y && cy <= br.y + br.h
      )
      this.canvas.style.cursor = onBtn ? 'pointer' : 'default'
      return
    }

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
        if (this.removedObjects.has(o.id)) return false
        const vis = this.objectVisibility.has(o.id) ? this.objectVisibility.get(o.id)! : o.visible
        return vis
      })
      .sort((a, b) => b.zIndex - a.zIndex)
      .find((o) => x >= o.x && x <= o.x + o.width && y >= o.y && y <= o.y + o.height) ?? null
  }

  // ── Event / action execution ──────────────────────────────────────────────

  private executeEvent(event: EventTrigger) {
    for (const branch of (event.branches ?? [])) {
      if (branch.conditions.length === 0) continue
      const results = branch.conditions.map((c) => this.checkEventCondition(c))
      const matched = branch.logic === 'AND' ? results.every(Boolean) : results.some(Boolean)
      if (matched) {
        branch.actions.forEach((a) => this.executeAction(a))
        return
      }
    }
    event.actions.forEach((a) => this.executeAction(a))
  }

  private executeAction(action: EventAction) {
    switch (action.type) {
      case 'navigate_scene': {
        const scene = this.project.scenes.find(
          (s) => s.id === action.value || s.name === action.value
        )
        if (scene) {
          const entryOverride = (action.entryX != null && action.entryY != null)
            ? { x: action.entryX, y: action.entryY, facing: action.entryFacing }
            : undefined
          this.loadScene(scene.id, entryOverride)
        }
        break
      }
      case 'show_dialog':
        this.state.dialogText = action.value
        break
      case 'set_variable': {
        this.applyVariableExpression(action.value)
        this.evaluateGoals()
        break
      }
      case 'show_object':
        this.objectVisibility.set(action.value, true)
        break
      case 'hide_object':
        this.objectVisibility.set(action.value, false)
        break
      case 'remove_object':
        this.removedObjects.add(action.value)
        break
      case 'spawn_object': {
        let template: SceneObject | undefined
        for (const s of this.project.scenes) {
          template = s.objects.find((o) => o.id === action.value)
          if (template) break
        }
        if (!template) break
        const targetScene = this.project.scenes.find(
          (s) => s.id === (action.spawnSceneId || this.state.currentSceneId)
        )
        if (!targetScene) break
        targetScene.objects.push({
          ...template,
          id: `spawned-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          x: action.spawnX ?? template.x,
          y: action.spawnY ?? template.y,
          visible: true,
        })
        break
      }
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
      case 'launch_minigame': {
        this.launchMiniGame(action)
        break
      }
      case 'trigger_event': {
        const ev = this.project.events.find((e) => e.id === action.value)
        if (ev) this.executeEvent(ev)
        break
      }
    }
  }

  // ── Mini-game launcher ────────────────────────────────────────────────────

  private async loadPhaser(): Promise<void> {
    if ((window as any).Phaser) return
    return new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'
      s.onload = () => resolve()
      s.onerror = reject
      document.head.appendChild(s)
    })
  }

  private async loadMiniGameModule(source: string): Promise<any> {
    const blob = new Blob([source], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const mod = await import(/* @vite-ignore */ url)
    URL.revokeObjectURL(url)
    return mod.default
  }

  private async launchMiniGame(action: EventAction) {
    const mg = (this.project.miniGames ?? []).find((m) => m.id === action.value)
    if (!mg?.source) return

    const returnSceneId = this.state.currentSceneId

    // Snapshot all mutable runtime state before the mini-game takes over
    const snapshot = {
      variables:           { ...this.state.variables },
      currentStageId:      this.state.currentStageId,
      character:           this.state.character
                             ? { ...this.state.character, waypoints: [...this.state.character.waypoints] }
                             : null,
      npcStates:           new Map(
                             Array.from(this.state.npcStates.entries())
                               .map(([k, v]) => [k, { ...v, waypoints: [...v.waypoints] }])
                           ),
      objectVisibility:    new Map(this.objectVisibility),
      removedObjects:      new Set(this.removedObjects),
      activeHotspots:      new Set(this.state.activeHotspots),
      activeTeleportZones: new Set(this.state.activeTeleportZones),
      visitedScenes:       [...this.state.visitedScenes],
    }

    this.state.miniGame = { returnSceneId, instance: null }

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }

    try {
      await this.loadPhaser()
      const mod = await this.loadMiniGameModule(mg.source)

      // Create full-viewport overlay
      const overlay = document.createElement('div')
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;'

      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      overlay.appendChild(canvas)
      document.body.appendChild(overlay)

      const teardown = (result: string, vars?: Record<string, string | number | boolean>) => {
        this.state.miniGame?.instance?.destroy()
        this.state.miniGame = null
        document.body.removeChild(overlay)

        // Restore all snapshotted state — no loadScene, which would reset variables and NPCs
        this.state.currentSceneId      = returnSceneId
        this.state.currentStageId      = snapshot.currentStageId
        this.state.variables           = { ...snapshot.variables }
        this.state.character           = snapshot.character
                                           ? { ...snapshot.character, waypoints: [...snapshot.character.waypoints] }
                                           : null
        this.state.npcStates           = new Map(
                                           Array.from(snapshot.npcStates.entries())
                                             .map(([k, v]) => [k, { ...v, waypoints: [...v.waypoints] }])
                                         )
        this.objectVisibility          = new Map(snapshot.objectVisibility)
        this.removedObjects            = new Set(snapshot.removedObjects)
        this.state.activeHotspots      = new Set(snapshot.activeHotspots)
        this.state.activeTeleportZones = new Set(snapshot.activeTeleportZones)
        this.state.visitedScenes       = [...snapshot.visitedScenes]
        this.state.dialogText          = null
        this.state.dialogCallback      = null

        // Merge any variables returned by the mini-game on top of the restored state
        if (vars) Object.assign(this.state.variables, vars)
        this.state.variables['minigame_result'] = result

        this.state.running = true
        this.lastFrameTime = 0
        this.renderLoop()

        // Execute result-specific post-game actions
        const resultActions =
          result === 'win'  ? (action.onWinActions  ?? []) :
          result === 'lose' ? (action.onLoseActions ?? []) :
                              (action.onExitActions ?? [])
        resultActions.forEach((a) => this.executeAction(a))
      }

      const spriteMap: Record<string, string> = {}
      const spriteFrames: Record<string, { url: string; frameWidth: number; frameHeight: number; startFrame: number; endFrame: number; frameRate: number; loop: boolean }> = {}
      for (const [slot, binding] of Object.entries(mg.spriteMap ?? {})) {
        if (!binding?.sheetId) continue
        const ss = this.project.spriteSheets?.find((s) => s.id === binding.sheetId)
        if (!ss) continue
        spriteMap[slot] = ss.imageUrl
        if (binding.animId) {
          const anim = ss.animations.find((a) => a.id === binding.animId)
          if (anim) {
            spriteFrames[slot] = {
              url:         ss.imageUrl,
              frameWidth:  ss.frameWidth,
              frameHeight: ss.frameHeight,
              startFrame:  anim.startFrame,
              endFrame:    anim.endFrame,
              frameRate:   anim.fps,
              loop:        anim.loop,
            }
          }
        }
      }

      const context = {
        canvas,
        Phaser: (window as any).Phaser,
        assets: this.project.assets.map((a) => ({ id: a.id, name: a.name, url: a.url, type: a.type })),
        spriteMap,
        spriteFrames,
        variables: { ...this.state.variables },
        onComplete: (result: 'win' | 'lose' | 'exit', updatedVars?: Record<string, string | number | boolean>) => {
          teardown(result, updatedVars)
        },
      }

      const instance = mod.launch(context)
      if (this.state.miniGame) this.state.miniGame.instance = instance
    } catch (err) {
      console.error('Mini-game error:', err)
      this.state.miniGame = null
      this.state.running = true
      this.lastFrameTime = 0
      this.renderLoop()
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
