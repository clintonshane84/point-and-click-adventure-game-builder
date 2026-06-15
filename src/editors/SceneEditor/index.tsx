import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Stage, Layer, Rect, Image as KonvaImage, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import {
  Plus, Trash2, MousePointer, ChevronDown,
  ImageIcon, X, ZoomIn, ZoomOut,
  User, Box, Crosshair, Image, LayoutTemplate, ShieldOff, Sparkles, Shrink,
} from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { useAiStore } from '../../store/useAiStore'
import { AiGenerateModal } from '../../components/AiGenerateModal'
import type { SceneObject, SceneObjectType, FacingDirection, BlockedZone, ScaleZone, Asset, NpcCharacter, NpcMovementInstruction } from '../../types'

// ─── Image loader hook ────────────────────────────────────────────────────────

function useHtmlImage(url: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!url) { setImg(null); return }
    let cancelled = false
    const el = new window.Image()
    el.onload = () => { if (!cancelled) setImg(el) }
    el.onerror = () => { if (!cancelled) setImg(null) }
    el.src = url
    return () => { cancelled = true }
  }, [url])
  return img
}

// ─── Object-type visual config ────────────────────────────────────────────────

interface TypeStyle {
  fill: string
  stroke: string
  dash?: number[]
  label: string
  icon: React.ReactNode
}

const TYPE_CONFIG: Record<SceneObjectType, TypeStyle> = {
  background: {
    fill: '#1e293b', stroke: '#475569',
    label: 'Background', icon: <LayoutTemplate size={11} />,
  },
  sprite: {
    fill: '#374151', stroke: '#6b7280',
    label: 'Sprite', icon: <Box size={11} />,
  },
  character: {
    fill: '#312e81', stroke: '#6366f1',
    label: 'Character', icon: <User size={11} />,
  },
  item: {
    fill: '#78350f', stroke: '#f59e0b',
    label: 'Item', icon: <Image size={11} />,
  },
  hotspot: {
    // intentionally near-invisible: translucent fill + dashed border
    fill: 'rgba(99,102,241,0.08)', stroke: '#818cf8',
    dash: [6, 4], label: 'Hotspot', icon: <Crosshair size={11} />,
  },
}

const OBJECT_TYPES: SceneObjectType[] = ['sprite', 'character', 'item', 'hotspot', 'background']

// ─── Component ────────────────────────────────────────────────────────────────

const FACING_ARROWS: Record<FacingDirection, string> = { up: '▲', down: '▼', left: '◀', right: '▶' }

export function SceneEditor() {
  const {
    project, addScene, deleteScene, setActiveScene,
    addSceneObject, updateSceneObject, deleteSceneObject,
    updateSceneCharacterPlacement,
    addBlockedZone, deleteBlockedZone,
    addScaleZone, updateScaleZone, deleteScaleZone,
    addAsset,
  } = useGameStore()
  const { settings: aiSettings } = useAiStore()
  const { scenes, activeSceneId, assets, mainCharacter } = project

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0]

  // Preloaded sprite sheet images for the canvas preview (covers scene objects and NPC sprites)
  const [spriteImages, setSpriteImages] = useState<Map<string, HTMLImageElement>>(new Map())
  useEffect(() => {
    project.spriteSheets.forEach((sheet) => {
      if (!sheet.imageUrl || spriteImages.has(sheet.imageUrl)) return
      const img = new window.Image()
      img.onload = () => setSpriteImages((prev) => new Map(prev).set(sheet.imageUrl, img))
      img.src = sheet.imageUrl
    })
  }, [project.spriteSheets])

  // Selection / tool
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const selectedShapeRef = useRef<Konva.Node | null>(null)

  // Zoom (0.25 – 4)
  const [zoom, setZoom] = useState(1)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // Inline scene rename
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [editingSceneName, setEditingSceneName] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // "Add object" type dropdown
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const typeMenuRef = useRef<HTMLDivElement>(null)

  // Background image picker
  const [showBgPicker, setShowBgPicker] = useState(false)
  const bgPickerRef = useRef<HTMLDivElement>(null)

  // AI generate modal
  const [showAiBgModal, setShowAiBgModal] = useState(false)

  // Path editing mode
  const [pathMode, setPathMode] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [drawingZone, setDrawingZone] = useState<{ startX: number; startY: number; w: number; h: number } | null>(null)
  const isDrawingRef = useRef(false)

  // Scale zone editing mode
  const [scaleMode, setScaleMode] = useState(false)
  const [selectedScaleZoneId, setSelectedScaleZoneId] = useState<string | null>(null)
  const [drawingScaleZone, setDrawingScaleZone] = useState<{ startX: number; startY: number; w: number; h: number } | null>(null)
  const isDrawingScaleRef = useRef(false)

  const selectedObj = activeScene?.objects.find((o) => o.id === selectedObjId) ?? null
  const bgImage = useHtmlImage(activeScene?.backgroundImageUrl)
  const imageAssets = assets.filter((a) => a.type === 'image')

  // Character sprite preview: load the first frame of the default-facing animation
  const charFacing = mainCharacter.defaultFacing
  const charAnimCfg = mainCharacter.animations[charFacing]
  const charSheet = project.spriteSheets.find((s) => s.id === charAnimCfg?.spriteSheetId)
  const charAnimDef = charSheet?.animations.find((a) => a.id === charAnimCfg?.animationId)
  const charStartFrame = charAnimDef?.startFrame ?? 0
  const charFrameCol = charStartFrame % (charSheet?.cols ?? 1)
  const charFrameRow = Math.floor(charStartFrame / (charSheet?.cols ?? 1))
  const charSpriteImage = useHtmlImage(charSheet?.imageUrl)

  // ── Delete key ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!activeScene) return
      if (pathMode && selectedZoneId) {
        deleteBlockedZone(activeScene.id, selectedZoneId)
        setSelectedZoneId(null)
        return
      }
      if (scaleMode && selectedScaleZoneId) {
        deleteScaleZone(activeScene.id, selectedScaleZoneId)
        setSelectedScaleZoneId(null)
        return
      }
      if (!pathMode && !scaleMode && selectedObjId) {
        deleteSceneObject(activeScene.id, selectedObjId)
        setSelectedObjId(null)
        transformerRef.current?.nodes([])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedObjId, selectedZoneId, selectedScaleZoneId, pathMode, scaleMode, activeScene, deleteSceneObject, deleteBlockedZone, deleteScaleZone])

  // ── Scroll-wheel zoom (Ctrl/Cmd + scroll) ──────────────────────────────────
  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom((z) => Math.min(4, Math.max(0.25, parseFloat((z + delta).toFixed(2)))))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ── Close dropdowns on outside click ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showTypeMenu && typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node))
        setShowTypeMenu(false)
      if (showBgPicker && bgPickerRef.current && !bgPickerRef.current.contains(e.target as Node))
        setShowBgPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTypeMenu, showBgPicker])

  // Focus rename input when it appears
  useEffect(() => {
    if (editingSceneId) renameInputRef.current?.select()
  }, [editingSceneId])

  // ── Scene rename ───────────────────────────────────────────────────────────
  function commitRename() {
    if (editingSceneId && editingSceneName.trim()) {
      useGameStore.getState().updateScene(editingSceneId, { name: editingSceneName.trim() })
    }
    setEditingSceneId(null)
  }

  // ── Add object ─────────────────────────────────────────────────────────────
  function handleAddObject(type: SceneObjectType) {
    if (!activeScene) return
    setShowTypeMenu(false)
    const id = `obj-${Date.now()}`
    const isBackground = type === 'background'
    const obj: SceneObject = {
      id,
      name: `${TYPE_CONFIG[type].label} ${activeScene.objects.filter((o) => o.type === type).length + 1}`,
      type,
      x: isBackground ? 0 : 100 + Math.random() * 300,
      y: isBackground ? 0 : 100 + Math.random() * 200,
      width: isBackground ? activeScene.width : 120,
      height: isBackground ? activeScene.height : 120,
      opacity: 1,
      zIndex: isBackground ? -1 : activeScene.objects.length,
      visible: true,
      properties: {},
    }
    addSceneObject(activeScene.id, obj)
    setSelectedObjId(id)
  }

  // ── Canvas interactions ────────────────────────────────────────────────────
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (pathMode) {
      if (e.target === e.target.getStage()) setSelectedZoneId(null)
      return
    }
    if (scaleMode) {
      if (e.target === e.target.getStage()) setSelectedScaleZoneId(null)
      return
    }
    if (e.target === e.target.getStage()) {
      setSelectedObjId(null)
      transformerRef.current?.nodes([])
    }
  }

  // Get scene coordinates from a Konva pointer position
  const stageToScene = useCallback(() => {
    const pos = stageRef.current?.getPointerPosition()
    if (!pos || !activeScene) return null
    const sx = (800 / activeScene.width) * zoom
    const sy = (450 / activeScene.height) * zoom
    return { x: pos.x / sx, y: pos.y / sy }
  }, [activeScene, zoom])

  const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if ((!pathMode && !scaleMode) || !activeScene) return
    if (e.target !== e.target.getStage()) return
    const pos = stageToScene()
    if (!pos) return
    if (pathMode) {
      isDrawingRef.current = true
      setDrawingZone({ startX: pos.x, startY: pos.y, w: 0, h: 0 })
      setSelectedZoneId(null)
    } else {
      isDrawingScaleRef.current = true
      setDrawingScaleZone({ startX: pos.x, startY: pos.y, w: 0, h: 0 })
      setSelectedScaleZoneId(null)
    }
  }, [pathMode, scaleMode, activeScene, stageToScene])

  const handleStageMouseMove = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = stageToScene()
    if (!pos) return
    if (pathMode && isDrawingRef.current) {
      setDrawingZone((prev) => prev ? { ...prev, w: pos.x - prev.startX, h: pos.y - prev.startY } : null)
    } else if (scaleMode && isDrawingScaleRef.current) {
      setDrawingScaleZone((prev) => prev ? { ...prev, w: pos.x - prev.startX, h: pos.y - prev.startY } : null)
    }
  }, [pathMode, scaleMode, stageToScene])

  const handleStageMouseUp = useCallback(() => {
    if (pathMode && isDrawingRef.current && drawingZone && activeScene) {
      isDrawingRef.current = false
      const w = Math.abs(drawingZone.w), h = Math.abs(drawingZone.h)
      if (w > 10 && h > 10) {
        const x = drawingZone.w < 0 ? drawingZone.startX + drawingZone.w : drawingZone.startX
        const y = drawingZone.h < 0 ? drawingZone.startY + drawingZone.h : drawingZone.startY
        const zone: BlockedZone = {
          id: `zone-${Date.now()}`,
          label: `Block ${(activeScene.blockedZones?.length ?? 0) + 1}`,
          x, y, width: w, height: h,
        }
        addBlockedZone(activeScene.id, zone)
        setSelectedZoneId(zone.id)
      }
      setDrawingZone(null)
    }
    if (scaleMode && isDrawingScaleRef.current && drawingScaleZone && activeScene) {
      isDrawingScaleRef.current = false
      const w = Math.abs(drawingScaleZone.w), h = Math.abs(drawingScaleZone.h)
      if (w > 10 && h > 10) {
        const x = drawingScaleZone.w < 0 ? drawingScaleZone.startX + drawingScaleZone.w : drawingScaleZone.startX
        const y = drawingScaleZone.h < 0 ? drawingScaleZone.startY + drawingScaleZone.h : drawingScaleZone.startY
        const zone: ScaleZone = {
          id: `szn-${Date.now()}`,
          label: `Scale ${(activeScene.scaleZones?.length ?? 0) + 1}`,
          x, y, width: w, height: h,
          scale: 0.5,
          speedMultiplier: 0.5,
        }
        addScaleZone(activeScene.id, zone)
        setSelectedScaleZoneId(zone.id)
      }
      setDrawingScaleZone(null)
    }
  }, [pathMode, scaleMode, drawingZone, drawingScaleZone, activeScene, addBlockedZone, addScaleZone])

  const handleObjectClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>, objId: string) => {
      e.cancelBubble = true
      setSelectedObjId(objId)
      const node = e.target
      selectedShapeRef.current = node
      if (transformerRef.current) {
        transformerRef.current.nodes([node])
        transformerRef.current.getLayer()?.batchDraw()
      }
    },
    []
  )

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>, objId: string) => {
      updateSceneObject(activeScene!.id, objId, { x: e.target.x(), y: e.target.y() })
    },
    [activeScene, updateSceneObject]
  )

  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>, objId: string) => {
      const node = e.target as Konva.Rect
      updateSceneObject(activeScene!.id, objId, {
        x: node.x(),
        y: node.y(),
        width: Math.max(10, node.width() * node.scaleX()),
        height: Math.max(10, node.height() * node.scaleY()),
      })
      node.scaleX(1)
      node.scaleY(1)
    },
    [activeScene, updateSceneObject]
  )

  // ── Background image ───────────────────────────────────────────────────────
  function handleSetBgImage(url: string) {
    if (!activeScene) return
    useGameStore.getState().updateScene(activeScene.id, { backgroundImageUrl: url })
    setShowBgPicker(false)
  }

  function handleClearBgImage() {
    if (!activeScene) return
    useGameStore.getState().updateScene(activeScene.id, { backgroundImageUrl: undefined })
  }

  function handleAiBgGenerated(dataUrl: string, prompt: string) {
    const name = `AI: ${prompt.slice(0, 40).trim()}`
    const asset: Asset = {
      id: `asset-${Date.now()}`,
      name,
      type: 'image',
      url: dataUrl,
      size: Math.round(dataUrl.length * 0.75),
      createdAt: new Date().toISOString(),
    }
    addAsset(asset)
    if (activeScene) {
      useGameStore.getState().updateScene(activeScene.id, { backgroundImageUrl: dataUrl })
    }
    setShowAiBgModal(false)
  }

  // ── Delete selected object (toolbar) ──────────────────────────────────────
  function deleteSelected() {
    if (!activeScene || !selectedObjId) return
    deleteSceneObject(activeScene.id, selectedObjId)
    setSelectedObjId(null)
    transformerRef.current?.nodes([])
  }

  // ── Canvas sizing with zoom ────────────────────────────────────────────────
  const BASE_W = 800
  const BASE_H = 450
  const canvasW = Math.round(BASE_W * zoom)
  const canvasH = Math.round(BASE_H * zoom)
  const scaleX = activeScene ? (BASE_W / activeScene.width) * zoom : zoom
  const scaleY = activeScene ? (BASE_H / activeScene.height) * zoom : zoom

  const zoomPct = Math.round(zoom * 100)

  return (
    <div className="flex h-full bg-gray-900">

      {/* ── Left panel ──────────────────────────────────────────────────────── */}
      <div className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">

        {/* Scene list header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold">Scenes</span>
          <button
            onClick={() => {
              const id = `scene-${Date.now()}`
              addScene({ id, name: `Scene ${scenes.length + 1}`, width: 1280, height: 720, backgroundColor: '#1a1a2e', objects: [] })
              setActiveScene(id)
              setSelectedObjId(null)
            }}
            className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
            title="Add Scene"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Scene list */}
        <div className="flex-1 overflow-y-auto py-1">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              className={`flex items-center gap-1 px-3 py-2 cursor-pointer group ${
                scene.id === activeSceneId ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => {
                if (editingSceneId !== scene.id) {
                  setActiveScene(scene.id)
                  setSelectedObjId(null)
                }
              }}
              onDoubleClick={() => {
                setEditingSceneId(scene.id)
                setEditingSceneName(scene.name)
              }}
            >
              {editingSceneId === scene.id ? (
                <input
                  ref={renameInputRef}
                  value={editingSceneName}
                  onChange={(e) => setEditingSceneName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditingSceneId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-gray-700 text-gray-100 text-sm rounded px-1 py-0 outline-none border border-indigo-400 min-w-0"
                />
              ) : (
                <span className="text-sm truncate flex-1" title="Double-click to rename">{scene.name}</span>
              )}
              {scenes.length > 1 && editingSceneId !== scene.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (scenes.length > 1) deleteScene(scene.id) }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-600 text-gray-400 hover:text-white shrink-0"
                  title="Delete scene"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Object list */}
        <div className="border-t border-gray-700">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <span className="text-gray-300 text-sm font-semibold">Objects</span>

            {/* Add object type dropdown */}
            <div className="relative" ref={typeMenuRef}>
              <button
                onClick={() => setShowTypeMenu((v) => !v)}
                className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-0.5"
                title="Add object"
              >
                <Plus size={14} />
                <ChevronDown size={10} />
              </button>
              {showTypeMenu && (
                <div className="absolute right-0 bottom-full mb-1 z-30 w-36 bg-gray-900 border border-gray-600 rounded-lg shadow-xl overflow-hidden">
                  {OBJECT_TYPES.map((t) => {
                    const cfg = TYPE_CONFIG[t]
                    return (
                      <button
                        key={t}
                        onClick={() => handleAddObject(t)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                      >
                        <span style={{ color: cfg.stroke }}>{cfg.icon}</span>
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="max-h-44 overflow-y-auto py-1">
            {activeScene?.objects
              .slice()
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((obj) => {
                const cfg = TYPE_CONFIG[obj.type]
                return (
                  <div
                    key={obj.id}
                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer group ${
                      obj.id === selectedObjId ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                    onClick={() => setSelectedObjId(obj.id)}
                  >
                    <span style={{ color: obj.id === selectedObjId ? '#c7d2fe' : cfg.stroke }} className="shrink-0 mr-1.5">
                      {cfg.icon}
                    </span>
                    <span className="text-xs truncate flex-1">{obj.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSceneObject(activeScene.id, obj.id)
                        if (selectedObjId === obj.id) setSelectedObjId(null)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-600 shrink-0"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )
              })}
            {activeScene?.objects.length === 0 && (
              <p className="text-gray-500 text-xs px-3 py-2">No objects — click + to add</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Center: toolbar + canvas ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0 flex-wrap">
          {!pathMode && (
            <button
              onClick={() => setSelectedObjId(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600"
            >
              <MousePointer size={14} /> Select
            </button>
          )}

          {!pathMode && selectedObjId && (
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-red-700 hover:bg-red-600 text-white"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}

          {/* Path mode toggle */}
          <button
            onClick={() => {
              const next = !pathMode
              setPathMode(next)
              if (next) setScaleMode(false)
              setSelectedObjId(null); setSelectedZoneId(null); setSelectedScaleZoneId(null); setDrawingZone(null); setDrawingScaleZone(null)
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              pathMode ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Toggle path/blocking editor"
          >
            <ShieldOff size={14} />
            {pathMode ? 'Pathing (ON)' : 'Pathing'}
          </button>

          {/* Scale zone mode toggle */}
          <button
            onClick={() => {
              const next = !scaleMode
              setScaleMode(next)
              if (next) setPathMode(false)
              setSelectedObjId(null); setSelectedZoneId(null); setSelectedScaleZoneId(null); setDrawingZone(null); setDrawingScaleZone(null)
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              scaleMode ? 'bg-teal-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Toggle scale/perspective zones editor"
          >
            <Shrink size={14} />
            {scaleMode ? 'Scale Zones (ON)' : 'Scale Zones'}
          </button>

          {pathMode && selectedZoneId && (
            <button
              onClick={() => { if (activeScene) deleteBlockedZone(activeScene.id, selectedZoneId); setSelectedZoneId(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-red-700 hover:bg-red-600 text-white"
            >
              <Trash2 size={14} /> Delete Zone
            </button>
          )}

          {scaleMode && selectedScaleZoneId && (
            <button
              onClick={() => { if (activeScene) deleteScaleZone(activeScene.id, selectedScaleZoneId); setSelectedScaleZoneId(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-teal-700 hover:bg-teal-600 text-white"
            >
              <Trash2 size={14} /> Delete Scale Zone
            </button>
          )}

          {pathMode && (
            <span className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded border border-red-700/30">
              Click &amp; drag to draw blocked zones · Click zone to select · Del to remove
            </span>
          )}

          {scaleMode && (
            <span className="text-xs text-teal-400 bg-teal-900/20 px-2 py-1 rounded border border-teal-700/30">
              Click &amp; drag to draw scale zones · Click zone to set shrink &amp; speed · Del to remove
            </span>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setZoom((z) => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))}
              className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <input
              type="range"
              min={0.25}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-24 accent-indigo-500"
              title="Zoom"
            />
            <button
              onClick={() => setZoom((z) => Math.min(4, parseFloat((z + 0.25).toFixed(2))))}
              className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
            <span className="text-xs text-gray-500 w-10 text-right">{zoomPct}%</span>
            <button
              onClick={() => setZoom(1)}
              className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-400"
              title="Reset zoom"
            >
              1:1
            </button>
          </div>

          <span className="text-xs text-gray-600 pl-2 border-l border-gray-700">
            {activeScene?.name} — {activeScene?.width}×{activeScene?.height}
            {!pathMode && !scaleMode && selectedObjId && <span className="ml-2 text-indigo-400">1 selected · Del to remove</span>}
            {pathMode && <span className="ml-2 text-red-400">{activeScene?.blockedZones?.length ?? 0} blocked zone{(activeScene?.blockedZones?.length ?? 0) !== 1 ? 's' : ''}</span>}
            {scaleMode && <span className="ml-2 text-teal-400">{activeScene?.scaleZones?.length ?? 0} scale zone{(activeScene?.scaleZones?.length ?? 0) !== 1 ? 's' : ''}</span>}
          </span>
        </div>

        {/* Canvas area */}
        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-auto bg-gray-950 p-8 flex items-start justify-start"
        >
          {activeScene && (
            <div
              style={{ width: canvasW, height: canvasH, minWidth: canvasW, minHeight: canvasH }}
              className="shadow-2xl border border-gray-600 m-auto"
            >
              <Stage
                ref={stageRef}
                width={canvasW}
                height={canvasH}
                scaleX={scaleX}
                scaleY={scaleY}
                onClick={handleStageClick}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                style={{ cursor: pathMode ? 'crosshair' : 'default' }}
              >
                <Layer>
                  {/* Scene background color */}
                  <Rect
                    x={0} y={0}
                    width={activeScene.width} height={activeScene.height}
                    fill={activeScene.backgroundColor}
                    listening={false}
                  />

                  {/* Scene background image */}
                  {bgImage && (
                    <KonvaImage
                      image={bgImage}
                      x={0} y={0}
                      width={activeScene.width} height={activeScene.height}
                      listening={false}
                    />
                  )}

                  {/* Objects + character, depth-sorted by z-index.
                      Character depth = bottom of character (feet Y).
                      Objects with zIndex > charDepth render in front of the character. */}
                  {(() => {
                    const cp = activeScene.characterPlacement
                    const charDepth = cp?.visible
                      ? cp.y + mainCharacter.height
                      : null

                    const sorted = [...activeScene.objects].sort((a, b) => a.zIndex - b.zIndex)

                    function renderSceneObj(obj: typeof sorted[0]) {
                      if (!obj.visible) return null
                      const cfg = TYPE_CONFIG[obj.type]
                      const isSelected = obj.id === selectedObjId

                      // Resolve NPC sprite if this is a character object with an npcId
                      let sheet = obj.spriteSheetId
                        ? project.spriteSheets.find((s) => s.id === obj.spriteSheetId) ?? null
                        : null
                      let fi = obj.frameIndex ?? 0

                      if (!sheet && obj.type === 'character' && obj.npcId) {
                        const npc = (project.npcs ?? []).find((n: NpcCharacter) => n.id === obj.npcId)
                        if (npc) {
                          const facingAnim = npc.animations[npc.defaultFacing]
                          if (facingAnim?.spriteSheetId) {
                            sheet = project.spriteSheets.find((s) => s.id === facingAnim.spriteSheetId) ?? null
                            if (sheet && facingAnim.animationId) {
                              const animDef = sheet.animations.find((a) => a.id === facingAnim.animationId)
                              fi = animDef?.startFrame ?? 0
                            }
                          }
                        }
                      }

                      const sheetImg = sheet ? spriteImages.get(sheet.imageUrl) ?? null : null
                      const col = fi % (sheet?.cols ?? 1)
                      const row = Math.floor(fi / (sheet?.cols ?? 1))

                      const handlers = {
                        draggable: true,
                        onClick: (e: Konva.KonvaEventObject<MouseEvent>) => handleObjectClick(e, obj.id),
                        onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(e, obj.id),
                        onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(e, obj.id),
                      }

                      return [
                        sheetImg && sheet ? (
                          <KonvaImage
                            key={obj.id}
                            image={sheetImg}
                            crop={{
                              x: col * sheet.frameWidth,
                              y: row * sheet.frameHeight,
                              width: sheet.frameWidth,
                              height: sheet.frameHeight,
                            }}
                            x={obj.x} y={obj.y}
                            width={obj.width} height={obj.height}
                            opacity={obj.opacity}
                            {...handlers}
                          />
                        ) : (
                          <Rect
                            key={obj.id}
                            x={obj.x} y={obj.y}
                            width={obj.width} height={obj.height}
                            opacity={obj.opacity}
                            fill={isSelected ? 'rgba(99,102,241,0.35)' : cfg.fill}
                            stroke={isSelected ? '#818cf8' : cfg.stroke}
                            strokeWidth={obj.type === 'hotspot' ? 1.5 : 2}
                            dash={isSelected ? undefined : cfg.dash}
                            {...handlers}
                          />
                        ),
                        // Selection overlay for image objects (Transformer already shows handles)
                        isSelected && sheetImg && (
                          <Rect
                            key={`sel-${obj.id}`}
                            x={obj.x} y={obj.y}
                            width={obj.width} height={obj.height}
                            fill="rgba(99,102,241,0.20)"
                            stroke="#818cf8"
                            strokeWidth={2}
                            listening={false}
                          />
                        ),
                        // Label: only show for non-hotspot placeholder objects (no image assigned)
                        !sheetImg && obj.type !== 'hotspot' && (
                          <Text
                            key={`lbl-${obj.id}`}
                            x={obj.x + 4} y={obj.y + 4}
                            text={obj.name}
                            fontSize={12}
                            fill="#e2e8f0"
                            listening={false}
                          />
                        ),
                        obj.type === 'hotspot' && obj.id === selectedObjId && (
                          <Text
                            key={`lbl-hs-${obj.id}`}
                            x={obj.x + 4} y={obj.y + 4}
                            text={`⬚ ${obj.name}`}
                            fontSize={11}
                            fill="#818cf8"
                            listening={false}
                          />
                        ),
                      ]
                    }

                    function renderCharacter() {
                      if (!cp?.visible) return null
                      const cw = mainCharacter.width
                      const ch = mainCharacter.height
                      return [
                        charSpriteImage && charSheet ? (
                          <KonvaImage
                            key="char-sprite"
                            image={charSpriteImage}
                            crop={{
                              x: charFrameCol * charSheet.frameWidth,
                              y: charFrameRow * charSheet.frameHeight,
                              width: charSheet.frameWidth,
                              height: charSheet.frameHeight,
                            }}
                            x={cp.x} y={cp.y}
                            width={cw} height={ch}
                            listening={false}
                          />
                        ) : (
                          <Rect
                            key="char-rect"
                            x={cp.x} y={cp.y}
                            width={cw} height={ch}
                            fill="rgba(99,102,241,0.18)"
                            stroke="#818cf8"
                            strokeWidth={2}
                            dash={[5, 3]}
                            listening={false}
                          />
                        ),
                        <Text
                          key="char-lbl"
                          x={cp.x} y={cp.y - 16}
                          text={`${FACING_ARROWS[cp.facing]} ${mainCharacter.name}`}
                          fontSize={11}
                          fill="#a5b4fc"
                          listening={false}
                        />,
                      ]
                    }

                    const elements: React.ReactNode[] = []
                    let charDrawn = false
                    for (const obj of sorted) {
                      if (!charDrawn && charDepth !== null && obj.zIndex > charDepth) {
                        elements.push(...(renderCharacter() ?? []))
                        charDrawn = true
                      }
                      elements.push(...(renderSceneObj(obj) ?? []))
                    }
                    if (!charDrawn) elements.push(...(renderCharacter() ?? []))
                    return elements
                  })()}

                  {/* Blocked zones */}
                  {(activeScene.blockedZones ?? []).map((zone) => {
                    const isSel = zone.id === selectedZoneId
                    return (
                      <Rect
                        key={zone.id}
                        x={zone.x} y={zone.y}
                        width={zone.width} height={zone.height}
                        fill={isSel ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.18)'}
                        stroke={isSel ? '#ef4444' : '#f87171'}
                        strokeWidth={isSel ? 2.5 : 1.5}
                        dash={isSel ? undefined : [6, 3]}
                        listening={pathMode}
                        onClick={pathMode ? (e) => { e.cancelBubble = true; setSelectedZoneId(zone.id) } : undefined}
                      />
                    )
                  })}

                  {/* Zone labels — only shown in path mode */}
                  {pathMode && (activeScene.blockedZones ?? []).map((zone) => (
                    <Text
                      key={`lbl-z-${zone.id}`}
                      x={zone.x + 4} y={zone.y + 4}
                      text={zone.label}
                      fontSize={10}
                      fill="#fca5a5"
                      listening={false}
                    />
                  ))}

                  {/* Drawing preview — blocked zone */}
                  {pathMode && drawingZone && (() => {
                    const x = drawingZone.w < 0 ? drawingZone.startX + drawingZone.w : drawingZone.startX
                    const y = drawingZone.h < 0 ? drawingZone.startY + drawingZone.h : drawingZone.startY
                    return (
                      <Rect
                        x={x} y={y}
                        width={Math.abs(drawingZone.w)} height={Math.abs(drawingZone.h)}
                        fill="rgba(239,68,68,0.25)"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dash={[5, 3]}
                        listening={false}
                      />
                    )
                  })()}

                  {/* Scale zones */}
                  {(activeScene.scaleZones ?? []).map((zone) => {
                    const isSel = zone.id === selectedScaleZoneId
                    return (
                      <Rect
                        key={zone.id}
                        x={zone.x} y={zone.y}
                        width={zone.width} height={zone.height}
                        fill={isSel ? 'rgba(20,184,166,0.30)' : 'rgba(20,184,166,0.12)'}
                        stroke={isSel ? '#14b8a6' : '#5eead4'}
                        strokeWidth={isSel ? 2.5 : 1.5}
                        dash={isSel ? undefined : [6, 3]}
                        listening={scaleMode}
                        onClick={scaleMode ? (e) => { e.cancelBubble = true; setSelectedScaleZoneId(zone.id) } : undefined}
                      />
                    )
                  })}

                  {/* Scale zone labels — shown when scale mode is on */}
                  {scaleMode && (activeScene.scaleZones ?? []).map((zone) => (
                    <Text
                      key={`lbl-sz-${zone.id}`}
                      x={zone.x + 4} y={zone.y + 4}
                      text={`${zone.label} ×${zone.scale} spd×${zone.speedMultiplier}`}
                      fontSize={10}
                      fill="#5eead4"
                      listening={false}
                    />
                  ))}

                  {/* Drawing preview — scale zone */}
                  {scaleMode && drawingScaleZone && (() => {
                    const x = drawingScaleZone.w < 0 ? drawingScaleZone.startX + drawingScaleZone.w : drawingScaleZone.startX
                    const y = drawingScaleZone.h < 0 ? drawingScaleZone.startY + drawingScaleZone.h : drawingScaleZone.startY
                    return (
                      <Rect
                        x={x} y={y}
                        width={Math.abs(drawingScaleZone.w)} height={Math.abs(drawingScaleZone.h)}
                        fill="rgba(20,184,166,0.20)"
                        stroke="#14b8a6"
                        strokeWidth={2}
                        dash={[5, 3]}
                        listening={false}
                      />
                    )
                  })()}

                  <Transformer
                    ref={transformerRef}
                    boundBoxFunc={(oldBox, newBox) =>
                      newBox.width < 10 || newBox.height < 10 ? oldBox : newBox
                    }
                  />
                </Layer>
              </Stage>
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────────── */}
      <div className="w-56 bg-gray-800 border-l border-gray-700 flex flex-col shrink-0">
        <div className="px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold">
            {pathMode ? 'Blocked Zone' : scaleMode ? 'Scale Zone' : 'Properties'}
          </span>
        </div>

        {/* Scale zone mode: show selected scale zone properties */}
        {scaleMode && (() => {
          const zone = (activeScene?.scaleZones ?? []).find((z) => z.id === selectedScaleZoneId)
          if (!zone || !activeScene) return (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-gray-500 text-xs text-center leading-relaxed">
                Click &amp; drag on the canvas to create a scale zone.<br />
                <span className="text-gray-600">Click an existing zone to edit it.</span>
              </p>
            </div>
          )
          return (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Label</label>
                <input
                  type="text"
                  value={zone.label}
                  onChange={(e) => updateScaleZone(activeScene.id, zone.id, { label: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Scale — {(zone.scale * 100).toFixed(0)}%
                </label>
                <input
                  type="range" min={0.1} max={1} step={0.05}
                  value={zone.scale}
                  onChange={(e) => updateScaleZone(activeScene.id, zone.id, { scale: parseFloat(e.target.value) })}
                  className="w-full accent-teal-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Speed — {(zone.speedMultiplier * 100).toFixed(0)}%
                </label>
                <input
                  type="range" min={0.1} max={1} step={0.05}
                  value={zone.speedMultiplier}
                  onChange={(e) => updateScaleZone(activeScene.id, zone.id, { speedMultiplier: parseFloat(e.target.value) })}
                  className="w-full accent-teal-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map((prop) => (
                  <div key={prop}>
                    <label className="text-xs text-gray-400 block mb-1 uppercase">{prop === 'width' ? 'W' : prop === 'height' ? 'H' : prop.toUpperCase()}</label>
                    <input
                      type="number"
                      value={Math.round(zone[prop])}
                      onChange={(e) => updateScaleZone(activeScene.id, zone.id, { [prop]: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => { deleteScaleZone(activeScene.id, zone.id); setSelectedScaleZoneId(null) }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm bg-teal-800 hover:bg-teal-700 text-white mt-2"
              >
                <Trash2 size={13} /> Delete Zone
              </button>
              <p className="text-xs text-teal-400/70 bg-teal-900/10 rounded p-2">
                Character shrinks and slows inside this zone to simulate perspective depth.
              </p>
            </div>
          )
        })()}

        {/* Path mode: show selected zone properties */}
        {pathMode && (() => {
          const zone = (activeScene?.blockedZones ?? []).find((z) => z.id === selectedZoneId)
          if (!zone || !activeScene) return (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-gray-500 text-xs text-center leading-relaxed">
                Click &amp; drag on the canvas to create a blocked zone.<br />
                <span className="text-gray-600">Click an existing zone to edit it.</span>
              </p>
            </div>
          )
          return (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Label</label>
                <input
                  type="text"
                  value={zone.label}
                  onChange={(e) => useGameStore.getState().updateBlockedZone(activeScene.id, zone.id, { label: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map((prop) => (
                  <div key={prop}>
                    <label className="text-xs text-gray-400 block mb-1 uppercase">{prop === 'width' ? 'W' : prop === 'height' ? 'H' : prop.toUpperCase()}</label>
                    <input
                      type="number"
                      value={Math.round(zone[prop])}
                      onChange={(e) =>
                        useGameStore.getState().updateBlockedZone(activeScene.id, zone.id, {
                          [prop]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-red-500"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => { deleteBlockedZone(activeScene.id, zone.id); setSelectedZoneId(null) }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm bg-red-700 hover:bg-red-600 text-white mt-2"
              >
                <Trash2 size={13} /> Delete Zone
              </button>
              <p className="text-xs text-red-400/70 bg-red-900/10 rounded p-2">
                Characters cannot walk through blocked zones at runtime.
              </p>
            </div>
          )
        })()}

        {selectedObj && activeScene && !pathMode && !scaleMode ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* Name */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Name</label>
              <input
                type="text"
                value={selectedObj.name}
                onChange={(e) => updateSceneObject(activeScene.id, selectedObj.id, { name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Type</label>
              <select
                value={selectedObj.type}
                onChange={(e) =>
                  updateSceneObject(activeScene.id, selectedObj.id, { type: e.target.value as SceneObjectType })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                {OBJECT_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
                ))}
              </select>
            </div>

            {/* X / Y / Width / Height */}
            <div className="grid grid-cols-2 gap-2">
              {(['x', 'y', 'width', 'height'] as const).map((prop) => (
                <div key={prop}>
                  <label className="text-xs text-gray-400 block mb-1 capitalize">
                    {prop === 'width' ? 'W' : prop === 'height' ? 'H' : prop.toUpperCase()}
                  </label>
                  <input
                    type="number"
                    value={Math.round(selectedObj[prop])}
                    onChange={(e) =>
                      updateSceneObject(activeScene.id, selectedObj.id, {
                        [prop]: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>

            {/* Opacity */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Opacity — {(selectedObj.opacity * 100).toFixed(0)}%
              </label>
              <input
                type="range" min={0} max={1} step={0.01}
                value={selectedObj.opacity}
                onChange={(e) =>
                  updateSceneObject(activeScene.id, selectedObj.id, { opacity: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-500"
              />
            </div>

            {/* Z-Index */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Z-Index</label>
              <input
                type="number"
                value={selectedObj.zIndex}
                onChange={(e) =>
                  updateSceneObject(activeScene.id, selectedObj.id, { zIndex: parseInt(e.target.value) || 0 })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Visible */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">Visible</label>
              <input
                type="checkbox"
                checked={selectedObj.visible}
                onChange={(e) =>
                  updateSceneObject(activeScene.id, selectedObj.id, { visible: e.target.checked })
                }
                className="rounded"
              />
            </div>

            {/* Sprite picker — available for sprite and item types */}
            {(selectedObj.type === 'sprite' || selectedObj.type === 'item') && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Sprite</label>
                <select
                  value={selectedObj.spriteSheetId ?? ''}
                  onChange={(e) => {
                    updateSceneObject(activeScene.id, selectedObj.id, {
                      spriteSheetId: e.target.value || undefined,
                      frameIndex: 0,
                    })
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— none —</option>
                  {project.spriteSheets.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                {selectedObj.spriteSheetId && (() => {
                  const sheet = project.spriteSheets.find((s) => s.id === selectedObj.spriteSheetId)
                  if (!sheet) return null
                  const totalFrames = sheet.rows * sheet.cols
                  const currentFrame = selectedObj.frameIndex ?? 0
                  const scale = 36 / Math.max(sheet.frameWidth, sheet.frameHeight)
                  return (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">Frame {currentFrame} of {totalFrames - 1}</span>
                        <button
                          onClick={() => updateSceneObject(activeScene.id, selectedObj.id, { spriteSheetId: undefined, frameIndex: undefined })}
                          className="text-xs text-gray-600 hover:text-red-400"
                          title="Remove sprite"
                        >
                          ✕ remove
                        </button>
                      </div>
                      <div
                        className="grid gap-0.5 max-h-36 overflow-y-auto"
                        style={{ gridTemplateColumns: `repeat(${Math.min(sheet.cols, 4)}, 1fr)` }}
                      >
                        {Array.from({ length: totalFrames }, (_, fi) => {
                          const fc = fi % sheet.cols
                          const fr = Math.floor(fi / sheet.cols)
                          const isCurrent = fi === currentFrame
                          return (
                            <button
                              key={fi}
                              title={`Frame ${fi}`}
                              onClick={() => updateSceneObject(activeScene.id, selectedObj.id, { frameIndex: fi })}
                              className={`relative overflow-hidden rounded border ${
                                isCurrent ? 'border-indigo-400' : 'border-gray-700 hover:border-gray-500'
                              }`}
                              style={{ width: 38, height: 38 }}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  backgroundImage: `url(${sheet.imageUrl})`,
                                  backgroundPosition: `-${fc * sheet.frameWidth * scale}px -${fr * sheet.frameHeight * scale}px`,
                                  backgroundSize: `${sheet.imageWidth * scale}px ${sheet.imageHeight * scale}px`,
                                  backgroundRepeat: 'no-repeat',
                                  imageRendering: 'pixelated',
                                }}
                              />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* NPC picker — available for character type objects */}
            {selectedObj.type === 'character' && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">NPC Character</label>
                <select
                  value={selectedObj.npcId ?? ''}
                  onChange={(e) => {
                    const npcId = e.target.value || undefined
                    const npc = npcId ? (project.npcs ?? []).find((n: NpcCharacter) => n.id === npcId) : null
                    updateSceneObject(activeScene.id, selectedObj.id, {
                      npcId,
                      ...(npc ? { width: npc.width, height: npc.height } : {}),
                    })
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— none —</option>
                  {(project.npcs ?? []).map((npc: NpcCharacter) => (
                    <option key={npc.id} value={npc.id}>{npc.name}</option>
                  ))}
                </select>
                {(project.npcs ?? []).length === 0 && (
                  <p className="text-xs text-gray-600 mt-1 italic">Add NPCs in the Characters editor first.</p>
                )}
              </div>
            )}

            {/* Movement instruction — character objects with an NPC assigned */}
            {selectedObj.type === 'character' && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Movement</label>
                <select
                  value={selectedObj.movementInstruction ?? 'none'}
                  onChange={(e) => updateSceneObject(activeScene.id, selectedObj.id, {
                    movementInstruction: e.target.value as NpcMovementInstruction,
                  })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="none">None</option>
                  <option value="roam-slow-and-eat-grass">Roam – Slow &amp; Eat Grass</option>
                  <option value="roam-human-in-field">Roam – Human in Field</option>
                  <option value="follow-hero">Follow Hero</option>
                  <option value="follow-and-attack-hero">Follow &amp; Attack Hero</option>
                </select>
                {!selectedObj.npcId && (selectedObj.movementInstruction ?? 'none') !== 'none' && (
                  <p className="text-xs text-amber-500 mt-1 italic">Assign an NPC Character above to enable movement.</p>
                )}
              </div>
            )}

            {selectedObj.type === 'hotspot' && (
              <p className="text-xs text-indigo-400 bg-indigo-900/20 rounded p-2">
                Hotspots are invisible in-game — they act as click/hover trigger zones.
              </p>
            )}
          </div>
        ) : !pathMode && !scaleMode ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500 text-xs text-center px-4 leading-relaxed">
              Select an object to edit its properties.<br />
              <span className="text-gray-600">Double-click a scene name to rename it.</span>
            </p>
          </div>
        ) : null}

        {/* Scene properties */}
        {activeScene && (
          <div className="border-t border-gray-700 p-3 space-y-3 shrink-0">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide block">Scene</span>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Name</label>
              <input
                type="text"
                value={activeScene.name}
                onChange={(e) => useGameStore.getState().updateScene(activeScene.id, { name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Background Color</label>
              <input
                type="color"
                value={activeScene.backgroundColor}
                onChange={(e) => useGameStore.getState().updateScene(activeScene.id, { backgroundColor: e.target.value })}
                className="w-full h-8 bg-gray-700 border border-gray-600 rounded cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Background Image</label>
              {activeScene.backgroundImageUrl ? (
                <div className="relative mb-2 rounded overflow-hidden border border-gray-600 group">
                  <img src={activeScene.backgroundImageUrl} alt="bg" className="w-full h-16 object-cover" />
                  <button
                    onClick={handleClearBgImage}
                    className="absolute top-1 right-1 p-0.5 rounded bg-gray-900/80 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="w-full h-10 mb-2 rounded border border-dashed border-gray-600 flex items-center justify-center">
                  <span className="text-xs text-gray-500">None</span>
                </div>
              )}

              <div className="space-y-1.5">
              {aiSettings.enabled && (
                <button
                  onClick={() => setShowAiBgModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs bg-violet-700 hover:bg-violet-600 text-white border border-violet-600"
                >
                  <Sparkles size={11} /> AI Generate Background
                </button>
              )}
              <div className="relative" ref={bgPickerRef}>
                <button
                  onClick={() => setShowBgPicker((v) => !v)}
                  className="w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded text-xs bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-300"
                >
                  <span className="flex items-center gap-1"><ImageIcon size={11} /> {activeScene.backgroundImageUrl ? 'Change' : 'Choose image'}</span>
                  <ChevronDown size={11} className={showBgPicker ? 'rotate-180' : ''} />
                </button>
                {showBgPicker && (
                  <div className="absolute bottom-full mb-1 left-0 right-0 z-20 bg-gray-900 border border-gray-600 rounded-lg shadow-xl overflow-hidden">
                    {imageAssets.length === 0 ? (
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-gray-500">No images in Assets Manager yet.</p>
                      </div>
                    ) : (
                      <div className="max-h-44 overflow-y-auto">
                        {imageAssets.map((asset) => (
                          <button
                            key={asset.id}
                            onClick={() => handleSetBgImage(asset.url)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700 text-left"
                          >
                            <img src={asset.url} alt={asset.name} className="w-9 h-6 object-cover rounded border border-gray-600 shrink-0" />
                            <span className="text-xs text-gray-300 truncate">{asset.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Character start position */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
                  <User size={11} /> Character Start
                </span>
                <input
                  type="checkbox"
                  checked={activeScene.characterPlacement?.visible ?? false}
                  onChange={(e) =>
                    updateSceneCharacterPlacement(activeScene.id, { visible: e.target.checked })
                  }
                  title="Show character in this scene"
                  className="rounded"
                />
              </div>

              {activeScene.characterPlacement?.visible && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">X</label>
                      <input
                        type="number"
                        value={activeScene.characterPlacement.x}
                        onChange={(e) =>
                          updateSceneCharacterPlacement(activeScene.id, { x: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Y</label>
                      <input
                        type="number"
                        value={activeScene.characterPlacement.y}
                        onChange={(e) =>
                          updateSceneCharacterPlacement(activeScene.id, { y: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Facing</label>
                    <select
                      value={activeScene.characterPlacement.facing}
                      onChange={(e) =>
                        updateSceneCharacterPlacement(activeScene.id, { facing: e.target.value as FacingDirection })
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="up">Up</option>
                      <option value="down">Down</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Generate Background Modal */}
      {showAiBgModal && (
        <AiGenerateModal
          title="AI Generate Scene Background"
          onGenerated={handleAiBgGenerated}
          onClose={() => setShowAiBgModal(false)}
        />
      )}
    </div>
  )
}
