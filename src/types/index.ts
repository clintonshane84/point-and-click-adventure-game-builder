// Editor types
export type EditorType =
  | 'scene'
  | 'event'
  | 'assets'
  | 'ui'
  | 'sprite'
  | 'character'
  | 'settings'
  | 'titlescreen'
  | 'stage'
  | 'goal'
  | 'cursor'
  | 'preview'
  | 'export'

// Scene types
export type SceneObjectType = 'sprite' | 'background' | 'hotspot' | 'character' | 'item'

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
}

// Event types
export type TriggerType = 'click' | 'hover' | 'enter' | 'exit' | 'keypress'

export type ActionType =
  | 'navigate_scene'
  | 'play_sound'
  | 'show_dialog'
  | 'set_variable'
  | 'show_object'
  | 'hide_object'
  | 'play_animation'
  | 'stop_animation'

export interface EventAction {
  id: string
  type: ActionType
  value: string
  delay?: number
}

export interface EventTrigger {
  id: string
  sceneId: string
  objectId: string
  trigger: TriggerType
  actions: EventAction[]
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
export interface Stage {
  id: string
  name: string
  order: number
  startingSceneId: string
  sceneIds: string[]
  description: string
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
  settings: GameSettings
  titleScreen: TitleScreenConfig
  stages: Stage[]
  goals: Goal[]
  cursorConfig: CursorConfig
}
