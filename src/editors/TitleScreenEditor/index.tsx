import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Monitor } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { TitleScreenButton } from '../../types'

export function TitleScreenEditor() {
  const { project, updateTitleScreen, addTitleScreenButton, updateTitleScreenButton, deleteTitleScreenButton, reorderTitleScreenButtons } =
    useGameStore()
  const { titleScreen } = project

  const [selectedBtnId, setSelectedBtnId] = useState<string | null>(null)
  const [newBtnLabel, setNewBtnLabel] = useState('')

  const selectedBtn = titleScreen.buttons.find((b) => b.id === selectedBtnId) ?? null

  const handleAddButton = () => {
    const label = newBtnLabel.trim() || `Button ${titleScreen.buttons.length + 1}`
    const btn: TitleScreenButton = {
      id: `btn-${Date.now()}`,
      label,
      action: 'custom',
      order: titleScreen.buttons.length,
    }
    addTitleScreenButton(btn)
    setNewBtnLabel('')
    setSelectedBtnId(btn.id)
  }

  const moveButton = (id: string, dir: -1 | 1) => {
    const sorted = [...titleScreen.buttons].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((b) => b.id === id)
    if (idx < 0) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= sorted.length) return
    const reordered = [...sorted]
    ;[reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]]
    reorderTitleScreenButtons(
      reordered.map((b, i) => ({ ...b, order: i }))
    )
  }

  const sortedButtons = [...titleScreen.buttons].sort((a, b) => a.order - b.order)

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left: Properties */}
      <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
          <Monitor size={18} className="text-indigo-400" />
          <span className="text-gray-200 font-semibold">Title Screen Settings</span>
        </div>

        <div className="p-4 space-y-4 flex-1">
          {/* Background */}
          <section className="space-y-3">
            <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Background</h3>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Background Color</label>
              <input
                type="color"
                value={titleScreen.backgroundColor}
                onChange={(e) => updateTitleScreen({ backgroundColor: e.target.value })}
                className="w-full h-9 bg-gray-700 border border-gray-600 rounded cursor-pointer"
              />
            </div>
          </section>

          <hr className="border-gray-700" />

          {/* Title Text */}
          <section className="space-y-3">
            <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Title</h3>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Title Text</label>
              <input
                type="text"
                value={titleScreen.titleText}
                onChange={(e) => updateTitleScreen({ titleText: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Title Color</label>
              <input
                type="color"
                value={titleScreen.titleColor}
                onChange={(e) => updateTitleScreen({ titleColor: e.target.value })}
                className="w-full h-9 bg-gray-700 border border-gray-600 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Title Font Size</label>
              <input
                type="number"
                min={16}
                max={120}
                value={titleScreen.titleFontSize}
                onChange={(e) => updateTitleScreen({ titleFontSize: parseInt(e.target.value) || 48 })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </section>

          <hr className="border-gray-700" />

          {/* Subtitle */}
          <section className="space-y-3">
            <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Subtitle</h3>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Subtitle Text</label>
              <input
                type="text"
                value={titleScreen.subtitleText}
                onChange={(e) => updateTitleScreen({ subtitleText: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Subtitle Color</label>
              <input
                type="color"
                value={titleScreen.subtitleColor}
                onChange={(e) => updateTitleScreen({ subtitleColor: e.target.value })}
                className="w-full h-9 bg-gray-700 border border-gray-600 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Subtitle Font Size</label>
              <input
                type="number"
                min={10}
                max={60}
                value={titleScreen.subtitleFontSize}
                onChange={(e) => updateTitleScreen({ subtitleFontSize: parseInt(e.target.value) || 20 })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </section>

          <hr className="border-gray-700" />

          {/* Menu Buttons */}
          <section className="space-y-3">
            <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Menu Buttons</h3>

            <div className="space-y-1">
              {sortedButtons.map((btn, idx) => (
                <div
                  key={btn.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer ${
                    selectedBtnId === btn.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-650'
                  }`}
                  onClick={() => setSelectedBtnId(btn.id === selectedBtnId ? null : btn.id)}
                >
                  <span className="flex-1 text-sm truncate">{btn.label}</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveButton(btn.id, -1) }}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-gray-600 disabled:opacity-30"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveButton(btn.id, 1) }}
                      disabled={idx === sortedButtons.length - 1}
                      className="p-0.5 rounded hover:bg-gray-600 disabled:opacity-30"
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteTitleScreenButton(btn.id)
                        if (selectedBtnId === btn.id) setSelectedBtnId(null)
                      }}
                      className="p-0.5 rounded hover:bg-red-600"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Button */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Button label..."
                value={newBtnLabel}
                onChange={(e) => setNewBtnLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddButton()}
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleAddButton}
                className="p-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Selected Button Properties */}
            {selectedBtn && (
              <div className="bg-gray-700 rounded-lg p-3 space-y-2 mt-2">
                <p className="text-xs text-gray-400 font-semibold">Edit Button</p>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Label</label>
                  <input
                    type="text"
                    value={selectedBtn.label}
                    onChange={(e) => updateTitleScreenButton(selectedBtn.id, { label: e.target.value })}
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Action</label>
                  <select
                    value={selectedBtn.action}
                    onChange={(e) => updateTitleScreenButton(selectedBtn.id, { action: e.target.value })}
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="new_game">New Game</option>
                    <option value="load_game">Load Game</option>
                    <option value="settings">Settings</option>
                    <option value="quit">Quit</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-gray-400 text-sm">Preview</span>
        </div>
        <div className="flex-1 flex items-center justify-center overflow-auto bg-gray-950 p-8">
          <div
            style={{
              width: 640,
              height: 360,
              backgroundColor: titleScreen.backgroundColor,
              backgroundImage: titleScreen.backgroundImageUrl
                ? `url(${titleScreen.backgroundImageUrl})`
                : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            className="shadow-2xl border border-gray-600"
          >
            {/* Title */}
            <div
              style={{
                fontSize: titleScreen.titleFontSize * 0.5,
                color: titleScreen.titleColor,
                fontWeight: 'bold',
                textAlign: 'center',
                textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                marginBottom: 4,
              }}
            >
              {titleScreen.titleText}
            </div>

            {/* Subtitle */}
            <div
              style={{
                fontSize: titleScreen.subtitleFontSize * 0.5,
                color: titleScreen.subtitleColor,
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              {titleScreen.subtitleText}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {sortedButtons.map((btn) => (
                <div
                  key={btn.id}
                  style={{
                    padding: '8px 32px',
                    background: 'rgba(255,255,255,0.1)',
                    border: `1px solid ${selectedBtnId === btn.id ? '#818cf8' : 'rgba(255,255,255,0.3)'}`,
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 13,
                    cursor: 'pointer',
                    minWidth: 160,
                    textAlign: 'center',
                    backdropFilter: 'blur(4px)',
                    outline: selectedBtnId === btn.id ? '2px solid #6366f1' : 'none',
                    outlineOffset: 2,
                  }}
                >
                  {btn.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
