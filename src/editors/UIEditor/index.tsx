import { useState, useRef } from 'react'
import { Trash2, Type, Square, Image, BarChart2, Grid } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { UIElement, UIElementType } from '../../types'

const ELEMENT_TOOLS: { type: UIElementType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Text', icon: <Type size={16} /> },
  { type: 'button', label: 'Button', icon: <Square size={16} /> },
  { type: 'image', label: 'Image', icon: <Image size={16} /> },
  { type: 'progressbar', label: 'Progress Bar', icon: <BarChart2 size={16} /> },
  { type: 'inventoryslot', label: 'Inventory Slot', icon: <Grid size={16} /> },
]

const DEFAULT_STYLES = {
  text: { color: '#e2e8f0', backgroundColor: 'transparent', fontSize: 16, borderRadius: 0, borderColor: 'transparent', borderWidth: 0, opacity: 1 },
  button: { color: '#ffffff', backgroundColor: '#4f46e5', fontSize: 14, borderRadius: 6, borderColor: '#6366f1', borderWidth: 1, opacity: 1 },
  image: { color: '#ffffff', backgroundColor: '#374151', fontSize: 14, borderRadius: 4, borderColor: '#4b5563', borderWidth: 1, opacity: 1 },
  progressbar: { color: '#22c55e', backgroundColor: '#1f2937', fontSize: 12, borderRadius: 4, borderColor: '#374151', borderWidth: 1, opacity: 1 },
  inventoryslot: { color: '#9ca3af', backgroundColor: '#1f2937', fontSize: 12, borderRadius: 4, borderColor: '#374151', borderWidth: 2, opacity: 1 },
}

const DEFAULT_SIZES: Record<UIElementType, { width: number; height: number }> = {
  text: { width: 200, height: 40 },
  button: { width: 160, height: 44 },
  image: { width: 120, height: 120 },
  progressbar: { width: 200, height: 24 },
  inventoryslot: { width: 64, height: 64 },
}

export function UIEditor() {
  const { project, addUIElement, updateUIElement, deleteUIElement } = useGameStore()
  const { uiElements } = project

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const CANVAS_W = 1280
  const CANVAS_H = 720
  const DISPLAY_W = 800
  const DISPLAY_H = 450
  const scaleX = DISPLAY_W / CANVAS_W
  const scaleY = DISPLAY_H / CANVAS_H

  const selectedEl = uiElements.find((e) => e.id === selectedId) ?? null

  const handleAddElement = (type: UIElementType) => {
    const el: UIElement = {
      id: `ui-${Date.now()}`,
      name: `${ELEMENT_TOOLS.find((t) => t.type === type)?.label ?? type} ${uiElements.length + 1}`,
      type,
      x: 100 + Math.random() * 400,
      y: 100 + Math.random() * 300,
      ...DEFAULT_SIZES[type],
      content: type === 'text' ? 'Text Label' : type === 'button' ? 'Button' : '',
      style: { ...DEFAULT_STYLES[type] },
      visible: true,
      zIndex: uiElements.length,
    }
    addUIElement(el)
    setSelectedId(el.id)
  }

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setSelectedId(id)
    const el = uiElements.find((u) => u.id === id)
    if (!el || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left) / scaleX
    const mouseY = (e.clientY - rect.top) / scaleY
    setDragging({ id, offsetX: mouseX - el.x, offsetY: mouseY - el.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left) / scaleX
    const mouseY = (e.clientY - rect.top) / scaleY
    updateUIElement(dragging.id, {
      x: Math.max(0, mouseX - dragging.offsetX),
      y: Math.max(0, mouseY - dragging.offsetY),
    })
  }

  const handleMouseUp = () => {
    setDragging(null)
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left Toolbar */}
      <div className="w-48 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold">Add Widget</span>
        </div>
        <div className="flex-1 py-2 space-y-1">
          {ELEMENT_TOOLS.map((tool) => (
            <button
              key={tool.type}
              onClick={() => handleAddElement(tool.type)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors text-left"
            >
              <span className="text-gray-400">{tool.icon}</span>
              {tool.label}
            </button>
          ))}
        </div>

        {/* Element List */}
        <div className="border-t border-gray-700">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <span className="text-xs text-gray-400 font-semibold">Elements ({uiElements.length})</span>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {uiElements.map((el) => (
              <div
                key={el.id}
                className={`flex items-center justify-between px-3 py-1.5 cursor-pointer group ${
                  el.id === selectedId
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => setSelectedId(el.id)}
              >
                <span className="text-xs truncate flex-1">{el.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteUIElement(el.id)
                    if (selectedId === el.id) setSelectedId(null)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {uiElements.length === 0 && (
              <p className="text-gray-500 text-xs px-3 py-2">No elements yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Center Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-gray-400 text-sm">UI Canvas — {CANVAS_W}×{CANVAS_H}</span>
          {selectedEl && (
            <button
              onClick={() => {
                deleteUIElement(selectedEl.id)
                setSelectedId(null)
              }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded text-sm"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center overflow-auto bg-gray-950 p-8">
          <div
            ref={canvasRef}
            style={{ width: DISPLAY_W, height: DISPLAY_H, position: 'relative', cursor: dragging ? 'grabbing' : 'default' }}
            className="bg-gray-700 shadow-2xl border border-gray-600 overflow-hidden select-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelectedId(null)}
          >
            {[...uiElements]
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((el) =>
                el.visible ? (
                  <div
                    key={el.id}
                    style={{
                      position: 'absolute',
                      left: el.x * scaleX,
                      top: el.y * scaleY,
                      width: el.width * scaleX,
                      height: el.height * scaleY,
                      backgroundColor: el.style.backgroundColor,
                      color: el.style.color,
                      fontSize: el.style.fontSize * Math.min(scaleX, scaleY),
                      borderRadius: el.style.borderRadius,
                      border: `${el.style.borderWidth}px solid ${el.style.borderColor}`,
                      opacity: el.style.opacity,
                      cursor: 'grab',
                      outline: el.id === selectedId ? '2px solid #818cf8' : 'none',
                      outlineOffset: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: el.type === 'text' ? 'flex-start' : 'center',
                      padding: '4px 8px',
                      userSelect: 'none',
                    }}
                    onMouseDown={(e) => handleMouseDown(e, el.id)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {el.type === 'progressbar' ? (
                      <div className="w-full h-full flex items-center">
                        <div
                          style={{
                            width: '60%',
                            height: '100%',
                            backgroundColor: el.style.color,
                            borderRadius: el.style.borderRadius,
                          }}
                        />
                      </div>
                    ) : el.type === 'inventoryslot' ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Grid size={16} className="text-gray-500" />
                      </div>
                    ) : (
                      <span className="truncate text-sm">{el.content || el.name}</span>
                    )}
                  </div>
                ) : null
              )}
          </div>
        </div>
      </div>

      {/* Right Panel - Properties */}
      <div className="w-60 bg-gray-800 border-l border-gray-700 flex flex-col">
        <div className="px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold">Properties</span>
        </div>

        {selectedEl ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Name</label>
              <input
                type="text"
                value={selectedEl.name}
                onChange={(e) => updateUIElement(selectedEl.id, { name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Content</label>
              <input
                type="text"
                value={selectedEl.content}
                onChange={(e) => updateUIElement(selectedEl.id, { content: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            {(['x', 'y', 'width', 'height'] as const).map((prop) => (
              <div key={prop}>
                <label className="text-xs text-gray-400 block mb-1 capitalize">{prop}</label>
                <input
                  type="number"
                  value={Math.round(selectedEl[prop])}
                  onChange={(e) =>
                    updateUIElement(selectedEl.id, { [prop]: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}

            <hr className="border-gray-700" />
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Style</span>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Text Color</label>
              <input
                type="color"
                value={selectedEl.style.color}
                onChange={(e) =>
                  updateUIElement(selectedEl.id, { style: { ...selectedEl.style, color: e.target.value } })
                }
                className="w-full h-8 bg-gray-700 border border-gray-600 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Background</label>
              <input
                type="color"
                value={selectedEl.style.backgroundColor === 'transparent' ? '#000000' : selectedEl.style.backgroundColor}
                onChange={(e) =>
                  updateUIElement(selectedEl.id, {
                    style: { ...selectedEl.style, backgroundColor: e.target.value },
                  })
                }
                className="w-full h-8 bg-gray-700 border border-gray-600 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Font Size</label>
              <input
                type="number"
                value={selectedEl.style.fontSize}
                onChange={(e) =>
                  updateUIElement(selectedEl.id, {
                    style: { ...selectedEl.style, fontSize: parseInt(e.target.value) || 14 },
                  })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Border Radius</label>
              <input
                type="number"
                value={selectedEl.style.borderRadius}
                onChange={(e) =>
                  updateUIElement(selectedEl.id, {
                    style: { ...selectedEl.style, borderRadius: parseInt(e.target.value) || 0 },
                  })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Opacity</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selectedEl.style.opacity}
                onChange={(e) =>
                  updateUIElement(selectedEl.id, {
                    style: { ...selectedEl.style, opacity: parseFloat(e.target.value) },
                  })
                }
                className="w-full"
              />
              <span className="text-xs text-gray-500">{(selectedEl.style.opacity * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Visible</label>
              <input
                type="checkbox"
                checked={selectedEl.visible}
                onChange={(e) => updateUIElement(selectedEl.id, { visible: e.target.checked })}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500 text-sm text-center px-4">
              Click an element on the canvas to edit its properties
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
