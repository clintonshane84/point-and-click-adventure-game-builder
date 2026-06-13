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
  settings: defaultSettings,
  titleScreen: defaultTitleScreen,
  stages: [defaultStage],
  goals: [],
  cursorConfig: defaultCursorConfig,
}

interface GameStore {
  project: GameProject
  activeEditor: EditorType
  setActiveEditor: (editor: EditorType) => void

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
}

export const useGameStore = create<GameStore>((set) => ({
  project: defaultProject,
  activeEditor: 'scene',

  setActiveEditor: (editor) => set({ activeEditor: editor }),

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
}))
