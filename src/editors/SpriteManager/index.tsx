import { useState, useRef, useEffect } from 'react'
import { Upload, Plus, Trash2, Play, Pause, Film } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { SpriteSheet, Animation } from '../../types'

export function SpriteManager() {
  const { project, addSpriteSheet, updateSpriteSheet, deleteSpriteSheet, addAnimation, updateAnimation, deleteAnimation } =
    useGameStore()
  const { spriteSheets } = project

  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(spriteSheets[0]?.id ?? null)
  const [playingAnimId, setPlayingAnimId] = useState<string | null>(null)
  const [currentFrame, setCurrentFrame] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [newAnimForm, setNewAnimForm] = useState({ name: '', startFrame: 0, endFrame: 0, fps: 8, loop: true })
  const [showAnimForm, setShowAnimForm] = useState(false)

  const selectedSheet = spriteSheets.find((s) => s.id === selectedSheetId)

  // Animation playback
  useEffect(() => {
    if (!playingAnimId || !selectedSheet) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    const anim = selectedSheet.animations.find((a) => a.id === playingAnimId)
    if (!anim) return
    setCurrentFrame(anim.startFrame)
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setCurrentFrame((prev) => {
        const next = prev + 1
        if (next > anim.endFrame) {
          if (anim.loop) return anim.startFrame
          clearInterval(intervalRef.current!)
          setPlayingAnimId(null)
          return anim.startFrame
        }
        return next
      })
    }, 1000 / anim.fps)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playingAnimId, selectedSheet])

  const handleImportSheet = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result as string
      const img = new window.Image()
      img.onload = () => {
        const rows = 4
        const cols = 4
        const frameWidth = Math.floor(img.width / cols)
        const frameHeight = Math.floor(img.height / rows)
        const id = `sheet-${Date.now()}`
        const sheet: SpriteSheet = {
          id,
          name: file.name.replace(/\.[^.]+$/, ''),
          imageUrl: url,
          imageWidth: img.width,
          imageHeight: img.height,
          rows,
          cols,
          frameWidth,
          frameHeight,
          frames: Array.from({ length: rows * cols }, (_, i) => ({
            id: `frame-${i}`,
            row: Math.floor(i / cols),
            col: i % cols,
            x: (i % cols) * frameWidth,
            y: Math.floor(i / cols) * frameHeight,
            width: frameWidth,
            height: frameHeight,
          })),
          animations: [],
        }
        addSpriteSheet(sheet)
        setSelectedSheetId(id)
      }
      img.src = url
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleAddAnimation = () => {
    if (!selectedSheet) return
    const anim: Animation = {
      id: `anim-${Date.now()}`,
      name: newAnimForm.name || `Animation ${selectedSheet.animations.length + 1}`,
      startFrame: newAnimForm.startFrame,
      endFrame: Math.min(newAnimForm.endFrame, selectedSheet.rows * selectedSheet.cols - 1),
      fps: newAnimForm.fps,
      loop: newAnimForm.loop,
    }
    addAnimation(selectedSheet.id, anim)
    setShowAnimForm(false)
    setNewAnimForm({ name: '', startFrame: 0, endFrame: 3, fps: 8, loop: true })
  }

  const getFrameStyle = (sheet: SpriteSheet, frameIdx: number) => {
    const col = frameIdx % sheet.cols
    const row = Math.floor(frameIdx / sheet.cols)
    const scale = 120 / Math.max(sheet.frameWidth, sheet.frameHeight)
    return {
      width: sheet.frameWidth * scale,
      height: sheet.frameHeight * scale,
      backgroundImage: `url(${sheet.imageUrl})`,
      backgroundPosition: `-${col * sheet.frameWidth * scale}px -${row * sheet.frameHeight * scale}px`,
      backgroundSize: `${sheet.imageWidth * scale}px ${sheet.imageHeight * scale}px`,
      backgroundRepeat: 'no-repeat',
      imageRendering: 'pixelated' as const,
    }
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left: Sprite Sheet Library */}
      <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold">Sprite Sheets</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
            title="Import Sprite Sheet"
          >
            <Upload size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImportSheet}
            className="hidden"
          />
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {spriteSheets.map((sheet) => (
            <div
              key={sheet.id}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer group ${
                sheet.id === selectedSheetId
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => setSelectedSheetId(sheet.id)}
            >
              <span className="text-sm truncate flex-1">{sheet.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteSpriteSheet(sheet.id)
                  if (selectedSheetId === sheet.id) setSelectedSheetId(spriteSheets.find(s => s.id !== sheet.id)?.id ?? null)
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {spriteSheets.length === 0 && (
            <div
              className="flex flex-col items-center justify-center h-32 text-center px-4 cursor-pointer hover:bg-gray-750"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={24} className="text-gray-600 mb-2" />
              <p className="text-gray-500 text-xs">Import a sprite sheet to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Center: Sheet editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSheet ? (
          <>
            {/* Frame grid config */}
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 border-b border-gray-700">
              <span className="text-gray-300 text-sm font-semibold">{selectedSheet.name}</span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Rows</label>
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={selectedSheet.rows}
                  onChange={(e) => {
                    const rows = parseInt(e.target.value) || 1
                    updateSpriteSheet(selectedSheet.id, {
                      rows,
                      frameHeight: Math.floor(selectedSheet.imageHeight / rows),
                    })
                  }}
                  className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Cols</label>
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={selectedSheet.cols}
                  onChange={(e) => {
                    const cols = parseInt(e.target.value) || 1
                    updateSpriteSheet(selectedSheet.id, {
                      cols,
                      frameWidth: Math.floor(selectedSheet.imageWidth / cols),
                    })
                  }}
                  className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-xs text-gray-500">
                {selectedSheet.rows * selectedSheet.cols} frames ({selectedSheet.frameWidth}×{selectedSheet.frameHeight}px each)
              </span>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Sheet preview with grid */}
              <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
                <div className="relative border border-gray-600">
                  <img
                    src={selectedSheet.imageUrl}
                    alt={selectedSheet.name}
                    style={{ display: 'block', maxWidth: 600, imageRendering: 'pixelated' }}
                  />
                  {/* Grid overlay */}
                  <svg
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                    viewBox={`0 0 ${selectedSheet.imageWidth} ${selectedSheet.imageHeight}`}
                    preserveAspectRatio="none"
                  >
                    {Array.from({ length: selectedSheet.cols + 1 }, (_, i) => (
                      <line
                        key={`v${i}`}
                        x1={i * selectedSheet.frameWidth}
                        y1={0}
                        x2={i * selectedSheet.frameWidth}
                        y2={selectedSheet.imageHeight}
                        stroke="#6366f1"
                        strokeWidth={1}
                        opacity={0.6}
                      />
                    ))}
                    {Array.from({ length: selectedSheet.rows + 1 }, (_, i) => (
                      <line
                        key={`h${i}`}
                        x1={0}
                        y1={i * selectedSheet.frameHeight}
                        x2={selectedSheet.imageWidth}
                        y2={i * selectedSheet.frameHeight}
                        stroke="#6366f1"
                        strokeWidth={1}
                        opacity={0.6}
                      />
                    ))}
                    {Array.from({ length: selectedSheet.rows * selectedSheet.cols }, (_, i) => {
                      const col = i % selectedSheet.cols
                      const row = Math.floor(i / selectedSheet.cols)
                      return (
                        <text
                          key={`n${i}`}
                          x={col * selectedSheet.frameWidth + 3}
                          y={row * selectedSheet.frameHeight + 12}
                          fontSize={10}
                          fill="#818cf8"
                          opacity={0.8}
                        >
                          {i}
                        </text>
                      )
                    })}
                  </svg>
                </div>
              </div>

              {/* Right: Animations */}
              <div className="w-64 border-l border-gray-700 flex flex-col bg-gray-800">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                  <span className="text-gray-300 text-sm font-semibold">Animations</span>
                  <button
                    onClick={() => setShowAnimForm(true)}
                    className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {selectedSheet.animations.map((anim) => {
                    const isPlaying = playingAnimId === anim.id
                    return (
                      <div key={anim.id} className="bg-gray-750 bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-200 text-sm font-medium">{anim.name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (isPlaying) {
                                  setPlayingAnimId(null)
                                } else {
                                  setPlayingAnimId(anim.id)
                                }
                              }}
                              className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                            >
                              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                            </button>
                            <button
                              onClick={() => {
                                if (isPlaying) setPlayingAnimId(null)
                                deleteAnimation(selectedSheet.id, anim.id)
                              }}
                              className="p-1 rounded hover:bg-red-600 text-gray-400 hover:text-white"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          Frames {anim.startFrame}–{anim.endFrame} · {anim.fps} FPS · {anim.loop ? 'Loop' : 'Once'}
                        </div>

                        {/* Preview */}
                        {isPlaying && (
                          <div className="flex justify-center pt-1">
                            <div style={getFrameStyle(selectedSheet, currentFrame)} className="border border-gray-600" />
                          </div>
                        )}

                        {/* Inline edit */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-xs text-gray-500">Start</label>
                            <input
                              type="number"
                              min={0}
                              value={anim.startFrame}
                              onChange={(e) => updateAnimation(selectedSheet.id, anim.id, { startFrame: parseInt(e.target.value) || 0 })}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">End</label>
                            <input
                              type="number"
                              min={0}
                              value={anim.endFrame}
                              onChange={(e) => updateAnimation(selectedSheet.id, anim.id, { endFrame: parseInt(e.target.value) || 0 })}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">FPS</label>
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={anim.fps}
                              onChange={(e) => updateAnimation(selectedSheet.id, anim.id, { fps: parseInt(e.target.value) || 8 })}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="flex items-end gap-2 pb-0.5">
                            <label className="text-xs text-gray-500">Loop</label>
                            <input
                              type="checkbox"
                              checked={anim.loop}
                              onChange={(e) => updateAnimation(selectedSheet.id, anim.id, { loop: e.target.checked })}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {selectedSheet.animations.length === 0 && (
                    <p className="text-gray-500 text-xs text-center py-4">No animations. Click + to create one.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <Film size={64} className="text-gray-600 mb-4" />
            <p className="text-gray-400 font-medium text-lg">No sprite sheet selected</p>
            <p className="text-gray-500 text-sm mt-2">Import a sprite sheet from the panel on the left</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm"
            >
              <Upload size={16} /> Import Sprite Sheet
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImportSheet} className="hidden" />
          </div>
        )}
      </div>

      {/* Add Animation Modal */}
      {showAnimForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-xl w-96 p-6 space-y-4">
            <h3 className="text-gray-100 font-semibold">Add Animation</h3>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Name</label>
              <input
                type="text"
                placeholder="e.g. Walk, Run, Idle"
                value={newAnimForm.name}
                onChange={(e) => setNewAnimForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Start Frame</label>
                <input
                  type="number"
                  min={0}
                  value={newAnimForm.startFrame}
                  onChange={(e) => setNewAnimForm((f) => ({ ...f, startFrame: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">End Frame</label>
                <input
                  type="number"
                  min={0}
                  value={newAnimForm.endFrame}
                  onChange={(e) => setNewAnimForm((f) => ({ ...f, endFrame: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">FPS</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={newAnimForm.fps}
                  onChange={(e) => setNewAnimForm((f) => ({ ...f, fps: parseInt(e.target.value) || 8 }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-end gap-3 pb-2">
                <label className="text-xs text-gray-400">Loop</label>
                <input
                  type="checkbox"
                  checked={newAnimForm.loop}
                  onChange={(e) => setNewAnimForm((f) => ({ ...f, loop: e.target.checked }))}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAnimForm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAnimation}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
              >
                Add Animation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
