import { useRef, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import { Plus, Trash2, MousePointer, Square } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { SceneObject } from '../../types'

type Tool = 'select' | 'add'

export function SceneEditor() {
  const { project, addScene, deleteScene, setActiveScene, addSceneObject, updateSceneObject, deleteSceneObject } =
    useGameStore()
  const { scenes, activeSceneId } = project

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0]

  const [selectedObjId, setSelectedObjId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const transformerRef = useRef<Konva.Transformer>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const selectedShapeRef = useRef<Konva.Rect | null>(null)

  const selectedObj = activeScene?.objects.find((o) => o.id === selectedObjId) ?? null

  const handleAddScene = () => {
    const id = `scene-${Date.now()}`
    addScene({
      id,
      name: `Scene ${scenes.length + 1}`,
      width: 1280,
      height: 720,
      backgroundColor: '#1a1a2e',
      objects: [],
    })
    setActiveScene(id)
  }

  const handleDeleteScene = (id: string) => {
    if (scenes.length <= 1) return
    deleteScene(id)
  }

  const handleAddObject = () => {
    if (!activeScene) return
    const id = `obj-${Date.now()}`
    const obj: SceneObject = {
      id,
      name: `Object ${activeScene.objects.length + 1}`,
      type: 'sprite',
      x: 100 + Math.random() * 400,
      y: 100 + Math.random() * 300,
      width: 100,
      height: 100,
      opacity: 1,
      zIndex: activeScene.objects.length,
      visible: true,
      properties: {},
    }
    addSceneObject(activeScene.id, obj)
    setSelectedObjId(id)
    setTool('select')
  }

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelectedObjId(null)
      transformerRef.current?.nodes([])
    }
  }

  const handleObjectClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>, objId: string) => {
      e.cancelBubble = true
      if (tool !== 'select') return
      setSelectedObjId(objId)
      const node = e.target as Konva.Rect
      selectedShapeRef.current = node
      if (transformerRef.current) {
        transformerRef.current.nodes([node])
        transformerRef.current.getLayer()?.batchDraw()
      }
    },
    [tool]
  )

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>, objId: string) => {
      updateSceneObject(activeScene!.id, objId, {
        x: e.target.x(),
        y: e.target.y(),
      })
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

  const CANVAS_W = 800
  const CANVAS_H = 450
  const scaleX = activeScene ? CANVAS_W / activeScene.width : 1
  const scaleY = activeScene ? CANVAS_H / activeScene.height : 1

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left Panel - Scene List */}
      <div className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold">Scenes</span>
          <button
            onClick={handleAddScene}
            className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
            title="Add Scene"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer group ${
                scene.id === activeSceneId
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => {
                setActiveScene(scene.id)
                setSelectedObjId(null)
              }}
            >
              <span className="text-sm truncate flex-1">{scene.name}</span>
              {scenes.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteScene(scene.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-600 text-gray-400 hover:text-white"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Object List */}
        <div className="border-t border-gray-700">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <span className="text-gray-300 text-sm font-semibold">Objects</span>
            <button
              onClick={handleAddObject}
              className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
              title="Add Object"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto py-1">
            {activeScene?.objects.map((obj) => (
              <div
                key={obj.id}
                className={`flex items-center justify-between px-3 py-1.5 cursor-pointer group ${
                  obj.id === selectedObjId
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => {
                  setSelectedObjId(obj.id)
                  setTool('select')
                }}
              >
                <span className="text-xs truncate flex-1">{obj.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSceneObject(activeScene.id, obj.id)
                    if (selectedObjId === obj.id) setSelectedObjId(null)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-600"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {activeScene?.objects.length === 0 && (
              <p className="text-gray-500 text-xs px-3 py-2">No objects yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
          <button
            onClick={() => setTool('select')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
              tool === 'select'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <MousePointer size={14} /> Select
          </button>
          <button
            onClick={handleAddObject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            <Square size={14} /> Add Sprite
          </button>
          {selectedObjId && (
            <button
              onClick={() => {
                if (!activeScene || !selectedObjId) return
                deleteSceneObject(activeScene.id, selectedObjId)
                setSelectedObjId(null)
                transformerRef.current?.nodes([])
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-red-700 hover:bg-red-600 text-white"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {activeScene?.name} — {activeScene?.width}×{activeScene?.height}
          </span>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center overflow-auto bg-gray-950 p-8">
          {activeScene && (
            <div
              style={{ width: CANVAS_W, height: CANVAS_H }}
              className="shadow-2xl border border-gray-600"
            >
              <Stage
                ref={stageRef}
                width={CANVAS_W}
                height={CANVAS_H}
                scaleX={scaleX}
                scaleY={scaleY}
                onClick={handleStageClick}
                style={{ background: activeScene.backgroundColor }}
              >
                <Layer>
                  {/* Background rect */}
                  <Rect
                    x={0}
                    y={0}
                    width={activeScene.width}
                    height={activeScene.height}
                    fill={activeScene.backgroundColor}
                  />
                  {[...activeScene.objects]
                    .sort((a, b) => a.zIndex - b.zIndex)
                    .map((obj) =>
                      obj.visible ? (
                        <Rect
                          key={obj.id}
                          x={obj.x}
                          y={obj.y}
                          width={obj.width}
                          height={obj.height}
                          opacity={obj.opacity}
                          fill={obj.id === selectedObjId ? '#6366f1' : '#4b5563'}
                          stroke={obj.id === selectedObjId ? '#818cf8' : '#9ca3af'}
                          strokeWidth={2}
                          draggable={tool === 'select'}
                          onClick={(e) => handleObjectClick(e, obj.id)}
                          onDragEnd={(e) => handleDragEnd(e, obj.id)}
                          onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                        />
                      ) : null
                    )}
                  {/* Object labels */}
                  {activeScene.objects
                    .filter((o) => o.visible)
                    .map((obj) => (
                      <Text
                        key={`label-${obj.id}`}
                        x={obj.x + 4}
                        y={obj.y + 4}
                        text={obj.name}
                        fontSize={12}
                        fill="#e2e8f0"
                        listening={false}
                      />
                    ))}
                  <Transformer
                    ref={transformerRef}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 10 || newBox.height < 10) return oldBox
                      return newBox
                    }}
                  />
                </Layer>
              </Stage>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Properties */}
      <div className="w-56 bg-gray-800 border-l border-gray-700 flex flex-col">
        <div className="px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold">Properties</span>
        </div>
        {selectedObj && activeScene ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Name</label>
              <input
                type="text"
                value={selectedObj.name}
                onChange={(e) =>
                  updateSceneObject(activeScene.id, selectedObj.id, { name: e.target.value })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            {(['x', 'y', 'width', 'height'] as const).map((prop) => (
              <div key={prop}>
                <label className="text-xs text-gray-400 block mb-1 capitalize">{prop}</label>
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
            <div>
              <label className="text-xs text-gray-400 block mb-1">Opacity</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selectedObj.opacity}
                onChange={(e) =>
                  updateSceneObject(activeScene.id, selectedObj.id, {
                    opacity: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
              <span className="text-xs text-gray-500">{(selectedObj.opacity * 100).toFixed(0)}%</span>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Visible</label>
              <input
                type="checkbox"
                checked={selectedObj.visible}
                onChange={(e) =>
                  updateSceneObject(activeScene.id, selectedObj.id, {
                    visible: e.target.checked,
                  })
                }
                className="rounded"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Z-Index</label>
              <input
                type="number"
                value={selectedObj.zIndex}
                onChange={(e) =>
                  updateSceneObject(activeScene.id, selectedObj.id, {
                    zIndex: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500 text-sm text-center px-4">
              Select an object to edit its properties
            </p>
          </div>
        )}

        {/* Scene Properties */}
        {activeScene && (
          <div className="border-t border-gray-700 p-3 space-y-3">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">
              Scene
            </span>
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
              <label className="text-xs text-gray-400 block mb-1">Background</label>
              <input
                type="color"
                value={activeScene.backgroundColor}
                onChange={(e) =>
                  useGameStore.getState().updateScene(activeScene.id, { backgroundColor: e.target.value })
                }
                className="w-full h-8 bg-gray-700 border border-gray-600 rounded cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
