// Editor types
export type EditorType =
  | 'scene'
  | 'event'
  | 'assets'
  | 'ui'
  | 'sprite'
  | 'character'
  | 'cinematic'
  | 'minigame'
  | 'settings'
  | 'titlescreen'
  | 'stage'
  | 'goal'
  | 'cursor'
  | 'preview'
  | 'export'

// Scene types
export type SceneObjectType = 'sprite' | 'background' | 'hotspot' | 'character' | 'item' | 'terrain'

export type NpcMovementInstruction =
  | 'none'
  | 'roam-slow-and-eat-grass'
  | 'roam-human-in-field'
  | 'follow-hero'
  | 'follow-and-attack-hero'

export interface SceneObject {
  id: string
  name: string
  type: SceneObjectType
  x: number
  y: number
  width: number
  height: number
  opacity: number
  imageUrl?: string
  spriteSheetId?: string
  frameIndex?: number
  npcId?: string
  movementInstruction?: NpcMovementInstruction
  zIndex: number
  visible: boolean
  properties: Record<string, string | number | boolean>
}

export type FacingDirection = 'up' | 'down' | 'left' | 'right'

// ── Pathfinding ───────────────────────────────────────────────────────────────

export interface BlockedZone {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
}

export interface ScaleZone {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  scale: number          // character size multiplier inside zone (0.1–1.0)
  speedMultiplier: number // walk speed multiplier inside zone (0.1–1.0)
}

export interface TeleportZone {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  linkedSceneId?: string
  linkedZoneId?: string
  entryFacing?: FacingDirection
}

export type SceneExitSide = 'left' | 'right' | 'top' | 'bottom'

export interface SceneExit {
  side: SceneExitSide
  targetSceneId: string         // destination scene ID
  entryFacing?: FacingDirection // optional facing override; if omitted, inferred from direction
}

export interface CharacterAnimation {
  spriteSheetId: string
  animationId: string
}

export interface MainCharacter {
  id: string
  name: string
  description: string
  width: number
  height: number
  defaultFacing: FacingDirection
  animations: {
    up: CharacterAnimation | null
    down: CharacterAnimation | null
    left: CharacterAnimation | null
    right: CharacterAnimation | null
  }
}

export interface NpcCharacter {
  id: string
  name: string
  description: string
  width: number
  height: number
  defaultFacing: FacingDirection
  animations: {
    up: CharacterAnimation | null
    down: CharacterAnimation | null
    left: CharacterAnimation | null
    right: CharacterAnimation | null
  }
}

export interface CharacterPlacement {
  visible: boolean
  x: number
  y: number
  facing: FacingDirection
}

export interface Scene {
  id: string
  name: string
  width: number
  height: number
  backgroundColor: string
  backgroundImageUrl?: string
  objects: SceneObject[]
  characterPlacement?: CharacterPlacement
  blockedZones?: BlockedZone[]
  scaleZones?: ScaleZone[]
  teleportZones?: TeleportZone[]
  exits?: SceneExit[]
}

// Event types
export type TriggerType = 'click' | 'hover' | 'enter' | 'exit' | 'keypress' | 'stage_start' | 'game_start'

export type ActionType =
  | 'navigate_scene'
  | 'play_sound'
  | 'show_dialog'
  | 'set_variable'
  | 'show_object'
  | 'hide_object'
  | 'remove_object'
  | 'spawn_object'
  | 'play_animation'
  | 'stop_animation'
  | 'play_cinematic'
  | 'launch_minigame'

export interface EventAction {
  id: string
  type: ActionType
  value: string
  delay?: number
  entryX?: number          // hero X in destination scene (navigate_scene only)
  entryY?: number          // hero Y in destination scene (navigate_scene only)
  entryFacing?: FacingDirection  // hero facing in destination scene (navigate_scene only)
  spawnSceneId?: string    // spawn_object: target scene ID (defaults to current scene)
  spawnX?: number          // spawn_object: X position
  spawnY?: number          // spawn_object: Y position
}

export interface EventCondition {
  id: string
  variable: string
  operator: ConditionOperator
  value: string
}

export interface EventBranch {
  id: string
  conditions: EventCondition[]
  logic: 'AND' | 'OR'
  actions: EventAction[]
}

export interface EventTrigger {
  id: string
  sceneId: string
  objectId: string
  stageId?: string     // set for stage_start events; empty for scene-object and game_start events
  trigger: TriggerType
  actions: EventAction[]
  branches?: EventBranch[]
  enabled: boolean
}

// Asset types
export type AssetType = 'image' | 'audio' | 'video'

export interface Asset {
  id: string
  name: string
  type: AssetType
  url: string
  size?: number
  width?: number
  height?: number
  duration?: number
  createdAt: string
}

// UI Editor types
export type UIElementType = 'text' | 'button' | 'image' | 'progressbar' | 'inventoryslot'

export interface UIElement {
  id: string
  name: string
  type: UIElementType
  x: number
  y: number
  width: number
  height: number
  content: string
  style: {
    color: string
    backgroundColor: string
    fontSize: number
    borderRadius: number
    borderColor: string
    borderWidth: number
    opacity: number
  }
  visible: boolean
  zIndex: number
}

// Sprite / Animation types
export interface SpriteFrame {
  id: string
  row: number
  col: number
  x: number
  y: number
  width: number
  height: number
}

export interface Animation {
  id: string
  name: string
  startFrame: number
  endFrame: number
  fps: number
  loop: boolean
}

export interface SpriteSheet {
  id: string
  name: string
  imageUrl: string
  imageWidth: number
  imageHeight: number
  rows: number
  cols: number
  frameWidth: number
  frameHeight: number
  frames: SpriteFrame[]
  animations: Animation[]
}

// Settings types
export type PlayerSettingType = 'number' | 'boolean' | 'string'

export interface PlayerSetting {
  id: string
  name: string
  type: PlayerSettingType
  defaultValue: string
  min?: number
  max?: number
}

export interface GameSettings {
  title: string
  author: string
  version: string
  description: string
  resolutionWidth: number
  resolutionHeight: number
  startingSceneId: string
  saveSlotCount: number
  playerSettings: PlayerSetting[]
}

// Title screen types
export interface TitleScreenButton {
  id: string
  label: string
  action: string
  order: number
}

export interface TitleScreenConfig {
  backgroundColor: string
  backgroundImageUrl?: string
  titleText: string
  titleFontSize: number
  titleColor: string
  subtitleText: string
  subtitleFontSize: number
  subtitleColor: string
  buttons: TitleScreenButton[]
}

// Stage types
export interface StageVariable {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean'
  defaultValue: string
}

export interface Stage {
  id: string
  name: string
  order: number
  startingSceneId: string
  sceneIds: string[]
  description: string
  variables?: StageVariable[]
}

// Goal types
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
export type GoalConditionType = 'variable_equals' | 'scene_visited' | 'item_collected' | 'event_triggered'
export type GoalLogic = 'AND' | 'OR'
export type GoalCompletionAction = 'advance_stage' | 'end_game' | 'show_dialog'

export interface GoalCondition {
  id: string
  type: GoalConditionType
  target: string
  operator: ConditionOperator
  value: string
}

export interface Goal {
  id: string
  stageId: string
  name: string
  description: string
  conditions: GoalCondition[]
  logic: GoalLogic
  completionAction: GoalCompletionAction
  completionValue: string
  completed: boolean
}

// Cursor types
export interface CursorStateConfig {
  imageUrl?: string
  hotspotX: number
  hotspotY: number
}

export type CursorStateName = 'default' | 'hover' | 'interact'

export interface CursorConfig {
  states: Record<CursorStateName, CursorStateConfig>
  activeState: CursorStateName
}

// Mini-game types
export interface SpriteSlotBinding {
  sheetId: string   // references project.spriteSheets[].id
  animId:  string   // references Animation.id within that sheet; empty = URL-only (no frame animation)
}

export interface MiniGame {
  id: string
  name: string
  description: string
  source: string        // full JS module source (ES module with default export)
  spriteMap?: Record<string, SpriteSlotBinding>  // slotName → { sheetId, animId }
}

// Cinematic types
export type CinematicStepType =
  | 'walk_to'
  | 'talk'
  | 'action'
  | 'wait'
  | 'show_dialog'
  | 'set_variable'
  | 'play_sound'

export interface CinematicStep {
  id: string
  type: CinematicStepType
  characterId?: string   // 'main-character' or NPC id
  targetX?: number       // walk_to
  targetY?: number       // walk_to
  text?: string          // talk / show_dialog
  actionLabel?: string   // action (e.g. "attacks", "gives gift")
  duration?: number      // wait (seconds)
  assetId?: string       // play_sound
  variable?: string      // set_variable (name=value)
}

export type CinematicCompletionAction =
  | 'return_to_game'
  | 'navigate_scene'
  | 'show_dialog'
  | 'set_variable'

export interface Cinematic {
  id: string
  name: string
  description: string
  sceneId: string
  steps: CinematicStep[]
  completionAction: CinematicCompletionAction
  completionValue: string
}

// Top-level project
export interface GameProject {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  scenes: Scene[]
  activeSceneId: string
  events: EventTrigger[]
  assets: Asset[]
  uiElements: UIElement[]
  spriteSheets: SpriteSheet[]
  mainCharacter: MainCharacter
  npcs: NpcCharacter[]
  cinematics: Cinematic[]
  settings: GameSettings
  titleScreen: TitleScreenConfig
  stages: Stage[]
  goals: Goal[]
  cursorConfig: CursorConfig
  miniGames?: MiniGame[]
}
