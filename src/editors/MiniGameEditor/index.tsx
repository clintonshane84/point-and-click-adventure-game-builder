import { useState, useRef } from 'react'
import { Plus, Trash2, Gamepad2, Upload, Copy, Check, BookOpen } from 'lucide-react'
import stonethrowSource from '../../../sdk/stone-throw-minigame.js?raw'
import harpSource       from '../../../sdk/harp-minigame.js?raw'
import exampleSource    from '../../../sdk/example-minigame.js?raw'
import chaseSource      from '../../../sdk/chase-rescue-minigame.js?raw'
import shepherdSource   from '../../../sdk/shepherds-watch-minigame.js?raw'
import { useGameStore } from '../../store/useGameStore'
import type { MiniGame } from '../../types'

const STARTER_SOURCE = `/**
 * Example Mini-Game — "Click the Target"
 * Conforms to the MiniGameModule interface.
 *
 * Replace this with your own Phaser 3 game.
 */

/** @type {import('../../sdk/minigame-sdk').MiniGameModule} */
const module = {
  name: 'Click the Target',
  version: '1.0.0',

  launch(ctx) {
    const { canvas, Phaser, onComplete } = ctx

    const config = {
      type: Phaser.CANVAS,
      canvas,
      width: canvas.width || 800,
      height: canvas.height || 600,
      backgroundColor: '#1a1a2e',
      scene: {
        create() {
          const cx = this.scale.width / 2
          const cy = this.scale.height / 2

          this.add.text(cx, 60, 'Click the Target!', {
            fontSize: '32px', color: '#e2e8f0', fontStyle: 'bold',
          }).setOrigin(0.5)

          const target = this.add.circle(cx, cy, 40, 0xe74c3c)
          target.setInteractive()
          target.on('pointerdown', () => {
            onComplete('win', { score: 1 })
          })

          // 10-second time limit
          this.time.delayedCall(10000, () => {
            onComplete('lose')
          })
        },
      },
    }

    const game = new Phaser.Game(config)

    return {
      destroy() {
        game.destroy(false)
      },
    }
  },
}

export default module
`

const SDK_SNIPPET = `interface MiniGameContext {
  canvas: HTMLCanvasElement
  Phaser: typeof Phaser        // Phaser 3 global
  assets: { id, name, url, type }[]
  variables: Record<string, string|number|boolean>
  onComplete(
    result: 'win'|'lose'|'exit',
    updatedVars?: Record<string, string|number|boolean>
  ): void
}

interface MiniGameInstance { destroy(): void }

interface MiniGameModule {
  name: string
  version: string
  launch(ctx: MiniGameContext): MiniGameInstance
}

// Default export must be a MiniGameModule object:
export default { name, version, launch }
`

const SDK_LIBRARY = [
  { label: 'David vs Goliath — Stone Throw',        source: stonethrowSource },
  { label: 'Harp of David — Heal the King',         source: harpSource },
  { label: 'Chase & Rescue — David and the Lion',   source: chaseSource },
  { label: "Shepherd's Watch — Guard the Flock",    source: shepherdSource },
  { label: 'Example: Click the Target',             source: exampleSource },
]

export function MiniGameEditor() {
  const { project, addMiniGame, updateMiniGame, deleteMiniGame } = useGameStore()
  const miniGames = project.miniGames ?? []

  const [selectedId, setSelectedId] = useState<string | null>(miniGames[0]?.id ?? null)
  const [copied, setCopied] = useState(false)
  const [testActive, setTestActive] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const instanceRef = useRef<{ destroy(): void } | null>(null)

  const selected = miniGames.find((m) => m.id === selectedId) ?? null

  const handleAdd = () => {
    const mg: MiniGame = {
      id: `minigame-${Date.now()}`,
      name: 'New Mini-Game',
      description: '',
      source: STARTER_SOURCE,
    }
    addMiniGame(mg)
    setSelectedId(mg.id)
  }

  const handleAddFromLibrary = (source: string) => {
    setShowLibrary(false)
    const match = source.match(/name:\s*['"`](.+?)['"`]/)
    const mg: MiniGame = {
      id: `minigame-${Date.now()}`,
      name: match?.[1] ?? 'SDK Mini-Game',
      description: '',
      source,
    }
    addMiniGame(mg)
    setSelectedId(mg.id)
  }

  const handleDelete = (id: string) => {
    deleteMiniGame(id)
    setSelectedId(miniGames.find((m) => m.id !== id)?.id ?? null)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selected) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      updateMiniGame(selected.id, { source: text })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleCopySDK = async () => {
    await navigator.clipboard.writeText(SDK_SNIPPET)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const imageAssets = project.assets.filter((a) => a.type === 'image')

  const handleAddSlot = () => {
    if (!selected) return
    const map = { ...(selected.spriteMap ?? {}) }
    const key = `slot${Object.keys(map).length + 1}`
    map[key] = ''
    updateMiniGame(selected.id, { spriteMap: map })
  }

  const handleSlotNameChange = (oldKey: string, newKey: string) => {
    if (!selected) return
    const map = { ...(selected.spriteMap ?? {}) }
    const val = map[oldKey]
    delete map[oldKey]
    map[newKey] = val ?? ''
    updateMiniGame(selected.id, { spriteMap: map })
  }

  const handleSlotAssetChange = (key: string, assetId: string) => {
    if (!selected) return
    updateMiniGame(selected.id, { spriteMap: { ...(selected.spriteMap ?? {}), [key]: assetId } })
  }

  const handleRemoveSlot = (key: string) => {
    if (!selected) return
    const map = { ...(selected.spriteMap ?? {}) }
    delete map[key]
    updateMiniGame(selected.id, { spriteMap: map })
  }

  const handleTestLaunch = async () => {
    if (!selected?.source) return
    setTestActive(true)

    // Lazy-load Phaser
    if (!(window as any).Phaser) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'
        s.onload = () => resolve()
        s.onerror = reject
        document.head.appendChild(s)
      })
    }

    // Blob-import the module
    const blob = new Blob([selected.source], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    let mod: any
    try {
      const imported = await import(/* @vite-ignore */ url)
      mod = imported.default
    } catch (err) {
      console.error('Mini-game load error', err)
      setTestActive(false)
      URL.revokeObjectURL(url)
      return
    }
    URL.revokeObjectURL(url)

    // Create overlay canvas
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;'
    const exitBtn = document.createElement('button')
    exitBtn.textContent = '✕ Exit'
    exitBtn.style.cssText =
      'position:absolute;top:12px;right:16px;z-index:10000;background:rgba(255,255,255,.15);' +
      'color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:14px;'
    overlay.appendChild(exitBtn)

    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    overlay.appendChild(canvas)
    document.body.appendChild(overlay)

    const teardown = () => {
      instanceRef.current?.destroy()
      instanceRef.current = null
      document.body.removeChild(overlay)
      setTestActive(false)
    }

    exitBtn.addEventListener('click', teardown)

    const spriteMap: Record<string, string> = {}
    for (const [slot, assetId] of Object.entries(selected.spriteMap ?? {})) {
      const asset = project.assets.find((a) => a.id === assetId)
      if (asset?.url) spriteMap[slot] = asset.url
    }

    const context = {
      canvas,
      Phaser: (window as any).Phaser,
      assets: project.assets.map((a) => ({ id: a.id, name: a.name, url: a.url, type: a.type })),
      spriteMap,
      variables: {},
      onComplete: (_result: string, _vars?: Record<string, unknown>) => {
        teardown()
      },
    }

    try {
      instanceRef.current = mod.launch(context)
    } catch (err) {
      console.error('Mini-game launch error', err)
      teardown()
    }
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left panel — mini-game list */}
      <div className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="px-3 py-3 border-b border-gray-700 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-200">Mini-Games</span>
          <div className="flex items-center gap-1">
            {/* Library picker */}
            <div
              className="relative"
              tabIndex={-1}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setShowLibrary(false)
                }
              }}
            >
              <button
                onClick={() => setShowLibrary((v) => !v)}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                title="Add from SDK library"
              >
                <BookOpen size={16} />
              </button>
              {showLibrary && (
                <div className="absolute left-0 top-7 z-20 bg-gray-900 border border-gray-700 rounded shadow-lg w-64 py-1">
                  <p className="px-3 py-1 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                    SDK Games
                  </p>
                  {SDK_LIBRARY.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleAddFromLibrary(item.source)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Blank new game */}
            <button
              onClick={handleAdd}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
              title="Add blank mini-game"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {miniGames.length === 0 && (
            <p className="text-gray-500 text-xs px-3 py-3">No mini-games yet. Click + to add one.</p>
          )}
          {miniGames.map((mg) => (
            <div
              key={mg.id}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer group ${
                selectedId === mg.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => setSelectedId(mg.id)}
            >
              <Gamepad2 size={14} className="shrink-0" />
              <span className="flex-1 text-sm truncate">{mg.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(mg.id) }}
                className={`shrink-0 opacity-0 group-hover:opacity-100 ${
                  selectedId === mg.id ? 'text-indigo-200 hover:text-white' : 'text-gray-500 hover:text-red-400'
                }`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Center panel — source editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Gamepad2 size={48} className="text-gray-600 mb-3" />
            <p className="text-gray-400 font-medium">No mini-game selected</p>
            <p className="text-gray-500 text-sm mt-1">Add or select a mini-game from the left panel</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <input
                  value={selected.name}
                  onChange={(e) => updateMiniGame(selected.id, { name: e.target.value })}
                  className="w-full bg-transparent text-gray-100 font-semibold text-base focus:outline-none border-b border-transparent focus:border-indigo-500"
                />
                <input
                  value={selected.description}
                  onChange={(e) => updateMiniGame(selected.id, { description: e.target.value })}
                  placeholder="Description (optional)"
                  className="w-full bg-transparent text-gray-400 text-xs focus:outline-none border-b border-transparent focus:border-indigo-500"
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".js"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs"
              >
                <Upload size={13} /> Upload .js
              </button>
              <button
                onClick={handleTestLaunch}
                disabled={testActive || !selected.source}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs"
              >
                <Gamepad2 size={13} /> Test Launch
              </button>
            </div>

            {/* Sprite Slots */}
            <div className="px-4 py-2 bg-gray-850 border-b border-gray-700">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sprite Slots</span>
                <button
                  onClick={handleAddSlot}
                  className="text-xs text-indigo-400 hover:text-indigo-200"
                >
                  + Add slot
                </button>
              </div>
              {Object.entries(selected.spriteMap ?? {}).map(([slot, assetId]) => (
                <div key={slot} className="flex items-center gap-2 mb-1">
                  <input
                    value={slot}
                    onChange={(e) => handleSlotNameChange(slot, e.target.value)}
                    placeholder="slot name"
                    className="w-24 bg-gray-900 text-gray-200 text-xs px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-indigo-500"
                  />
                  <select
                    value={assetId}
                    onChange={(e) => handleSlotAssetChange(slot, e.target.value)}
                    className="flex-1 bg-gray-900 text-gray-200 text-xs px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— no image —</option>
                    {imageAssets.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemoveSlot(slot)}
                    className="text-gray-500 hover:text-red-400 text-base leading-none shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
              {Object.keys(selected.spriteMap ?? {}).length === 0 && (
                <p className="text-xs text-gray-600">No sprite slots. Click "+ Add slot" to assign images to character names.</p>
              )}
            </div>

            {/* Source textarea */}
            <div className="flex-1 overflow-hidden p-3">
              <textarea
                value={selected.source}
                onChange={(e) => updateMiniGame(selected.id, { source: e.target.value })}
                spellCheck={false}
                className="w-full h-full bg-gray-950 text-gray-200 font-mono text-xs p-3 rounded border border-gray-700 focus:outline-none focus:border-indigo-500 resize-none"
                style={{ tabSize: 2 }}
              />
            </div>
          </>
        )}
      </div>

      {/* Right panel — SDK reference */}
      <div className="w-64 bg-gray-800 border-l border-gray-700 flex flex-col overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-gray-200">SDK Contract</h3>
        </div>
        <div className="p-4 space-y-4 text-xs text-gray-400">
          <p>Your module must have a <span className="text-indigo-300 font-mono">default</span> export that is a <span className="text-indigo-300 font-mono">MiniGameModule</span> object:</p>
          <pre className="bg-gray-900 rounded p-3 text-gray-300 whitespace-pre-wrap overflow-x-auto leading-relaxed">
            {SDK_SNIPPET}
          </pre>
          <p className="text-gray-500">After the game ends, call <span className="text-indigo-300 font-mono">onComplete</span> with <span className="text-gray-300">'win'</span>, <span className="text-gray-300">'lose'</span>, or <span className="text-gray-300">'exit'</span>. The runtime sets the variable <span className="text-indigo-300 font-mono">minigame_result</span> automatically.</p>
          <p className="text-gray-500">Phaser 3.80.1 is provided via <span className="text-indigo-300 font-mono">ctx.Phaser</span>. Pass <span className="text-indigo-300 font-mono">ctx.canvas</span> to Phaser's config so it renders inside the builder overlay.</p>
          <button
            onClick={handleCopySDK}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded w-full justify-center"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy SDK Types'}
          </button>
        </div>
      </div>
    </div>
  )
}
