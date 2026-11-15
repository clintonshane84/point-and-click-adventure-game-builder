import type {
  GameProject, Scene, SceneObject, EventTrigger, EventAction,
  FacingDirection, SpriteSheet, Animation, NpcCharacter, CinematicStep,
  CinematicCompletionAction, NpcMovementInstruction, SceneExitSide,
  Stage, Goal, GoalCondition, EventCondition, TriggerType,
  StoryBook, StoryPage, CursorStateName,
} from '../types'
import { findPath, feetBlocked } from './pathfinding'
import type { PathPoint } from './pathfinding'

interface Rect { x: number; y: number; w: number; h: number }

// Smallest comfortable tap target, in CSS pixels (Apple/Android guidance).
const TAP_MIN_CSS_PX = 44
type DpadKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
const DPAD_GLYPH: Record<DpadKey, string> = { ArrowUp: '▲', ArrowDown: '▼', ArrowLeft: '◀', ArrowRight: '▶' }

// Logical size of each game canvas, kept so the engine can be rebuilt on the same element.
const LOGICAL_SIZE = new WeakMap<HTMLCanvasElement, { w: number; h: number; pw: number; ph: number }>()

/**
 * Bitmap scale for the game canvas: the device pixel ratio, capped to keep memory and the
 * WebView's texture limit in check. ?dpr=N overrides it (for testing in a desktop browser).
 */
function bitmapDpr(lw: number, lh: number): number {
  let d = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  try {
    const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('dpr') : null
    if (forced && Number(forced) > 0) d = Number(forced)
  } catch {
    // no location
  }
  d = Math.min(Math.max(d, 1), 3, 4096 / Math.max(lw, lh))
  while (d > 1 && lw * lh * d * d > 8_000_000) d = Math.max(1, d - 0.25)
  return d
}

// Keys a mini-game uses when its touchKeys list is empty.
const TOUCH_KEY_DEFAULT = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']
const TOUCH_KEY_LABEL: Record<string, string> = {
  ArrowLeft: '◀', ArrowRight: '▶', ArrowUp: '▲', ArrowDown: '▼', ' ': 'Space', Enter: 'Enter', Escape: 'Esc',
}
const TOUCH_KEY_CODE: Record<string, number> = {
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, ' ': 32, Enter: 13, Escape: 27,
}

/** Turns what the author typed ("space", "a") into KeyboardEvent.key values. */
function normaliseTouchKey(raw: string): string {
  const k = raw.trim()
  if (/^space$/i.test(k)) return ' '
  if (k.length === 1) return k.toUpperCase()
  return k
}

/**
 * Sends a key to the page the way a keyboard would. Phaser matches keys by keyCode,
 * which the KeyboardEvent constructor cannot set, so it is added as a property.
 */
function sendGameKey(type: 'keydown' | 'keyup', key: string) {
  const code = TOUCH_KEY_CODE[key] ?? (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0)
  const ev = new KeyboardEvent(type, {
    key,
    code: key === ' ' ? 'Space' : key.length === 1 ? `Key${key}` : key,
    bubbles: true,
  })
  Object.defineProperty(ev, 'keyCode', { get: () => code })
  Object.defineProperty(ev, 'which', { get: () => code })
  window.dispatchEvent(ev)
}

/** Bottom bar of key buttons for a mini-game overlay. Holding a button holds the key. */
function buildTouchKeyBar(touchKeys: string[] | undefined, overlay: HTMLElement) {
  const keys = (touchKeys && touchKeys.length > 0 ? touchKeys : TOUCH_KEY_DEFAULT).map(normaliseTouchKey)
  const bar = document.createElement('div')
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;display:flex;flex-wrap:wrap;justify-content:center;' +
    'gap:8px;padding:8px;background:rgba(0,0,0,0.7);z-index:1;'
  for (const key of keys) {
    const b = document.createElement('button')
    b.textContent = TOUCH_KEY_LABEL[key] ?? key
    b.style.cssText = 'min-width:56px;min-height:48px;padding:0 12px;border-radius:8px;border:2px solid #c7d2fe;' +
      'background:rgba(255,255,255,0.12);color:#fff;font:600 16px sans-serif;touch-action:none;user-select:none;'
    const press = (e: Event) => {
      e.preventDefault()
      b.style.background = 'rgba(99,102,241,0.85)'
      sendGameKey('keydown', key)
    }
    const release = (e: Event) => {
      e.preventDefault()
      b.style.background = 'rgba(255,255,255,0.12)'
      sendGameKey('keyup', key)
    }
    b.addEventListener('pointerdown', press)
    b.addEventListener('pointerup', release)
    b.addEventListener('pointercancel', release)
    bar.appendChild(b)
  }
  overlay.appendChild(bar)
}

/** True when running inside the Expo app's WebView (the bridge is injected by react-native-webview). */
function hasNativeSpeech(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView
}

function postToApp(msg: Record<string, unknown>) {
  const bridge = (window as unknown as { ReactNativeWebView?: { postMessage(s: string): void } }).ReactNativeWebView
  bridge?.postMessage(JSON.stringify(msg))
}

/** Touch screens get the on-screen pad and larger buttons. `?touch` forces it for testing in a desktop browser. */
function isTouchDevice(): boolean {
  try {
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('touch')) return true
  } catch {
    // no location: fall through
  }
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
}

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

// What happens after a story book closes. Plain data (not a callback) so it can be saved.
type StoryContinuation =
  | { kind: 'none' }
  | { kind: 'loadScene'; sceneId: string }   // stage start: load the stage's scene
  | { kind: 'goalAction'; goalId: string }   // stage end: apply the completed goal's action
  | { kind: 'beforeStage' }                  // stage start: play the stage's before-story, then load its scene

interface StoryPlayState {
  book: StoryBook
  pageIndex: number
  flip: { dir: 1 | -1; to: number; t: number } | null   // t: 0..1 through the turn
  continuation: StoryContinuation
  token: number          // bumped whenever narration starts/stops; stale callbacks are ignored
  narrating: boolean
  audio: HTMLAudioElement | null
  timer: ReturnType<typeof setTimeout> | null
}

const STORY_FLIP_MS = 700
const STORY_PAPER: Record<StoryBook['paperStyle'], { bg: string; fg: string }> = {
  parchment: { bg: '#f3e3c3', fg: '#3b2c1a' },
  white:     { bg: '#fbfaf6', fg: '#1f2937' },
  dark:      { bg: '#2a2730', fg: '#ece7dc' },
}
const STORY_FONT_FAMILY = 'Georgia, "Times New Roman", serif'

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
  story: StoryPlayState | null
  saveMenu: {
    mode: 'save' | 'load'; fromTitle: boolean
    message?: string; messageIsError?: boolean
    confirmSlot?: number   // slot armed for overwrite (second click confirms)
  } | null
  miniGame: { returnSceneId: string; instance: { destroy(): void } | null } | null
  npcStates: Map<string, NpcRuntimeState>
  showTitleScreen: boolean
  activeQuestIds: string[]
  completedQuestIds: string[]
  questLogOpen: boolean
}

const CHAR_SPEED = 250  // scene px / second

// A saved player game. Stored as JSON in localStorage, one entry per slot.
export type SaveSlotRead = { status: 'empty' } | { status: 'ok'; data: SaveSlotData } | { status: 'corrupt' }

export interface SaveSlotData {
  version: 1
  projectId: string
  savedAt: string
  sceneName: string
  stageName: string
  sceneId: string
  stageId: string | null
  variables: Record<string, string | number | boolean>
  visitedScenes: string[]
  activeQuestIds: string[]
  completedQuestIds: string[]
  completedGoalIds: string[]
  character: { x: number; y: number; facing: FacingDirection } | null
  npcs: { objectId: string; x: number; y: number; facing: FacingDirection }[]
  objectVisibility: [string, boolean][]
  removedObjects: string[]
  spawned: { sceneId: string; id: string; templateId: string; x: number; y: number }[]
  story: { bookId: string; pageIndex: number; continuation: StoryContinuation } | null
  pendingStories: { bookId: string; continuation: StoryContinuation }[]
}

export class GameRuntime {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private project: GameProject
  private state: GameState
  private imageCache = new Map<string, HTMLImageElement>()
  private objectVisibility = new Map<string, boolean>()
  private removedObjects = new Set<string>()
  private activeCollisions = new Set<string>()
  private repeatCounts = new Map<string, number>()
  private frameId: number | null = null
  private lastFrameTime = 0
  private boundClick: (e: MouseEvent) => void
  private boundMouseMove: (e: MouseEvent) => void
  private boundMouseDown: (e: MouseEvent) => void
  private boundMouseUp: (e: MouseEvent) => void
  private cursorHover = false   // pointer is over a clickable object or title button
  private pointerDown = false   // mouse button held: 'interact' cursor state
  private lw = 0            // logical width (layout size)
  private lh = 0            // logical height
  private sx = 1            // bitmap pixels per logical pixel
  private sy = 1
  private touch = isTouchDevice()
  private dpadRects: Record<DpadKey, Rect> = {
    ArrowUp: { x: 0, y: 0, w: 0, h: 0 }, ArrowDown: { x: 0, y: 0, w: 0, h: 0 },
    ArrowLeft: { x: 0, y: 0, w: 0, h: 0 }, ArrowRight: { x: 0, y: 0, w: 0, h: 0 },
  }
  private dpadPointers = new Map<number, DpadKey>()   // pointerId -> arrow it is holding
  private boundPointerDown: (e: PointerEvent) => void
  private boundPointerUp: (e: PointerEvent) => void
  private boundContextMenu: (e: Event) => void
  private boundPointerMove: (e: PointerEvent) => void
  private boundKeyDown: (e: KeyboardEvent) => void
  private boundKeyUp: (e: KeyboardEvent) => void
  private activeKeys = new Set<string>()
  private titleScreenButtonRects: { id: string; action: string; x: number; y: number; w: number; h: number }[] = []
  private questButtonRect = { x: 0, y: 0, w: 0, h: 0 }
  private questLogCloseRect = { x: 0, y: 0, w: 0, h: 0 }
  private storyRects: { page: Rect; speaker: Rect; skip: Rect } = {
    page: { x: 0, y: 0, w: 0, h: 0 },
    speaker: { x: 0, y: 0, w: 0, h: 0 },
    skip: { x: 0, y: 0, w: 0, h: 0 },
  }
  private pendingStories: { book: StoryBook; continuation: StoryContinuation }[] = []
  // spawned object id -> template object id, so saves can refer to templates instead of copying them
  private spawnTemplateIds = new Map<string, string>()
  private saveButtonRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private saveMenuRects: { tabSave: Rect; tabLoad: Rect; back: Rect; slots: Rect[] } = {
    tabSave: { x: 0, y: 0, w: 0, h: 0 }, tabLoad: { x: 0, y: 0, w: 0, h: 0 },
    back: { x: 0, y: 0, w: 0, h: 0 }, slots: [],
  }

  constructor(canvas: HTMLCanvasElement, project: GameProject) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
    // The game's logical (CSS-pixel) size stays the same; the bitmap is larger on high-density screens
    // so text and sprites stay sharp. Every layout and hit test uses lw/lh.
    const known = LOGICAL_SIZE.get(canvas)
    this.lw = known && canvas.width === known.pw ? known.w : canvas.width
    this.lh = known && canvas.height === known.ph ? known.h : canvas.height
    const d = bitmapDpr(this.lw, this.lh)
    canvas.width = Math.round(this.lw * d)
    canvas.height = Math.round(this.lh * d)
    LOGICAL_SIZE.set(canvas, { w: this.lw, h: this.lh, pw: canvas.width, ph: canvas.height })
    this.sx = canvas.width / this.lw
    this.sy = canvas.height / this.lh
    // Do not set CSS width/height here: explicit sizes stop the canvas keeping its aspect ratio,
    // which letterboxes the game sideways. The bitmap's own ratio is what CSS scales.
    ctx.setTransform(this.sx, 0, 0, this.sy, 0, 0)
    this.project = project
    this.state = this.freshState()
    this.boundClick = this.handleClick.bind(this)
    this.boundMouseMove = this.handleMouseMove.bind(this)
    this.boundMouseDown = this.handleMouseDown.bind(this)
    this.boundMouseUp = this.handleMouseUp.bind(this)
    this.boundPointerDown = this.handlePointerDown.bind(this)
    this.boundPointerUp = this.handlePointerUp.bind(this)
    this.boundContextMenu = (e: Event) => e.preventDefault()
    this.boundPointerMove = this.handlePointerMove.bind(this)
    // The native app (Expo) calls this when a line of narration finishes
    ;(window as unknown as { __agbSpeechDone?: (id: number) => void }).__agbSpeechDone = (id: number) => this.onNarrationDone(id)
    // Stop the browser scrolling or zooming when the player drags across the game
    this.canvas.style.touchAction = 'none'
    this.boundKeyDown = this.handleKeyDown.bind(this)
    this.boundKeyUp = this.handleKeyUp.bind(this)
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
      story: null,
      saveMenu: null,
      npcStates: new Map(),
      showTitleScreen: hasTitleScreen,
      miniGame: null,
      activeQuestIds: [],
      completedQuestIds: [],
      questLogOpen: false,
    }
  }

  start() {
    if (this.state.running) return
    this.state.running = true
    this.lastFrameTime = 0
    this.canvas.addEventListener('click', this.boundClick)
    this.canvas.addEventListener('mousemove', this.boundMouseMove)
    this.canvas.addEventListener('mousedown', this.boundMouseDown)
    window.addEventListener('mouseup', this.boundMouseUp)
    this.canvas.addEventListener('pointerdown', this.boundPointerDown)
    window.addEventListener('pointerup', this.boundPointerUp)
    window.addEventListener('pointercancel', this.boundPointerUp)
    window.addEventListener('pointermove', this.boundPointerMove)
    this.canvas.addEventListener('contextmenu', this.boundContextMenu)
    this.applyCursor(false)
    window.addEventListener('keydown', this.boundKeyDown)
    window.addEventListener('keyup', this.boundKeyUp)
    // Fire game_start events before the first scene loads
    const gameStartEvents = (this.project.events ?? []).filter((e) => this.evTriggers(e).includes('game_start') && e.enabled)
    gameStartEvents.forEach((e) => this.executeEvent(e))
    this.initStageForScene(this.state.currentSceneId)
    const intro = this.gameStartBook()
    if (this.state.showTitleScreen) {
      const ts = this.project.titleScreen
      if (ts?.backgroundImageUrl) this.loadImage(ts.backgroundImageUrl)
      // The game-start book plays first; the title menu appears when it closes
      if (intro) this.playStory(intro.id, { kind: 'none' })
    } else if (intro) {
      this.playStory(intro.id, { kind: 'beforeStage' })
    } else {
      this.runContinuation({ kind: 'beforeStage' })
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

    // The finishing stage's "after" story plays first, then the goal's action applies
    this.playStoryThen(this.currentStage()?.afterStoryId, { kind: 'goalAction', goalId: goal.id })
  }

  private applyGoalAction(goal: Goal): void {
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
          // The next stage's "before" story plays before its starting scene loads
          this.playStoryThen(next.beforeStoryId, next.startingSceneId
            ? { kind: 'loadScene', sceneId: next.startingSceneId }
            : { kind: 'none' })
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
    this.stopNarration()
    this.state.running = false
    this.canvas.removeEventListener('click', this.boundClick)
    this.canvas.removeEventListener('mousemove', this.boundMouseMove)
    this.canvas.removeEventListener('mousedown', this.boundMouseDown)
    window.removeEventListener('mouseup', this.boundMouseUp)
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown)
    window.removeEventListener('pointerup', this.boundPointerUp)
    window.removeEventListener('pointercancel', this.boundPointerUp)
    window.removeEventListener('pointermove', this.boundPointerMove)
    this.canvas.removeEventListener('contextmenu', this.boundContextMenu)
    this.dpadPointers.clear()
    window.removeEventListener('keydown', this.boundKeyDown)
    window.removeEventListener('keyup', this.boundKeyUp)
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
    this.repeatCounts.clear()
    this.imageCache.clear()
    this.pendingStories = []
    this.spawnTemplateIds = new Map()
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
    this.buildSceneState(sceneId, entryOverride, stageStart)
    this.fireSceneEnterEvents(sceneId)
  }

  /** Builds the scene's visuals, hero and NPC state. Fires no events, so save loading can use it too. */
  private buildSceneState(sceneId: string, entryOverride?: { x: number; y: number; facing?: FacingDirection }, stageStart = false) {
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
  }

  private fireSceneEnterEvents(sceneId: string) {
    const scene = this.project.scenes.find((s) => s.id === sceneId)
    // Fire scene-level 'enter' events — skip hotspot-bound events (those fire via zone detection)
    const hotspotIds = new Set(scene?.objects.filter((o) => o.type === 'hotspot').map((o) => o.id) ?? [])
    this.project.events
      .filter((e) => e.sceneId === sceneId && this.evTriggers(e).includes('enter') && e.enabled && !hotspotIds.has(e.objectId))
      .forEach((ev) => this.executeEvent(ev))
  }

  // ── Story Teller (book-style narration with page flips) ───────────────────

  /** The single-page book flagged to play as the game starts (before the title menu), if any. */
  private gameStartBook(): StoryBook | undefined {
    return (this.project.storyBooks ?? []).find((b) => b.playAtGameStart && b.pages.length === 1)
  }

  private currentStage(): Stage | undefined {
    return (this.project.stages ?? []).find((s) => s.id === this.state.currentStageId)
  }

  private assetUrl(assetId: string | undefined): string | undefined {
    if (!assetId) return undefined
    return this.project.assets.find((a) => a.id === assetId || a.name === assetId)?.url || undefined
  }

  /** Plays a story book if one is set, then runs the continuation. Runs it immediately when there is no story. */
  private playStoryThen(storyId: string | undefined, continuation: StoryContinuation): void {
    if (!storyId) {
      this.runContinuation(continuation)
      return
    }
    this.playStory(storyId, continuation)
  }

  /** Opens a story book full-screen. If another story is open, it is queued and played afterwards. */
  playStory(storyId: string, continuation: StoryContinuation = { kind: 'none' }): void {
    const book = (this.project.storyBooks ?? []).find((b) => b.id === storyId)
    if (!book || book.pages.length === 0) {
      this.runContinuation(continuation)
      return
    }
    if (this.state.story) {
      this.pendingStories.push({ book, continuation })
      return
    }
    this.beginStory(book, continuation)
  }

  /** Runs what should happen after a story (or directly, when there is no story). Plain data, so it can be saved. */
  private runContinuation(c: StoryContinuation): void {
    switch (c.kind) {
      case 'loadScene':
        this.loadScene(c.sceneId, undefined, true)
        break
      case 'goalAction': {
        const goal = (this.project.goals ?? []).find((g) => g.id === c.goalId)
        if (goal) this.applyGoalAction(goal)
        break
      }
      case 'beforeStage':
        this.playStoryThen(this.currentStage()?.beforeStoryId, { kind: 'loadScene', sceneId: this.state.currentSceneId })
        break
      case 'none':
        break
    }
  }

  private beginStory(book: StoryBook, continuation: StoryContinuation, pageIndex = 0): void {
    this.state.story = {
      book,
      pageIndex: Math.min(Math.max(0, pageIndex), book.pages.length - 1),
      flip: null,
      continuation,
      token: 0,
      narrating: false,
      audio: null,
      timer: null,
    }
    this.activeKeys.clear()
    for (const p of book.pages) {
      const url = this.assetUrl(p.imageAssetId)
      if (url) this.loadImage(url)
    }
    this.startPageNarration(false)
  }

  private endStory(): void {
    const s = this.state.story
    if (!s) return
    this.stopNarration()
    this.state.story = null
    this.runContinuation(s.continuation)
    // Start the next queued book only if the continuation did not open one already
    if (!this.state.story && this.pendingStories.length > 0) {
      const next = this.pendingStories.shift()!
      this.beginStory(next.book, next.continuation)
    }
  }

  private nextPage(): void {
    const s = this.state.story
    if (!s || s.flip) return
    if (s.pageIndex >= s.book.pages.length - 1) {
      this.endStory()
      return
    }
    this.startFlip(1, s.pageIndex + 1)
  }

  private prevPage(): void {
    const s = this.state.story
    if (!s || s.flip || s.pageIndex <= 0) return
    this.startFlip(-1, s.pageIndex - 1)
  }

  private startFlip(dir: 1 | -1, to: number): void {
    const s = this.state.story
    if (!s) return
    this.stopNarration()
    s.flip = { dir, to, t: 0 }
  }

  private updateStory(dt: number): void {
    const s = this.state.story
    if (!s || !s.flip) return
    s.flip.t = Math.min(1, s.flip.t + dt / STORY_FLIP_MS)
    if (s.flip.t >= 1) {
      s.pageIndex = s.flip.to
      s.flip = null
      this.startPageNarration(false)
    }
  }

  // ── Narration ─────────────────────────────────────────────────────────────

  /** Stops any narration and invalidates pending callbacks. */
  private stopNarration(): void {
    const s = this.state.story
    if (s) {
      s.token++
      s.narrating = false
      if (s.timer !== null) {
        clearTimeout(s.timer)
        s.timer = null
      }
      if (s.audio) {
        s.audio.pause()
        s.audio = null
      }
    }
    try {
      window.speechSynthesis?.cancel()
    } catch {
      // speech synthesis unavailable
    }
    if (hasNativeSpeech()) postToApp({ type: 'stopSpeech' })
  }

  /**
   * Reads the current page aloud. `manual` = started by the player (always reads).
   * Otherwise the page is read only when the book has "Read each page aloud" on.
   */
  private startPageNarration(manual: boolean): void {
    const s = this.state.story
    if (!s || s.flip) return
    this.stopNarration()
    const token = s.token
    const page = s.book.pages[s.pageIndex]
    if (!page) return

    const narrate = manual || s.book.autoRead
    if (narrate) {
      const audioUrl = this.assetUrl(page.audioAssetId)
      if (audioUrl) {
        const audio = new Audio(audioUrl)
        s.audio = audio
        s.narrating = true
        audio.onended = () => this.onNarrationDone(token)
        audio.play().catch(() => this.paceStoryPage(token, page))
        return
      }
      // Inside the Android app, speech goes through the native module (WebView speech is unreliable there)
      if (page.text.trim() && hasNativeSpeech()) {
        s.narrating = true
        postToApp({ type: 'speak', id: token, text: page.text, rate: page.rate ?? 1, pitch: page.pitch ?? 1 })
        return
      }
      if (page.text.trim() && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(page.text)
        u.rate = page.rate ?? 1
        u.pitch = page.pitch ?? 1
        const voice = window.speechSynthesis.getVoices().find((v) => v.name === page.voiceName)
        if (voice) u.voice = voice
        u.onend = () => this.onNarrationDone(token)
        u.onerror = () => {
          if (s.token === token) s.narrating = false
        }
        s.narrating = true
        window.speechSynthesis.speak(u)
        return
      }
      // Nothing can be read aloud for this page
      this.paceStoryPage(token, page)
    }
  }

  /** Narration has no audio to wait on: wait a length-based time, then auto-advance if enabled. */
  private paceStoryPage(token: number, page: StoryPage): void {
    const s = this.state.story
    if (!s || s.token !== token) return
    s.narrating = false
    if (!s.book.autoAdvance) return
    const words = page.text.split(/\s+/).filter(Boolean).length
    const ms = Math.max(2500, words * 450)
    s.timer = setTimeout(() => this.onNarrationDone(token), ms)
  }

  private onNarrationDone(token: number): void {
    const s = this.state.story
    if (!s || s.token !== token) return
    s.narrating = false
    s.audio = null
    s.timer = null
    if (s.book.autoAdvance) this.nextPage()
  }

  private toggleStoryNarration(): void {
    const s = this.state.story
    if (!s || s.flip) return
    if (s.narrating) this.stopNarration()
    else this.startPageNarration(true)
  }

  // ── Story input ───────────────────────────────────────────────────────────

  private handleStoryClick(e: MouseEvent): void {
    const s = this.state.story
    if (!s) return
    const rect = this.canvas.getBoundingClientRect()
    const cx = (e.clientX - rect.left) * (this.lw / rect.width)
    const cy = (e.clientY - rect.top) * (this.lh / rect.height)
    const hit = (r: Rect) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h

    if (hit(this.saveButtonRect)) { this.openSaveMenu('save', false); return }
    if (hit(this.storyRects.skip)) { this.endStory(); return }
    if (hit(this.storyRects.speaker)) { this.toggleStoryNarration(); return }
    if (!hit(this.storyRects.page)) return
    // Left third of the page turns back, everything else turns forward
    if (cx < this.storyRects.page.x + this.storyRects.page.w * 0.3) this.prevPage()
    else this.nextPage()
  }

  private handleStoryKey(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowRight':
      case ' ':
      case 'Enter':
        e.preventDefault()
        this.nextPage()
        break
      case 'ArrowLeft':
      case 'Backspace':
        e.preventDefault()
        this.prevPage()
        break
      case 'Escape':
        e.preventDefault()
        this.endStory()
        break
      case 'r':
      case 'R':
        this.toggleStoryNarration()
        break
    }
  }

  // ── Story rendering ───────────────────────────────────────────────────────

  private renderStory(): void {
    const s = this.state.story
    if (!s) return
    const { ctx } = this
    const cw = this.lw
    const ch = this.lh

    ctx.fillStyle = '#14100c'
    ctx.fillRect(0, 0, cw, ch)

    const W = Math.max(160, Math.min(cw - 80, 620))
    const H = Math.max(200, Math.min(ch - 110, 480))
    const X0 = (cw - W) / 2
    const Y0 = (ch - H) / 2 - 8
    this.storyRects.page = { x: X0, y: Y0, w: W, h: H }

    // Leather board behind the page
    ctx.fillStyle = '#4a2c18'
    ctx.fillRect(X0 - 10, Y0 - 8, W + 20, H + 16)

    const book = s.book
    if (s.flip) {
      const flip = s.flip
      // The page being revealed sits underneath
      this.drawStoryPage(book.pages[flip.to], book, X0, Y0, W, H, flip.to)

      // The turning sheet: its width goes W → 0 → W (folding over the spine)
      const sx = Math.max(0.001, Math.abs(Math.cos(Math.PI * flip.t)))
      const showFront = flip.t < 0.5
      const faceIndex = showFront ? s.pageIndex : flip.to
      const sheetX = flip.dir === 1 ? X0 : X0 + W - W * sx

      ctx.save()
      ctx.translate(flip.dir === 1 ? X0 : X0 + W, Y0)
      ctx.scale(sx, 1)
      this.drawStoryPage(book.pages[faceIndex], book, flip.dir === 1 ? 0 : -W, 0, W, H, faceIndex)
      ctx.restore()

      // Shade the sheet as it turns away from the light
      ctx.fillStyle = `rgba(0,0,0,${(0.4 * (1 - sx)).toFixed(3)})`
      ctx.fillRect(sheetX, Y0, W * sx, H)
    } else {
      this.drawStoryPage(book.pages[s.pageIndex], book, X0, Y0, W, H, s.pageIndex)
    }

    // Controls
    const skipW = this.tap(80), btnH = this.tap(28)
    this.storyRects.speaker = { x: 10, y: 10, w: 150, h: btnH }
    this.storyRects.skip = { x: cw - skipW - 10, y: 10, w: skipW, h: btnH }
    this.drawStoryButton(this.storyRects.speaker, s.narrating ? 'Stop reading (R)' : 'Read aloud (R)')
    this.drawStoryButton(this.storyRects.skip, 'Skip (Esc)')
    this.renderSaveButton()

    // Page counter and turn hints
    ctx.font = '13px sans-serif'
    ctx.fillStyle = '#e8d9b5'
    ctx.textBaseline = 'middle'
    const hintY = Y0 + H + 22
    ctx.textAlign = 'center'
    ctx.fillText(`${s.pageIndex + 1} / ${book.pages.length}`, cw / 2, hintY)
    ctx.textAlign = 'left'
    if (s.pageIndex > 0) ctx.fillText('◀ back', X0, hintY)
    ctx.textAlign = 'right'
    ctx.fillText(s.pageIndex >= book.pages.length - 1 ? 'Finish ▶' : 'next ▶', X0 + W, hintY)
  }

  private drawStoryButton(r: Rect, label: string): void {
    const { ctx } = this
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.strokeStyle = '#c9a66b'
    ctx.lineWidth = 1
    ctx.strokeRect(r.x, r.y, r.w, r.h)
    ctx.font = '13px sans-serif'
    ctx.fillStyle = '#f1e6c8'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2)
  }

  private drawStoryPage(
    page: StoryPage | undefined, book: StoryBook,
    x: number, y: number, w: number, h: number, pageNum: number,
  ): void {
    if (!page) return
    const { ctx } = this
    const paper = STORY_PAPER[book.paperStyle] ?? STORY_PAPER.parchment

    ctx.fillStyle = paper.bg
    ctx.fillRect(x, y, w, h)
    // Gutter shadow along the spine
    const gutter = ctx.createLinearGradient(x, 0, x + w * 0.08, 0)
    gutter.addColorStop(0, 'rgba(0,0,0,0.18)')
    gutter.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gutter
    ctx.fillRect(x, y, w * 0.08, h)
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)

    const pad = Math.max(18, w * 0.05)
    const footerH = 34
    const innerW = w - pad * 2
    let top = y + pad

    const imgUrl = this.assetUrl(page.imageAssetId)
    const img = imgUrl ? this.imageCache.get(imgUrl) : undefined
    if (img) {
      const maxImgH = (h - pad * 2 - footerH) * 0.45
      const scale = Math.min(innerW / img.width, maxImgH / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, x + (w - dw) / 2, top, dw, dh)
      top += dh + 14
    }

    const textBottom = y + h - footerH
    const { lines, fs, lh } = this.layoutStoryText(page.text, innerW, textBottom - top, book.fontSize)
    ctx.font = `${fs}px ${STORY_FONT_FAMILY}`
    ctx.fillStyle = paper.fg
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    let ty = top
    for (const line of lines) {
      ctx.fillText(line, x + pad, ty)
      ty += lh
    }

    ctx.font = `12px ${STORY_FONT_FAMILY}`
    ctx.fillStyle = paper.fg
    ctx.globalAlpha = 0.6
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(String(pageNum + 1), x + w / 2, y + h - 12)
    ctx.globalAlpha = 1
  }

  /** Word-wraps text, shrinking the font (down to 11px) until it fits in maxH. */
  private layoutStoryText(
    text: string, maxW: number, maxH: number, baseFs: number,
  ): { lines: string[]; fs: number; lh: number } {
    const { ctx } = this
    const wrap = (fs: number): string[] => {
      ctx.font = `${fs}px ${STORY_FONT_FAMILY}`
      const out: string[] = []
      for (const para of text.split('\n')) {
        const words = para.split(/\s+/).filter(Boolean)
        if (words.length === 0) { out.push(''); continue }
        let line = ''
        for (const word of words) {
          const test = line ? `${line} ${word}` : word
          if (line && ctx.measureText(test).width > maxW) {
            out.push(line)
            line = word
          } else {
            line = test
          }
        }
        out.push(line)
      }
      return out
    }

    for (let fs = Math.max(11, baseFs); fs >= 11; fs -= 1) {
      const lh = Math.round(fs * 1.45)
      const lines = wrap(fs)
      if (lines.length * lh <= maxH) return { lines, fs, lh }
    }
    const lh = Math.round(11 * 1.45)
    const lines = wrap(11).slice(0, Math.max(1, Math.floor(maxH / lh)))
    return { lines, fs: 11, lh }
  }

  // ── Touch controls ────────────────────────────────────────────────────────

  /** Canvas pixels per on-screen CSS pixel (1 when the canvas is not laid out). */
  private screenScale(): number {
    const h = this.canvas.clientHeight
    return h > 0 ? h / this.lh : 1
  }

  /** A size in canvas pixels; on touch screens it grows so the target is at least 44 CSS pixels. */
  private tap(basePx: number): number {
    if (!this.touch) return basePx
    return Math.max(basePx, Math.ceil(TAP_MIN_CSS_PX / this.screenScale()))
  }

  private canvasPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (this.lw / rect.width),
      y: (e.clientY - rect.top) * (this.lh / rect.height),
    }
  }

  private dpadKeyAt(p: { x: number; y: number }): DpadKey | null {
    for (const key of Object.keys(this.dpadRects) as DpadKey[]) {
      const r = this.dpadRects[key]
      if (r.w > 0 && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return key
    }
    return null
  }

  /** Four-way pad at the bottom-left. Holding an arrow sets the same key the keyboard would. */
  private renderDpad() {
    const hidden: Rect = { x: 0, y: 0, w: 0, h: 0 }
    const visible = this.touch && !this.state.showTitleScreen && !this.state.story && !this.state.saveMenu &&
      !this.state.miniGame && !this.state.questLogOpen && !this.state.cinematic && !this.state.dialogText
    if (!visible) {
      this.dpadRects = { ArrowUp: hidden, ArrowDown: hidden, ArrowLeft: hidden, ArrowRight: hidden }
      return
    }
    const { ctx } = this
    const s = this.tap(60)
    const cx = 16 + s * 1.5
    const cy = this.lh - 16 - s * 1.5
    const centres: Record<DpadKey, [number, number]> = {
      ArrowUp: [cx, cy - s], ArrowDown: [cx, cy + s], ArrowLeft: [cx - s, cy], ArrowRight: [cx + s, cy],
    }
    const held = new Set(this.dpadPointers.values())
    for (const key of Object.keys(centres) as DpadKey[]) {
      const [x, y] = centres[key]
      const r: Rect = { x: x - s / 2 + 4, y: y - s / 2 + 4, w: s - 8, h: s - 8 }
      this.dpadRects[key] = r
      ctx.fillStyle = held.has(key) ? 'rgba(99,102,241,0.85)' : 'rgba(0,0,0,0.45)'
      ctx.strokeStyle = '#c7d2fe'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(r.x, r.y, r.w, r.h, 10)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#e0e7ff'
      ctx.font = `${Math.round(s * 0.4)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(DPAD_GLYPH[key], r.x + r.w / 2, r.y + r.h / 2)
    }
  }

  private handlePointerDown(e: PointerEvent) {
    if (!this.touch) return
    const key = this.dpadKeyAt(this.canvasPoint(e))
    if (!key) return
    this.dpadPointers.set(e.pointerId, key)
    this.activeKeys.add(key)
  }

  // Sliding a held finger onto another arrow switches to it; sliding off the pad releases it.
  private handlePointerMove(e: PointerEvent) {
    const held = this.dpadPointers.get(e.pointerId)
    if (!held) return
    const over = this.dpadKeyAt(this.canvasPoint(e))
    if (over === held) return
    this.dpadPointers.delete(e.pointerId)
    if (!new Set(this.dpadPointers.values()).has(held)) this.activeKeys.delete(held)
    if (over) {
      this.dpadPointers.set(e.pointerId, over)
      this.activeKeys.add(over)
    }
  }

  private handlePointerUp(e: PointerEvent) {
    const key = this.dpadPointers.get(e.pointerId)
    if (!key) return
    this.dpadPointers.delete(e.pointerId)
    if (!new Set(this.dpadPointers.values()).has(key)) this.activeKeys.delete(key)
  }

  // ── Save slots (player saves in localStorage) ─────────────────────────────

  private saveSlotCount(): number {
    const n = Math.floor(Number(this.project.settings?.saveSlotCount) || 3)
    return Math.min(10, Math.max(1, n))
  }

  private saveKey(slot: number): string {
    return `agb-save:${this.project.id}:${slot}`
  }

  readSaveSlot(slot: number): SaveSlotRead {
    let raw: string | null
    try {
      raw = localStorage.getItem(this.saveKey(slot))
    } catch {
      return { status: 'corrupt' }
    }
    if (!raw) return { status: 'empty' }
    try {
      const data = JSON.parse(raw) as SaveSlotData
      if (data && data.version === 1) return { status: 'ok', data }
    } catch {
      // fall through: unreadable JSON
    }
    return { status: 'corrupt' }
  }

  private writeSaveSlot(slot: number, data: SaveSlotData): { ok: true; kb: number } | { ok: false; error: string } {
    const json = JSON.stringify(data)
    const kb = Math.max(1, Math.ceil(json.length / 1024))
    try {
      localStorage.setItem(this.saveKey(slot), json)
      return { ok: true, kb }
    } catch (err) {
      const quota = err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      return {
        ok: false,
        error: quota
          ? 'Not saved: browser storage is full (about 5 MB per site). Clear a slot and try again.'
          : 'Not saved: browser storage is blocked.',
      }
    }
  }

  /** Captures everything needed to resume. Story progress is stored as data, not callbacks. */
  private buildSaveData(): SaveSlotData {
    const scene = this.project.scenes.find((sc) => sc.id === this.state.currentSceneId)
    const stage = this.currentStage()
    const story = this.state.story
    const hero = this.state.character
    return {
      version: 1,
      projectId: this.project.id,
      savedAt: new Date().toISOString(),
      sceneName: scene?.name ?? '',
      stageName: stage?.name ?? '',
      sceneId: this.state.currentSceneId,
      stageId: this.state.currentStageId,
      variables: { ...this.state.variables },
      visitedScenes: [...this.state.visitedScenes],
      activeQuestIds: [...this.state.activeQuestIds],
      completedQuestIds: [...this.state.completedQuestIds],
      completedGoalIds: (this.project.goals ?? [])
        .filter((g) => (g as Goal & { completed?: boolean }).completed)
        .map((g) => g.id),
      character: hero ? { x: hero.x, y: hero.y, facing: hero.facing } : null,
      npcs: Array.from(this.state.npcStates.entries()).map(([objectId, n]) => ({
        objectId, x: n.x, y: n.y, facing: n.facing,
      })),
      objectVisibility: Array.from(this.objectVisibility.entries()),
      removedObjects: Array.from(this.removedObjects),
      // Spawned objects are saved as a reference to their template plus position, never as full copies
      spawned: this.project.scenes.flatMap((sc) =>
        sc.objects
          .filter((o) => this.spawnTemplateIds.has(o.id))
          .map((o) => ({
            sceneId: sc.id, id: o.id, templateId: this.spawnTemplateIds.get(o.id) ?? '', x: o.x, y: o.y,
          }))
      ),
      story: story
        ? {
            bookId: story.book.id,
            pageIndex: story.flip ? story.flip.to : story.pageIndex,
            continuation: story.continuation,
          }
        : null,
      pendingStories: this.pendingStories.map((p) => ({ bookId: p.book.id, continuation: p.continuation })),
    }
  }

  private findObjectById(id: string): SceneObject | undefined {
    for (const sc of this.project.scenes) {
      const o = sc.objects.find((x) => x.id === id)
      if (o) return o
    }
    return undefined
  }

  /** Rebuilds the game from a save. Fires no enter/stage events, since those already ran before the save. */
  private restoreFromSave(data: SaveSlotData): boolean {
    if (data.version !== 1 || data.projectId !== this.project.id) return false
    const books = this.project.storyBooks ?? []

    this.stopNarration()
    this.state.story = null
    this.pendingStories = []
    this.state.dialogText = null
    this.state.dialogCallback = null
    this.state.cinematic = null
    this.state.questLogOpen = false
    this.state.saveMenu = null
    this.state.showTitleScreen = false
    this.activeKeys.clear()

    this.state.currentStageId = data.stageId
    this.state.variables = { ...data.variables }
    this.state.visitedScenes = [...data.visitedScenes]
    this.state.activeQuestIds = [...data.activeQuestIds]
    this.state.completedQuestIds = [...data.completedQuestIds]

    // Goal completion is stored on the goal objects, so set every goal explicitly
    const doneGoals = new Set(data.completedGoalIds)
    for (const g of this.project.goals ?? []) {
      ;(g as Goal & { completed?: boolean }).completed = doneGoals.has(g.id)
    }

    // Replace this session's spawns with the saved ones
    for (const sc of this.project.scenes) {
      sc.objects = sc.objects.filter((o) => !this.spawnTemplateIds.has(o.id))
    }
    this.spawnTemplateIds = new Map()
    for (const sp of data.spawned) {
      const sc = this.project.scenes.find((x) => x.id === sp.sceneId)
      const template = this.findObjectById(sp.templateId)
      if (!sc || !template) continue
      sc.objects.push({ ...template, id: sp.id, x: sp.x, y: sp.y, visible: true })
      this.spawnTemplateIds.set(sp.id, sp.templateId)
    }

    this.objectVisibility = new Map(data.objectVisibility)
    this.removedObjects = new Set(data.removedObjects)
    this.state.currentSceneId = data.sceneId
    this.state.activeHotspots = new Set()
    this.state.activeTeleportZones = new Set()
    this.buildSceneState(data.sceneId, data.character ?? undefined, false)

    // Put NPCs back where they were
    for (const n of data.npcs) {
      const st = this.state.npcStates.get(n.objectId)
      if (st) {
        st.x = n.x
        st.y = n.y
        st.facing = n.facing
      }
    }

    // Resume any story that was open, then any that were queued behind it
    this.pendingStories = data.pendingStories
      .map((p) => ({ book: books.find((b) => b.id === p.bookId), continuation: p.continuation }))
      .filter((p): p is { book: StoryBook; continuation: StoryContinuation } => !!p.book)
    if (data.story) {
      const book = books.find((b) => b.id === data.story!.bookId)
      if (book) {
        this.beginStory(book, data.story.continuation, data.story.pageIndex)
      } else {
        this.runContinuation(data.story.continuation)
      }
    }
    if (!this.state.story && this.pendingStories.length > 0) {
      const next = this.pendingStories.shift()!
      this.beginStory(next.book, next.continuation)
    }
    return true
  }

  private openSaveMenu(mode: 'save' | 'load', fromTitle: boolean): void {
    this.state.saveMenu = { mode: fromTitle ? 'load' : mode, fromTitle }
    this.activeKeys.clear()
  }

  private closeSaveMenu(): void {
    this.state.saveMenu = null
  }

  // ── Save/Load screen ──────────────────────────────────────────────────────

  private renderSaveButton() {
    if (this.state.showTitleScreen) return
    const { ctx } = this
    // Inside a story the button sits right of the Read aloud button; in play it sits left of the quest button
    const w = this.tap(84), h = this.tap(28), y = 8
    const x = this.state.story ? 168 : this.lw - this.tap(52) - 8 - 8 - w
    this.saveButtonRect = { x, y, w, h }
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = `bold ${Math.max(10, Math.min(12, this.lw / 80))}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Save / Load', x + w / 2, y + h / 2)
  }

  private drawSaveMenuButton(r: Rect, label: string, active = false) {
    const { ctx } = this
    ctx.fillStyle = active ? '#4f46e5' : 'rgba(255,255,255,0.06)'
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(r.x, r.y, r.w, r.h, 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2)
  }

  private renderSaveMenu() {
    const sm = this.state.saveMenu
    if (!sm) return
    const { ctx } = this
    const cw = this.lw, ch = this.lh

    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, cw, ch)

    const slots = this.saveSlotCount()
    const panelW = Math.min(cw - 40, 480)
    const panelH = Math.min(ch - 40, 170 + slots * 64)
    const px = (cw - panelW) / 2
    const py = (ch - panelH) / 2
    ctx.fillStyle = '#111827'
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(px, py, panelW, panelH, 10)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#e2e8f0'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(sm.mode === 'save' ? 'Save Game' : 'Load Game', cw / 2, py + 16)

    // Tabs: a title-screen visit can only load
    const tabY = py + 48, tabW = 110, tabH = this.tap(28)
    if (sm.fromTitle) {
      this.saveMenuRects.tabSave = { x: 0, y: 0, w: 0, h: 0 }
      this.saveMenuRects.tabLoad = { x: cw / 2 - tabW / 2, y: tabY, w: tabW, h: tabH }
    } else {
      this.saveMenuRects.tabSave = { x: cw / 2 - tabW - 4, y: tabY, w: tabW, h: tabH }
      this.saveMenuRects.tabLoad = { x: cw / 2 + 4, y: tabY, w: tabW, h: tabH }
      this.drawSaveMenuButton(this.saveMenuRects.tabSave, 'Save', sm.mode === 'save')
    }
    this.drawSaveMenuButton(this.saveMenuRects.tabLoad, 'Load', sm.mode === 'load')

    // Slot rows
    const top = tabY + tabH + 14
    const bottomReserved = 74
    const rowH = Math.max(28, Math.min(56, (py + panelH - bottomReserved - top) / slots - 8))
    this.saveMenuRects.slots = []
    for (let i = 0; i < slots; i++) {
      const r = { x: px + 16, y: top + i * (rowH + 8), w: panelW - 32, h: rowH }
      this.saveMenuRects.slots.push(r)
      const read = this.readSaveSlot(i + 1)
      const data = read.status === 'ok' ? read.data : null
      const usable = sm.mode === 'save' || read.status !== 'empty'
      ctx.globalAlpha = usable ? 1 : 0.45
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      // Amber outline marks the slot waiting for a second click to overwrite
      ctx.strokeStyle = sm.confirmSlot === i + 1 ? '#f59e0b' : '#374151'
      ctx.lineWidth = sm.confirmSlot === i + 1 ? 2 : 1
      ctx.beginPath()
      ctx.roundRect(r.x, r.y, r.w, r.h, 6)
      ctx.fill()
      ctx.stroke()
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#e2e8f0'
      ctx.font = 'bold 13px sans-serif'
      ctx.fillText(`Slot ${i + 1}`, r.x + 12, r.y + r.h / 2 - (read.status === 'empty' ? 0 : 8))
      if (data) {
        ctx.fillStyle = '#94a3b8'
        ctx.font = '12px sans-serif'
        const place = [data.sceneName, data.stageName].filter(Boolean).join(' · ')
        ctx.fillText(place || 'Saved game', r.x + 12, r.y + r.h / 2 + 9)
        ctx.textAlign = 'right'
        ctx.fillText(new Date(data.savedAt).toLocaleString(), r.x + r.w - 12, r.y + r.h / 2)
      } else if (read.status === 'corrupt') {
        ctx.fillStyle = '#f87171'
        ctx.font = '12px sans-serif'
        ctx.fillText('Damaged save: cannot be loaded', r.x + 12, r.y + r.h / 2 + 9)
      } else {
        ctx.fillStyle = '#64748b'
        ctx.font = '12px sans-serif'
        ctx.fillText('Empty', r.x + 12, r.y + r.h / 2 + 9)
      }
      ctx.globalAlpha = 1
    }

    const backH = this.tap(30)
    const backY = py + panelH - backH - 12
    // Message and back button
    ctx.fillStyle = sm.messageIsError ? '#fca5a5' : '#a5b4fc'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (sm.message) ctx.fillText(sm.message, cw / 2, backY - 14)
    this.saveMenuRects.back = { x: cw / 2 - 60, y: backY, w: 120, h: backH }
    this.drawSaveMenuButton(this.saveMenuRects.back, 'Back (Esc)')
  }

  private handleSaveMenuClick(e: MouseEvent) {
    const sm = this.state.saveMenu
    if (!sm) return
    const rect = this.canvas.getBoundingClientRect()
    const cx = (e.clientX - rect.left) * (this.lw / rect.width)
    const cy = (e.clientY - rect.top) * (this.lh / rect.height)
    const hit = (r: Rect) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h
    const setMessage = (text: string | undefined, isError = false) => {
      sm.message = text
      sm.messageIsError = isError
    }

    if (hit(this.saveMenuRects.back)) { this.closeSaveMenu(); return }
    if (hit(this.saveMenuRects.tabSave) && !sm.fromTitle) {
      sm.mode = 'save'; sm.confirmSlot = undefined; setMessage(undefined); return
    }
    if (hit(this.saveMenuRects.tabLoad)) {
      sm.mode = 'load'; sm.confirmSlot = undefined; setMessage(undefined); return
    }

    const slotIndex = this.saveMenuRects.slots.findIndex((r) => hit(r))
    if (slotIndex < 0) return
    const slot = slotIndex + 1
    const current = this.readSaveSlot(slot)

    if (sm.mode === 'save') {
      if (sm.fromTitle) return
      // Overwriting needs a second click on the same slot
      if (current.status !== 'empty' && sm.confirmSlot !== slot) {
        sm.confirmSlot = slot
        setMessage(`Slot ${slot} already has a save. Click it again to overwrite.`)
        return
      }
      sm.confirmSlot = undefined
      const result = this.writeSaveSlot(slot, this.buildSaveData())
      if (result.ok) setMessage(`Saved to slot ${slot} (${result.kb} KB)`)
      else setMessage(result.error, true)
      return
    }

    sm.confirmSlot = undefined
    if (current.status === 'empty') return
    if (current.status === 'corrupt') {
      setMessage(`Slot ${slot} is damaged and cannot be loaded.`, true)
      return
    }
    if (!this.restoreFromSave(current.data)) setMessage('That save belongs to a different game', true)
  }

  // ── Render loop ───────────────────────────────────────────────────────────

  private renderLoop() {
    if (!this.state.running) return
    const now = performance.now()
    const dt = this.lastFrameTime ? Math.min(now - this.lastFrameTime, 100) : 16
    this.lastFrameTime = now
    if (this.state.story && !this.state.saveMenu) this.updateStory(dt)
    // The scene is frozen while a story book is open
    if (!this.state.showTitleScreen && !this.state.story && !this.state.saveMenu) {
      this.updateCharacter(dt)
      const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)
      if (scene) {
        this.updateArrowMovement(dt, scene)
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
      const ns = this.state.npcStates.get(obj.id)
      const ox = ns ? ns.x : obj.x
      const oy = ns ? ns.y : obj.y
      const overlaps =
        hx < ox + obj.width && hx + hw > ox &&
        hy < oy + obj.height && hy + hh > oy
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
    const zones = scene.blockedZones ?? []

    const overlaps = (x: number, y: number): boolean => feetBlocked(zones, x, mc.width, y + mc.height)

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
              mc.height * char.scale - mc.height / 2,
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
    const { ctx } = this
    const text = cine.actionText
    const fontSize = 20
    ctx.font = `bold ${fontSize}px sans-serif`
    const w = ctx.measureText(text).width + 32
    const h = 44
    const x = (this.lw - w) / 2
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
    ctx.fillText(text, this.lw / 2, y + h / 2)
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

  // ── Arrow-key movement ────────────────────────────────────────────────────

  // A position is blocked when the character's feet would be inside a zone (the head may overlap).
  // fromFeetY is the feet position before the move, so a step cannot jump over a thin zone.
  private isBlockedAt(x: number, y: number, cw: number, ch: number, scene: Scene, fromFeetY?: number): boolean {
    return feetBlocked(scene.blockedZones ?? [], x, cw, y + ch, fromFeetY ?? y + ch)
  }

  private updateArrowMovement(dt: number, scene: Scene) {
    const char = this.state.character
    const mc = this.project.mainCharacter
    if (!char || !mc) return
    if (this.state.dialogText || this.state.cinematic || this.state.miniGame || this.state.questLogOpen) return

    const moveX = (this.activeKeys.has('ArrowRight') ? 1 : 0) - (this.activeKeys.has('ArrowLeft') ? 1 : 0)
    const moveY = (this.activeKeys.has('ArrowDown') ? 1 : 0) - (this.activeKeys.has('ArrowUp') ? 1 : 0)
    if (moveX === 0 && moveY === 0) return

    // Cancel any in-progress click-to-move navigation
    if (char.waypoints.length > 0) {
      char.waypoints = []
      char.waypointIndex = 0
      char.moving = false
    }

    // Normalise diagonal movement so speed is consistent in all directions
    const len = Math.sqrt(moveX * moveX + moveY * moveY)
    const speed = CHAR_SPEED * char.speedMult
    const dx = (moveX / len) * speed * dt / 1000
    const dy = (moveY / len) * speed * dt / 1000

    // Facing: dominant axis wins
    if (Math.abs(moveX) >= Math.abs(moveY)) char.facing = moveX > 0 ? 'right' : 'left'
    else char.facing = moveY > 0 ? 'down' : 'up'

    const cw = mc.width * char.scale
    const ch = mc.height * char.scale

    // Slide along walls: test X and Y independently
    const newX = Math.max(0, Math.min(scene.width - cw, char.x + dx))
    if (!this.isBlockedAt(newX, char.y, cw, ch, scene)) char.x = newX

    const newY = Math.max(0, Math.min(scene.height - ch, char.y + dy))
    if (!this.isBlockedAt(char.x, newY, cw, ch, scene, char.y + ch)) char.y = newY

    // Keep animation running
    char.moving = true
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
    const { ctx } = this
    ctx.clearRect(0, 0, this.lw, this.lh)

    if (this.state.story) {
      this.renderStory()
      if (this.state.saveMenu) this.renderSaveMenu()
      return
    }

    this.renderMainFrame()
    if (this.state.saveMenu) this.renderSaveMenu()
  }

  private renderMainFrame() {
    const { ctx } = this
    if (this.state.showTitleScreen) {
      this.renderTitleScreen()
      return
    }

    const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)

    if (!scene) {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, this.lw, this.lh)
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '20px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No scene — add scenes in the Scene Editor', this.lw / 2, this.lh / 2)
      return
    }

    const scaleX = this.lw / scene.width
    const scaleY = this.lh / scene.height

    ctx.save()
    ctx.scale(scaleX, scaleY)
    this.renderScene(scene)
    ctx.restore()

    if (this.state.dialogText) this.renderDialog()
    if (this.state.cinematic?.actionText) this.renderActionLabel()
    this.renderQuestHUDButton()
    this.renderSaveButton()
    this.renderDpad()
    if (this.state.questLogOpen) this.renderQuestLog()
  }

  private renderTitleScreen() {
    const { ctx } = this
    const ts = this.project.titleScreen

    ctx.fillStyle = ts?.backgroundColor || '#000000'
    ctx.fillRect(0, 0, this.lw, this.lh)

    if (ts?.backgroundImageUrl) {
      const img = this.imageCache.get(ts.backgroundImageUrl)
      if (img) ctx.drawImage(img, 0, 0, this.lw, this.lh)
    }

    if (ts?.titleText) {
      const fontSize = ts.titleFontSize || 48
      ctx.font = `bold ${fontSize}px sans-serif`
      ctx.fillStyle = ts.titleColor || '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ts.titleText, this.lw / 2, this.lh * 0.22)
    }

    if (ts?.subtitleText) {
      const fontSize = ts.subtitleFontSize || 24
      ctx.font = `${fontSize}px sans-serif`
      ctx.fillStyle = ts.subtitleColor || '#cccccc'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ts.subtitleText, this.lw / 2, this.lh * 0.36)
    }

    this.titleScreenButtonRects = []
    const buttons = [...(ts?.buttons ?? [])].sort((a, b) => a.order - b.order)
    const btnW = Math.min(240, this.lw * 0.5)
    const btnH = 48
    const btnGap = 16
    const startY = this.lh * 0.52

    buttons.forEach((btn, i) => {
      const x = (this.lw - btnW) / 2
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

  private startGame(buttonAction: string) {
    if (buttonAction === 'load_game') {
      this.openSaveMenu('load', true)
      return
    }
    this.state.showTitleScreen = false
    this.runContinuation({ kind: 'beforeStage' })
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
    const { ctx } = this
    const padding = 24
    const boxH = 130
    const boxY = this.lh - boxH - 12

    ctx.fillStyle = 'rgba(0,0,0,0.88)'
    ctx.fillRect(8, boxY, this.lw - 16, boxH)
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2
    ctx.strokeRect(8, boxY, this.lw - 16, boxH)

    const fontSize = Math.max(12, Math.min(16, this.lw / 50))
    ctx.font = `${fontSize}px sans-serif`
    ctx.fillStyle = '#e2e8f0'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    const maxWidth = this.lw - 16 - padding * 2
    const lineHeight = fontSize + 6
    let lineY = boxY + padding

    const paragraphs = (this.state.dialogText ?? '').split('\n')
    for (const para of paragraphs) {
      const words = para.split(' ')
      let line = ''
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
      if (line.trim()) { ctx.fillText(line.trim(), 8 + padding, lineY); lineY += lineHeight }
    }

    ctx.fillStyle = '#6366f1'
    ctx.font = `12px sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('▶ Click to continue', this.lw - 16, boxY + boxH - 8)
  }

  private renderQuestHUDButton() {
    if (this.state.showTitleScreen) return
    const { ctx } = this
    const w = this.tap(52), h = this.tap(28), x = this.lw - w - 8, y = 8
    this.questButtonRect = { x, y, w, h }
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = `bold ${Math.max(10, Math.min(12, this.lw / 80))}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`📜 ${this.state.activeQuestIds.length}`, x + w / 2, y + h / 2)
  }

  private renderQuestLog() {
    const { ctx } = this
    const panelW = Math.min(320, this.lw * 0.85)
    const panelH = Math.min(this.lh * 0.78, 500)
    const panelX = this.lw - panelW - 8
    const panelY = 44

    ctx.fillStyle = 'rgba(15,15,30,0.96)'
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(panelX, panelY, panelW, panelH, 8)
    ctx.fill()
    ctx.stroke()

    const fontSize = Math.max(11, Math.min(13, this.lw / 70))
    const lineH = fontSize + 6
    const pad = 14

    // Header
    ctx.fillStyle = '#e2e8f0'
    ctx.font = `bold ${fontSize + 2}px sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('Quest Log', panelX + pad, panelY + pad)

    // Close button
    const closeW = 22, closeH = 22
    const closeX = panelX + panelW - closeW - 8
    const closeY = panelY + 8
    this.questLogCloseRect = { x: closeX, y: closeY, w: closeW, h: closeH }
    ctx.fillStyle = '#374151'
    ctx.beginPath()
    ctx.roundRect(closeX, closeY, closeW, closeH, 4)
    ctx.fill()
    ctx.fillStyle = '#9ca3af'
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('x', closeX + closeW / 2, closeY + closeH / 2)

    const quests = this.project.quests ?? []
    let curY = panelY + pad + fontSize + 4 + lineH

    const wrapText = (text: string, x: number, maxW: number, startY: number): number => {
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      const words = text.split(' ')
      let line = ''
      let y = startY
      for (const word of words) {
        const test = line + word + ' '
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line.trim(), x, y)
          line = word + ' '
          y += lineH
        } else {
          line = test
        }
      }
      if (line.trim()) { ctx.fillText(line.trim(), x, y); y += lineH }
      return y
    }

    // Active quests
    const active = this.state.activeQuestIds.map((id) => quests.find((q) => q.id === id)).filter(Boolean) as typeof quests
    if (active.length > 0) {
      ctx.fillStyle = '#818cf8'
      ctx.font = `bold ${fontSize}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('Active', panelX + pad, curY)
      curY += lineH + 2

      for (const quest of active) {
        if (curY > panelY + panelH - pad) break
        ctx.fillStyle = '#e2e8f0'
        ctx.font = `bold ${fontSize}px sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(quest.name, panelX + pad, curY)
        curY += lineH
        ctx.fillStyle = '#94a3b8'
        curY = wrapText(quest.description, panelX + pad, panelW - pad * 2, curY)
        for (const obj of quest.objectives ?? []) {
          if (curY > panelY + panelH - pad) break
          ctx.fillStyle = '#6b7280'
          ctx.fillText(`  o ${obj.text}`, panelX + pad + 4, curY)
          curY += lineH
        }
        curY += 4
      }
    }

    // Completed quests
    const completed = this.state.completedQuestIds.map((id) => quests.find((q) => q.id === id)).filter(Boolean) as typeof quests
    if (completed.length > 0 && curY < panelY + panelH - pad) {
      ctx.fillStyle = '#6b7280'
      ctx.font = `bold ${fontSize}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('Completed', panelX + pad, curY)
      curY += lineH + 2
      for (const quest of completed) {
        if (curY > panelY + panelH - pad) break
        ctx.fillStyle = '#4b5563'
        ctx.font = `${fontSize}px sans-serif`
        ctx.fillText(`✓ ${quest.name}`, panelX + pad, curY)
        curY += lineH
      }
    }

    if (active.length === 0 && completed.length === 0) {
      ctx.fillStyle = '#6b7280'
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('No quests yet.', panelX + pad, curY)
    }
  }

  // ── Input handling ────────────────────────────────────────────────────────

  private getScenePos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left) * (this.lw / rect.width)
    const canvasY = (e.clientY - rect.top) * (this.lh / rect.height)
    const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)
    if (!scene) return { x: canvasX, y: canvasY }
    return {
      x: canvasX / (this.lw / scene.width),
      y: canvasY / (this.lh / scene.height),
    }
  }

  private handleClick(e: MouseEvent) {
    if (this.touch && this.dpadKeyAt(this.canvasPoint(e))) return
    if (this.state.saveMenu) {
      this.handleSaveMenuClick(e)
      return
    }
    if (this.state.story) {
      this.handleStoryClick(e)
      return
    }

    if (this.state.showTitleScreen) {
      const rect = this.canvas.getBoundingClientRect()
      const cx = (e.clientX - rect.left) * (this.lw / rect.width)
      const cy = (e.clientY - rect.top) * (this.lh / rect.height)
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

    // Quest log close button
    const rect2 = this.canvas.getBoundingClientRect()
    const cx2 = (e.clientX - rect2.left) * (this.lw / rect2.width)
    const cy2 = (e.clientY - rect2.top) * (this.lh / rect2.height)

    if (this.state.questLogOpen) {
      const cl = this.questLogCloseRect
      if (cx2 >= cl.x && cx2 <= cl.x + cl.w && cy2 >= cl.y && cy2 <= cl.y + cl.h) {
        this.state.questLogOpen = false
        return
      }
      // Swallow all other clicks when log is open
      return
    }

    // Quest HUD button
    const qb = this.questButtonRect
    if (cx2 >= qb.x && cx2 <= qb.x + qb.w && cy2 >= qb.y && cy2 <= qb.y + qb.h) {
      this.state.questLogOpen = true
      return
    }

    // Save / Load HUD button
    const sb = this.saveButtonRect
    if (cx2 >= sb.x && cx2 <= sb.x + sb.w && cy2 >= sb.y && cy2 <= sb.y + sb.h) {
      this.openSaveMenu('save', false)
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
        mc.height * char.scale - mc.height / 2,
      )
      if (path.length > 0) {
        char.waypoints = path
        char.waypointIndex = 0
        char.moving = true
      }
    }
  }

  /**
   * Shows the custom cursor for the current state: interact while the button is held,
   * hover over a clickable object, otherwise default. A state with no image uses the default image;
   * with no images at all, the browser's pointer/default cursor is used.
   */
  private applyCursor(hover: boolean) {
    this.cursorHover = hover
    if (this.touch) {
      // Touch screens have no hover, so the custom cursor never shows
      this.canvas.style.cursor = 'default'
      return
    }
    const name: CursorStateName = this.pointerDown ? 'interact' : hover ? 'hover' : 'default'
    const states = this.project.cursorConfig?.states
    const chain: CursorStateName[] = name === 'default' ? ['default'] : [name, 'default']
    const picked = chain.map((n) => states?.[n]).find((c) => c?.imageUrl)
    const fallback = hover ? 'pointer' : 'default'
    if (picked?.imageUrl) {
      const hx = Math.round(picked.hotspotX || 0)
      const hy = Math.round(picked.hotspotY || 0)
      this.canvas.style.cursor = `url("${picked.imageUrl}") ${hx} ${hy}, ${fallback}`
    } else {
      this.canvas.style.cursor = fallback
    }
  }

  private handleMouseDown() {
    this.pointerDown = true
    this.applyCursor(this.cursorHover)
  }

  private handleMouseUp() {
    this.pointerDown = false
    this.applyCursor(this.cursorHover)
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.state.showTitleScreen) {
      const rect = this.canvas.getBoundingClientRect()
      const cx = (e.clientX - rect.left) * (this.lw / rect.width)
      const cy = (e.clientY - rect.top) * (this.lh / rect.height)
      const onBtn = this.titleScreenButtonRects.some(
        (br) => cx >= br.x && cx <= br.x + br.w && cy >= br.y && cy <= br.y + br.h
      )
      this.applyCursor(onBtn)
      return
    }

    if (this.state.dialogText) return
    const pos = this.getScenePos(e)
    const scene = this.project.scenes.find((s) => s.id === this.state.currentSceneId)
    if (!scene) return
    const obj = this.getObjectAt(scene, pos.x, pos.y)
    this.applyCursor(!!obj)
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.state.saveMenu) {
      if (e.key === 'Escape') this.closeSaveMenu()
      return
    }
    if (this.state.story) {
      this.handleStoryKey(e)
      return
    }
    if (this.state.showTitleScreen || this.state.miniGame) return
    if (e.key === 'j' || e.key === 'J') {
      this.state.questLogOpen = !this.state.questLogOpen
    }
    this.activeKeys.add(e.key)
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.activeKeys.delete(e.key)
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
        const spawnedId = `spawned-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        targetScene.objects.push({
          ...template,
          id: spawnedId,
          x: action.spawnX ?? template.x,
          y: action.spawnY ?? template.y,
          visible: true,
        })
        this.spawnTemplateIds.set(spawnedId, template.id)
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
      case 'play_story': {
        this.playStory(action.value)
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
      case 'add_quest': {
        const quest = (this.project.quests ?? []).find((q) => q.id === action.value)
        if (!quest) break
        if (this.state.activeQuestIds.includes(quest.id) || this.state.completedQuestIds.includes(quest.id)) break
        this.state.activeQuestIds = [...this.state.activeQuestIds, quest.id]
        this.state.dialogText = `New Quest: ${quest.name}\n${quest.description}`
        break
      }
      case 'complete_quest': {
        if (!this.state.activeQuestIds.includes(action.value)) break
        this.state.activeQuestIds = this.state.activeQuestIds.filter((id) => id !== action.value)
        this.state.completedQuestIds = [...this.state.completedQuestIds, action.value]
        const doneQuest = (this.project.quests ?? []).find((q) => q.id === action.value)
        if (doneQuest) this.state.dialogText = `Quest Complete: ${doneQuest.name}`
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

  private async launchMiniGame(action: EventAction, isRepeat = false) {
    const mg = (this.project.miniGames ?? []).find((m) => m.id === action.value)
    if (!mg?.source) return

    if (!isRepeat) this.repeatCounts.delete(action.id)

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
      activeQuestIds:      [...this.state.activeQuestIds],
      completedQuestIds:   [...this.state.completedQuestIds],
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
      if (this.touch) {
        // Phones: fit the game above an on-screen key bar, so keyboard-only games can be played by touch
        canvas.style.maxWidth = '100%'
        canvas.style.maxHeight = 'calc(100% - 72px)'
        canvas.style.width = 'auto'
        canvas.style.height = 'auto'
        buildTouchKeyBar(mg.touchKeys, overlay)
      }
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
        this.state.activeQuestIds      = [...snapshot.activeQuestIds]
        this.state.completedQuestIds   = [...snapshot.completedQuestIds]
        this.state.dialogText          = null
        this.state.dialogCallback      = null

        // Merge any variables returned by the mini-game on top of the restored state
        if (vars) Object.assign(this.state.variables, vars)
        this.state.variables['minigame_result'] = result

        // Execute result-specific post-game actions
        const resultActions =
          result === 'win'  ? (action.onWinActions  ?? []) :
          result === 'lose' ? (action.onLoseActions ?? []) :
                              (action.onExitActions ?? [])
        resultActions.forEach((a) => this.executeAction(a))

        // Repeat logic — skip if result actions already contain an async launch_minigame
        const hasAsyncAction = resultActions.some((a) => a.type === 'launch_minigame')
        const repeatMatches =
          action.repeatOnResult === 'any' ||
          action.repeatOnResult === result

        if (repeatMatches && !hasAsyncAction) {
          const count = this.repeatCounts.get(action.id) ?? 0
          const maxRepeats = action.repeatMax ?? 0  // 0 = infinite
          if (maxRepeats === 0 || count < maxRepeats) {
            this.repeatCounts.set(action.id, count + 1)
            this.launchMiniGame(action, true)
            return
          }
          this.repeatCounts.delete(action.id)
        }

        this.state.running = true
        this.lastFrameTime = 0
        this.renderLoop()
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
