import { create } from 'zustand'
import type {
  GameProject,
  EditorType,
  Scene,
  SceneObject,
  EventTrigger,
  Asset,
  UIElement,
  SpriteSheet,
  Animation,
  GameSettings,
  TitleScreenConfig,
  TitleScreenButton,
  Stage,
  Goal,
  GoalCondition,
  CursorConfig,
  CursorStateName,
  CursorStateConfig,
  MainCharacter,
  NpcCharacter,
  Cinematic,
  CinematicStep,
  CharacterAnimation,
  FacingDirection,
  CharacterPlacement,
  BlockedZone,
  ScaleZone,
  TeleportZone,
  MiniGame,
  Quest,
  QuestObjective,
} from '../types'

const defaultScene: Scene = {
  id: 'scene-1',
  name: 'Scene 1',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  objects: [],
}

const defaultStage: Stage = {
  id: 'stage-1',
  name: 'Stage 1',
  order: 0,
  startingSceneId: 'scene-1',
  sceneIds: ['scene-1'],
  description: '',
}

const defaultSettings: GameSettings = {
  title: 'My Adventure Game',
  author: '',
  version: '1.0.0',
  description: '',
  resolutionWidth: 1280,
  resolutionHeight: 768,
  startingSceneId: 'scene-1',
  saveSlotCount: 3,
  playerSettings: [],
}

const defaultTitleScreen: TitleScreenConfig = {
  backgroundColor: '#0f0f1a',
  titleText: 'My Adventure Game',
  titleFontSize: 48,
  titleColor: '#e2e8f0',
  subtitleText: 'A Point-and-Click Adventure',
  subtitleFontSize: 20,
  subtitleColor: '#94a3b8',
  buttons: [
    { id: 'btn-newgame', label: 'New Game', action: 'new_game', order: 0 },
    { id: 'btn-loadgame', label: 'Load Game', action: 'load_game', order: 1 },
    { id: 'btn-settings', label: 'Settings', action: 'settings', order: 2 },
    { id: 'btn-quit', label: 'Quit', action: 'quit', order: 3 },
  ],
}

const defaultCursorConfig: CursorConfig = {
  states: {
    default: { hotspotX: 0, hotspotY: 0 },
    hover: { hotspotX: 0, hotspotY: 0 },
    interact: { hotspotX: 0, hotspotY: 0 },
  },
  activeState: 'default',
}

const defaultMainCharacter: MainCharacter = {
  id: 'main-character',
  name: 'Player',
  description: '',
  width: 64,
  height: 96,
  defaultFacing: 'down',
  animations: { up: null, down: null, left: null, right: null },
}

const defaultProject: GameProject = {
  id: 'project-1',
  name: 'My Adventure Game',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  scenes: [defaultScene],
  activeSceneId: 'scene-1',
  events: [],
  assets: [],
  uiElements: [],
  spriteSheets: [],
  mainCharacter: defaultMainCharacter,
  npcs: [],
  cinematics: [],
  settings: defaultSettings,
  titleScreen: defaultTitleScreen,
  stages: [defaultStage],
  goals: [],
  cursorConfig: defaultCursorConfig,
}

interface GameStore {
  project: GameProject
  activeEditor: EditorType
  fileOpen: boolean
  setActiveEditor: (editor: EditorType) => void
  setFileOpen: (open: boolean) => void
  loadProject: (project: GameProject) => void

  // Scene actions
  addScene: (scene: Scene) => void
  updateScene: (id: string, updates: Partial<Scene>) => void
  deleteScene: (id: string) => void
  setActiveScene: (id: string) => void
  addSceneObject: (sceneId: string, obj: SceneObject) => void
  updateSceneObject: (sceneId: string, objId: string, updates: Partial<SceneObject>) => void
  deleteSceneObject: (sceneId: string, objId: string) => void

  // Event actions
  addEvent: (event: EventTrigger) => void
  updateEvent: (id: string, updates: Partial<EventTrigger>) => void
  deleteEvent: (id: string) => void

  // Asset actions
  addAsset: (asset: Asset) => void
  deleteAsset: (id: string) => void

  // UI element actions
  addUIElement: (element: UIElement) => void
  updateUIElement: (id: string, updates: Partial<UIElement>) => void
  deleteUIElement: (id: string) => void

  // Sprite sheet actions
  addSpriteSheet: (sheet: SpriteSheet) => void
  updateSpriteSheet: (id: string, updates: Partial<SpriteSheet>) => void
  deleteSpriteSheet: (id: string) => void
  addAnimation: (sheetId: string, anim: Animation) => void
  updateAnimation: (sheetId: string, animId: string, updates: Partial<Animation>) => void
  deleteAnimation: (sheetId: string, animId: string) => void

  // Settings actions
  updateSettings: (updates: Partial<GameSettings>) => void

  // Title screen actions
  updateTitleScreen: (updates: Partial<TitleScreenConfig>) => void
  addTitleScreenButton: (button: TitleScreenButton) => void
  updateTitleScreenButton: (id: string, updates: Partial<TitleScreenButton>) => void
  deleteTitleScreenButton: (id: string) => void
  reorderTitleScreenButtons: (buttons: TitleScreenButton[]) => void

  // Stage actions
  addStage: (stage: Stage) => void
  updateStage: (id: string, updates: Partial<Stage>) => void
  deleteStage: (id: string) => void
  reorderStages: (stages: Stage[]) => void

  // Goal actions
  addGoal: (goal: Goal) => void
  updateGoal: (id: string, updates: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  addGoalCondition: (goalId: string, condition: GoalCondition) => void
  updateGoalCondition: (goalId: string, conditionId: string, updates: Partial<GoalCondition>) => void
  deleteGoalCondition: (goalId: string, conditionId: string) => void

  // Cursor actions
  updateCursorState: (stateName: CursorStateName, updates: Partial<CursorStateConfig>) => void
  updateCursorConfig: (updates: Partial<CursorConfig>) => void

  // Main character actions
  updateMainCharacter: (updates: Partial<MainCharacter>) => void
  setCharacterAnimation: (direction: FacingDirection, anim: CharacterAnimation | null) => void
  updateSceneCharacterPlacement: (sceneId: string, placement: Partial<CharacterPlacement>) => void

  // NPC actions
  addNpc: (npc: NpcCharacter) => void
  updateNpc: (id: string, updates: Partial<NpcCharacter>) => void
  deleteNpc: (id: string) => void
  setNpcAnimation: (npcId: string, direction: FacingDirection, anim: CharacterAnimation | null) => void

  // Cinematic actions
  addCinematic: (cinematic: Cinematic) => void
  updateCinematic: (id: string, updates: Partial<Cinematic>) => void
  deleteCinematic: (id: string) => void
  addCinematicStep: (cinematicId: string, step: CinematicStep) => void
  updateCinematicStep: (cinematicId: string, stepId: string, updates: Partial<CinematicStep>) => void
  deleteCinematicStep: (cinematicId: string, stepId: string) => void
  moveCinematicStep: (cinematicId: string, stepId: string, direction: 'up' | 'down') => void

  // Blocked zone (pathfinding) actions
  addBlockedZone: (sceneId: string, zone: BlockedZone) => void
  updateBlockedZone: (sceneId: string, zoneId: string, updates: Partial<BlockedZone>) => void
  deleteBlockedZone: (sceneId: string, zoneId: string) => void

  // Scale zone (perspective) actions
  addScaleZone: (sceneId: string, zone: ScaleZone) => void
  updateScaleZone: (sceneId: string, zoneId: string, updates: Partial<ScaleZone>) => void
  deleteScaleZone: (sceneId: string, zoneId: string) => void

  // Teleport zone actions
  addTeleportZone: (sceneId: string, zone: TeleportZone) => void
  updateTeleportZone: (sceneId: string, zoneId: string, updates: Partial<TeleportZone>) => void
  deleteTeleportZone: (sceneId: string, zoneId: string) => void

  // Mini-game actions
  addMiniGame: (mg: MiniGame) => void
  updateMiniGame: (id: string, updates: Partial<MiniGame>) => void
  deleteMiniGame: (id: string) => void

  // Quest actions
  addQuest: (quest: Quest) => void
  updateQuest: (id: string, updates: Partial<Quest>) => void
  deleteQuest: (id: string) => void
  addQuestObjective: (questId: string, objective: QuestObjective) => void
  updateQuestObjective: (questId: string, objId: string, updates: Partial<QuestObjective>) => void
  deleteQuestObjective: (questId: string, objId: string) => void
}

export const useGameStore = create<GameStore>((set) => ({
  project: defaultProject,
  activeEditor: 'scene',
  fileOpen: false,

  setActiveEditor: (editor) => set({ activeEditor: editor }),
  setFileOpen: (open) => set({ fileOpen: open }),

  loadProject: (project) =>
    set({
      project: {
        ...project,
        scenes: project.scenes.map((s) => ({
          ...s,
          blockedZones: s.blockedZones ?? [],
          scaleZones: s.scaleZones ?? [],
          teleportZones: s.teleportZones ?? [],
        })),
        mainCharacter: project.mainCharacter ?? defaultMainCharacter,
        npcs: project.npcs ?? [],
        cinematics: project.cinematics ?? [],
        miniGames: project.miniGames ?? [],
        updatedAt: new Date().toISOString(),
      },
    }),

  // Scene actions
  addScene: (scene) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: [...state.project.scenes, scene],
        updatedAt: new Date().toISOString(),
      },
    })),

  updateScene: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteScene: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.filter((s) => s.id !== id),
        activeSceneId:
          state.project.activeSceneId === id
            ? state.project.scenes.find((s) => s.id !== id)?.id ?? ''
            : state.project.activeSceneId,
        updatedAt: new Date().toISOString(),
      },
    })),

  setActiveScene: (id) =>
    set((state) => ({
      project: { ...state.project, activeSceneId: id },
    })),

  addSceneObject: (sceneId, obj) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId ? { ...s, objects: [...s.objects, obj] } : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  updateSceneObject: (sceneId, objId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, objects: s.objects.map((o) => (o.id === objId ? { ...o, ...updates } : o)) }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteSceneObject: (sceneId, objId) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId ? { ...s, objects: s.objects.filter((o) => o.id !== objId) } : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  // Event actions
  addEvent: (event) =>
    set((state) => ({
      project: {
        ...state.project,
        events: [...state.project.events, event],
        updatedAt: new Date().toISOString(),
      },
    })),

  updateEvent: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        events: state.project.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteEvent: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        events: state.project.events.filter((e) => e.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  // Asset actions
  addAsset: (asset) =>
    set((state) => ({
      project: {
        ...state.project,
        assets: [...state.project.assets, asset],
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteAsset: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        assets: state.project.assets.filter((a) => a.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  // UI element actions
  addUIElement: (element) =>
    set((state) => ({
      project: {
        ...state.project,
        uiElements: [...state.project.uiElements, element],
        updatedAt: new Date().toISOString(),
      },
    })),

  updateUIElement: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        uiElements: state.project.uiElements.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteUIElement: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        uiElements: state.project.uiElements.filter((e) => e.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  // Sprite sheet actions
  addSpriteSheet: (sheet) =>
    set((state) => ({
      project: {
        ...state.project,
        spriteSheets: [...state.project.spriteSheets, sheet],
        updatedAt: new Date().toISOString(),
      },
    })),

  updateSpriteSheet: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        spriteSheets: state.project.spriteSheets.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteSpriteSheet: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        spriteSheets: state.project.spriteSheets.filter((s) => s.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  addAnimation: (sheetId, anim) =>
    set((state) => ({
      project: {
        ...state.project,
        spriteSheets: state.project.spriteSheets.map((s) =>
          s.id === sheetId ? { ...s, animations: [...s.animations, anim] } : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  updateAnimation: (sheetId, animId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        spriteSheets: state.project.spriteSheets.map((s) =>
          s.id === sheetId
            ? {
                ...s,
                animations: s.animations.map((a) =>
                  a.id === animId ? { ...a, ...updates } : a
                ),
              }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteAnimation: (sheetId, animId) =>
    set((state) => ({
      project: {
        ...state.project,
        spriteSheets: state.project.spriteSheets.map((s) =>
          s.id === sheetId
            ? { ...s, animations: s.animations.filter((a) => a.id !== animId) }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  // Settings actions
  updateSettings: (updates) =>
    set((state) => ({
      project: {
        ...state.project,
        settings: { ...state.project.settings, ...updates },
        updatedAt: new Date().toISOString(),
      },
    })),

  // Title screen actions
  updateTitleScreen: (updates) =>
    set((state) => ({
      project: {
        ...state.project,
        titleScreen: { ...state.project.titleScreen, ...updates },
        updatedAt: new Date().toISOString(),
      },
    })),

  addTitleScreenButton: (button) =>
    set((state) => ({
      project: {
        ...state.project,
        titleScreen: {
          ...state.project.titleScreen,
          buttons: [...state.project.titleScreen.buttons, button],
        },
        updatedAt: new Date().toISOString(),
      },
    })),

  updateTitleScreenButton: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        titleScreen: {
          ...state.project.titleScreen,
          buttons: state.project.titleScreen.buttons.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        },
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteTitleScreenButton: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        titleScreen: {
          ...state.project.titleScreen,
          buttons: state.project.titleScreen.buttons.filter((b) => b.id !== id),
        },
        updatedAt: new Date().toISOString(),
      },
    })),

  reorderTitleScreenButtons: (buttons) =>
    set((state) => ({
      project: {
        ...state.project,
        titleScreen: { ...state.project.titleScreen, buttons },
        updatedAt: new Date().toISOString(),
      },
    })),

  // Stage actions
  addStage: (stage) =>
    set((state) => ({
      project: {
        ...state.project,
        stages: [...state.project.stages, stage],
        updatedAt: new Date().toISOString(),
      },
    })),

  updateStage: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        stages: state.project.stages.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteStage: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        stages: state.project.stages.filter((s) => s.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  reorderStages: (stages) =>
    set((state) => ({
      project: {
        ...state.project,
        stages,
        updatedAt: new Date().toISOString(),
      },
    })),

  // Goal actions
  addGoal: (goal) =>
    set((state) => ({
      project: {
        ...state.project,
        goals: [...state.project.goals, goal],
        updatedAt: new Date().toISOString(),
      },
    })),

  updateGoal: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        goals: state.project.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteGoal: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        goals: state.project.goals.filter((g) => g.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  addGoalCondition: (goalId, condition) =>
    set((state) => ({
      project: {
        ...state.project,
        goals: state.project.goals.map((g) =>
          g.id === goalId ? { ...g, conditions: [...g.conditions, condition] } : g
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  updateGoalCondition: (goalId, conditionId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        goals: state.project.goals.map((g) =>
          g.id === goalId
            ? {
                ...g,
                conditions: g.conditions.map((c) =>
                  c.id === conditionId ? { ...c, ...updates } : c
                ),
              }
            : g
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteGoalCondition: (goalId, conditionId) =>
    set((state) => ({
      project: {
        ...state.project,
        goals: state.project.goals.map((g) =>
          g.id === goalId
            ? { ...g, conditions: g.conditions.filter((c) => c.id !== conditionId) }
            : g
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  // Cursor actions
  updateCursorState: (stateName, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        cursorConfig: {
          ...state.project.cursorConfig,
          states: {
            ...state.project.cursorConfig.states,
            [stateName]: { ...state.project.cursorConfig.states[stateName], ...updates },
          },
        },
        updatedAt: new Date().toISOString(),
      },
    })),

  updateCursorConfig: (updates) =>
    set((state) => ({
      project: {
        ...state.project,
        cursorConfig: { ...state.project.cursorConfig, ...updates },
        updatedAt: new Date().toISOString(),
      },
    })),

  // Main character actions
  updateMainCharacter: (updates) =>
    set((state) => ({
      project: {
        ...state.project,
        mainCharacter: { ...state.project.mainCharacter, ...updates },
        updatedAt: new Date().toISOString(),
      },
    })),

  setCharacterAnimation: (direction, anim) =>
    set((state) => ({
      project: {
        ...state.project,
        mainCharacter: {
          ...state.project.mainCharacter,
          animations: { ...state.project.mainCharacter.animations, [direction]: anim },
        },
        updatedAt: new Date().toISOString(),
      },
    })),

  updateSceneCharacterPlacement: (sceneId, placement) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                characterPlacement: {
                  visible: s.characterPlacement?.visible ?? false,
                  x: s.characterPlacement?.x ?? 100,
                  y: s.characterPlacement?.y ?? 300,
                  facing: s.characterPlacement?.facing ?? 'down',
                  ...placement,
                },
              }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  // Blocked zone actions
  addBlockedZone: (sceneId, zone) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, blockedZones: [...(s.blockedZones ?? []), zone] }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  updateBlockedZone: (sceneId, zoneId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                blockedZones: (s.blockedZones ?? []).map((z) =>
                  z.id === zoneId ? { ...z, ...updates } : z
                ),
              }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteBlockedZone: (sceneId, zoneId) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, blockedZones: (s.blockedZones ?? []).filter((z) => z.id !== zoneId) }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  addScaleZone: (sceneId, zone) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, scaleZones: [...(s.scaleZones ?? []), zone] }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  updateScaleZone: (sceneId, zoneId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                scaleZones: (s.scaleZones ?? []).map((z) =>
                  z.id === zoneId ? { ...z, ...updates } : z
                ),
              }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteScaleZone: (sceneId, zoneId) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, scaleZones: (s.scaleZones ?? []).filter((z) => z.id !== zoneId) }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  // Teleport zone actions
  addTeleportZone: (sceneId, zone) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, teleportZones: [...(s.teleportZones ?? []), zone] }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  updateTeleportZone: (sceneId, zoneId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                teleportZones: (s.teleportZones ?? []).map((z) =>
                  z.id === zoneId ? { ...z, ...updates } : z
                ),
              }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteTeleportZone: (sceneId, zoneId) =>
    set((state) => ({
      project: {
        ...state.project,
        scenes: state.project.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, teleportZones: (s.teleportZones ?? []).filter((z) => z.id !== zoneId) }
            : s
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  // NPC actions
  addNpc: (npc) =>
    set((state) => ({
      project: {
        ...state.project,
        npcs: [...(state.project.npcs ?? []), npc],
        updatedAt: new Date().toISOString(),
      },
    })),

  updateNpc: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        npcs: (state.project.npcs ?? []).map((n) => (n.id === id ? { ...n, ...updates } : n)),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteNpc: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        npcs: (state.project.npcs ?? []).filter((n) => n.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  setNpcAnimation: (npcId, direction, anim) =>
    set((state) => ({
      project: {
        ...state.project,
        npcs: (state.project.npcs ?? []).map((n) =>
          n.id === npcId
            ? { ...n, animations: { ...n.animations, [direction]: anim } }
            : n
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  // Cinematic actions
  addCinematic: (cinematic) =>
    set((state) => ({
      project: {
        ...state.project,
        cinematics: [...(state.project.cinematics ?? []), cinematic],
        updatedAt: new Date().toISOString(),
      },
    })),

  updateCinematic: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        cinematics: (state.project.cinematics ?? []).map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteCinematic: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        cinematics: (state.project.cinematics ?? []).filter((c) => c.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  addCinematicStep: (cinematicId, step) =>
    set((state) => ({
      project: {
        ...state.project,
        cinematics: (state.project.cinematics ?? []).map((c) =>
          c.id === cinematicId ? { ...c, steps: [...c.steps, step] } : c
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  updateCinematicStep: (cinematicId, stepId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        cinematics: (state.project.cinematics ?? []).map((c) =>
          c.id === cinematicId
            ? { ...c, steps: c.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)) }
            : c
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteCinematicStep: (cinematicId, stepId) =>
    set((state) => ({
      project: {
        ...state.project,
        cinematics: (state.project.cinematics ?? []).map((c) =>
          c.id === cinematicId
            ? { ...c, steps: c.steps.filter((s) => s.id !== stepId) }
            : c
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  moveCinematicStep: (cinematicId, stepId, direction) =>
    set((state) => ({
      project: {
        ...state.project,
        cinematics: (state.project.cinematics ?? []).map((c) => {
          if (c.id !== cinematicId) return c
          const steps = [...c.steps]
          const idx = steps.findIndex((s) => s.id === stepId)
          if (idx < 0) return c
          const target = direction === 'up' ? idx - 1 : idx + 1
          if (target < 0 || target >= steps.length) return c
          ;[steps[idx], steps[target]] = [steps[target], steps[idx]]
          return { ...c, steps }
        }),
        updatedAt: new Date().toISOString(),
      },
    })),

  // Mini-game actions
  addMiniGame: (mg) =>
    set((state) => ({
      project: {
        ...state.project,
        miniGames: [...(state.project.miniGames ?? []), mg],
        updatedAt: new Date().toISOString(),
      },
    })),

  updateMiniGame: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        miniGames: (state.project.miniGames ?? []).map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteMiniGame: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        miniGames: (state.project.miniGames ?? []).filter((m) => m.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  // Quest actions
  addQuest: (quest) =>
    set((state) => ({
      project: {
        ...state.project,
        quests: [...(state.project.quests ?? []), quest],
        updatedAt: new Date().toISOString(),
      },
    })),

  updateQuest: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        quests: (state.project.quests ?? []).map((q) => (q.id === id ? { ...q, ...updates } : q)),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteQuest: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        quests: (state.project.quests ?? []).filter((q) => q.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  addQuestObjective: (questId, objective) =>
    set((state) => ({
      project: {
        ...state.project,
        quests: (state.project.quests ?? []).map((q) =>
          q.id === questId ? { ...q, objectives: [...(q.objectives ?? []), objective] } : q
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  updateQuestObjective: (questId, objId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        quests: (state.project.quests ?? []).map((q) =>
          q.id === questId
            ? {
                ...q,
                objectives: (q.objectives ?? []).map((o) =>
                  o.id === objId ? { ...o, ...updates } : o
                ),
              }
            : q
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  deleteQuestObjective: (questId, objId) =>
    set((state) => ({
      project: {
        ...state.project,
        quests: (state.project.quests ?? []).map((q) =>
          q.id === questId
            ? { ...q, objectives: (q.objectives ?? []).filter((o) => o.id !== objId) }
            : q
        ),
        updatedAt: new Date().toISOString(),
      },
    })),
}))
