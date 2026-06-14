import { useState, useRef } from 'react'
import { Upload, MousePointer2, Crosshair } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { CursorStateName } from '../../types'

const CURSOR_STATES: { id: CursorStateName; label: string; description: string }[] = [
  { id: 'default', label: 'Default', description: 'Normal cursor state' },
  { id: 'hover', label: 'Hover', description: 'When hovering over interactive objects' },
  { id: 'interact', label: 'Interact', description: 'When interacting / during action' },
]

export function CursorEditor() {
  const { project, updateCursorState } = useGameStore()
  const { cursorConfig } = project

  const [activeState, setActiveState] = useState<CursorStateName>('default')
  const [previewPos, setPreviewPos] = useState({ x: 160, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const [settingHotspot, setSettingHotspot] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentStateConfig = cursorConfig.states[activeState]

  const handleUploadCursor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result as string
      updateCursorState(activeState, { imageUrl: url })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleHotspotClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!settingHotspot) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(e.clientX - rect.left)
    const y = Math.round(e.clientY - rect.top)
    updateCursorState(activeState, { hotspotX: x, hotspotY: y })
    setSettingHotspot(false)
  }

  const handlePreviewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    setPreviewPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left: Cursor States List */}
      <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
          <MousePointer2 size={16} className="text-indigo-400" />
          <span className="text-gray-300 text-sm font-semibold">Cursor States</span>
        </div>
        <div className="flex-1 py-2 space-y-1 px-2">
          {CURSOR_STATES.map((state) => {
            const stateConfig = cursorConfig.states[state.id]
            const hasImage = !!stateConfig.imageUrl
            return (
              <div
                key={state.id}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer ${
                  activeState === state.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => setActiveState(state.id)}
              >
                <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center overflow-hidden shrink-0">
                  {hasImage ? (
                    <img src={stateConfig.imageUrl} alt={state.label} className="max-w-full max-h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <MousePointer2 size={14} className="text-gray-500" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium">{state.label}</div>
                  <div className={`text-xs ${activeState === state.id ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {hasImage ? `${stateConfig.hotspotX},${stateConfig.hotspotY}` : 'No image'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Center: Cursor Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-gray-200 font-medium capitalize">{activeState} Cursor</span>
          <div className="flex-1" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm"
          >
            <Upload size={14} /> Upload Image
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,.cur,.ani" onChange={handleUploadCursor} className="hidden" />
        </div>

        <div className="flex-1 flex gap-6 p-6 overflow-auto">
          {/* Cursor Image / Hotspot Editor */}
          <div className="flex-1 space-y-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
              <h3 className="text-gray-200 font-semibold">Cursor Image</h3>

              {currentStateConfig.imageUrl ? (
                <div className="space-y-4">
                  <div
                    className="relative border border-gray-600 rounded-lg overflow-hidden cursor-crosshair bg-gray-900 flex items-center justify-center"
                    style={{ minHeight: 200 }}
                    onClick={handleHotspotClick}
                  >
                    <img
                      src={currentStateConfig.imageUrl}
                      alt={`${activeState} cursor`}
                      style={{ imageRendering: 'pixelated', maxWidth: '100%', maxHeight: 300 }}
                    />
                    {/* Hotspot marker */}
                    <div
                      style={{
                        position: 'absolute',
                        left: currentStateConfig.hotspotX,
                        top: currentStateConfig.hotspotY,
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                      }}
                    >
                      <Crosshair size={16} className="text-red-400" />
                    </div>
                    {settingHotspot && (
                      <div className="absolute inset-0 border-2 border-dashed border-indigo-500 flex items-center justify-center bg-indigo-900 bg-opacity-20">
                        <span className="text-indigo-300 text-sm font-medium">Click to set hotspot</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Hotspot X</label>
                      <input
                        type="number"
                        value={currentStateConfig.hotspotX}
                        onChange={(e) =>
                          updateCursorState(activeState, { hotspotX: parseInt(e.target.value) || 0 })
                        }
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Hotspot Y</label>
                      <input
                        type="number"
                        value={currentStateConfig.hotspotY}
                        onChange={(e) =>
                          updateCursorState(activeState, { hotspotY: parseInt(e.target.value) || 0 })
                        }
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setSettingHotspot(!settingHotspot)}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded text-sm font-medium ${
                      settingHotspot
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    <Crosshair size={14} />
                    {settingHotspot ? 'Click on image to set hotspot' : 'Set Hotspot by Clicking'}
                  </button>

                  <button
                    onClick={() => updateCursorState(activeState, { imageUrl: undefined, hotspotX: 0, hotspotY: 0 })}
                    className="w-full py-2 rounded text-sm text-red-400 hover:text-red-300 hover:bg-gray-700"
                  >
                    Remove Image
                  </button>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg py-12 cursor-pointer hover:border-indigo-500 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={32} className="text-gray-500 mb-3" />
                  <p className="text-gray-400 text-sm font-medium">Upload cursor image</p>
                  <p className="text-gray-500 text-xs mt-1">PNG, GIF, .cur files supported</p>
                </div>
              )}
            </div>
          </div>

          {/* Live Preview */}
          <div className="w-72 space-y-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
              <h3 className="text-gray-200 font-semibold">Live Preview</h3>
              <p className="text-gray-400 text-xs">Move your mouse in the preview area below</p>

              <div
                ref={previewRef}
                className="relative h-48 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg border border-gray-600 overflow-hidden"
                style={{ cursor: 'none' }}
                onMouseMove={handlePreviewMouseMove}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
              >
                {/* Fake game background elements */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-10 bg-indigo-800 rounded opacity-60" />
                  <div className="w-10 h-16 bg-purple-800 rounded opacity-40 ml-8" />
                </div>

                {/* Custom cursor */}
                <div
                  style={{
                    position: 'absolute',
                    left: previewPos.x - (currentStateConfig.hotspotX || 0),
                    top: previewPos.y - (currentStateConfig.hotspotY || 0),
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  {currentStateConfig.imageUrl ? (
                    <img
                      src={currentStateConfig.imageUrl}
                      alt="cursor"
                      style={{ display: 'block', imageRendering: 'pixelated', maxWidth: 48, maxHeight: 48 }}
                    />
                  ) : (
                    <MousePointer2 size={24} className="text-white drop-shadow" />
                  )}
                </div>

                {/* State indicator */}
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                  {isDragging ? 'interact' : 'default'} state
                </div>
              </div>

              {/* State switcher in preview */}
              <div className="flex gap-2">
                {CURSOR_STATES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveState(s.id)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium ${
                      activeState === s.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* All States Summary */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
              <h3 className="text-gray-200 text-sm font-semibold">All States</h3>
              {CURSOR_STATES.map((state) => {
                const cfg = cursorConfig.states[state.id]
                return (
                  <div key={state.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-900 border border-gray-700 rounded flex items-center justify-center overflow-hidden shrink-0">
                      {cfg.imageUrl ? (
                        <img src={cfg.imageUrl} alt={state.label} style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated' }} />
                      ) : (
                        <MousePointer2 size={14} className="text-gray-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-gray-300 text-sm">{state.label}</div>
                      <div className="text-gray-500 text-xs">
                        {cfg.imageUrl
                          ? `Hotspot: (${cfg.hotspotX}, ${cfg.hotspotY})`
                          : 'No image set'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
