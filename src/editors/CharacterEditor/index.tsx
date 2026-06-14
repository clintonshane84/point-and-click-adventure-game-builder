import React, { useState } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, User, X, Plus, Trash2, Crown } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { FacingDirection, CharacterAnimation, MainCharacter, NpcCharacter, SpriteSheet } from '../../types'

type AnyCharacter = MainCharacter | NpcCharacter

const DIRECTIONS: { dir: FacingDirection; label: string; icon: React.ReactNode }[] = [
  { dir: 'up',    label: 'Walk Up',    icon: <ArrowUp size={14} /> },
  { dir: 'down',  label: 'Walk Down',  icon: <ArrowDown size={14} /> },
  { dir: 'left',  label: 'Walk Left',  icon: <ArrowLeft size={14} /> },
  { dir: 'right', label: 'Walk Right', icon: <ArrowRight size={14} /> },
]

const FACING_OPTIONS: FacingDirection[] = ['up', 'down', 'left', 'right']

function AnimationSlot({
  label, icon, current, spriteSheets, onSet, onClear,
}: {
  direction: FacingDirection
  label: string
  icon: React.ReactNode
  current: CharacterAnimation | null
  spriteSheets: SpriteSheet[]
  onSet: (anim: CharacterAnimation | null) => void
  onClear: () => void
}) {
  const selectedSheet = spriteSheets.find((s) => s.id === current?.spriteSheetId)
  const availableAnims = selectedSheet?.animations ?? []

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
        <span className="text-indigo-400">{icon}</span>
        {label}
        {current && (
          <button
            onClick={onClear}
            className="ml-auto p-0.5 rounded hover:bg-red-700/40 text-gray-500 hover:text-red-400"
            title="Clear animation"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Sprite Sheet</label>
        {spriteSheets.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No sprite sheets yet — add one in the Sprites editor.</p>
        ) : (
          <select
            value={current?.spriteSheetId ?? ''}
            onChange={(e) => {
              const sheetId = e.target.value
              if (!sheetId) { onSet(null); return }
              onSet({ spriteSheetId: sheetId, animationId: '' })
            }}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="">— none —</option>
            {spriteSheets.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {selectedSheet && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Animation</label>
          {selectedSheet.animations.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No animations defined on this sheet.</p>
          ) : (
            <select
              value={current?.animationId ?? ''}
              onChange={(e) => {
                if (!current?.spriteSheetId) return
                onSet({ spriteSheetId: current.spriteSheetId, animationId: e.target.value })
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— select animation —</option>
              {availableAnims.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className={`text-xs rounded px-2 py-1 ${
        current?.animationId
          ? 'bg-green-900/30 text-green-400 border border-green-700/40'
          : 'bg-gray-800 text-gray-500'
      }`}>
        {current?.animationId
          ? `${selectedSheet?.name ?? '?'} / ${availableAnims.find((a) => a.id === current.animationId)?.name ?? current.animationId}`
          : 'Not assigned'}
      </div>
    </div>
  )
}

export function CharacterEditor() {
  const {
    project,
    updateMainCharacter, setCharacterAnimation,
    addNpc, updateNpc, deleteNpc, setNpcAnimation,
  } = useGameStore()
  const { mainCharacter, spriteSheets } = project
  const npcs = project.npcs ?? []

  const [selectedId, setSelectedId] = useState<string>('main-character')

  const isMain = selectedId === 'main-character'
  const selectedNpc = isMain ? null : npcs.find((n) => n.id === selectedId) ?? null
  const char: AnyCharacter = isMain ? mainCharacter : (selectedNpc ?? mainCharacter)

  function updateChar(updates: Partial<AnyCharacter>) {
    if (isMain) updateMainCharacter(updates as Partial<MainCharacter>)
    else if (selectedNpc) updateNpc(selectedNpc.id, updates as Partial<NpcCharacter>)
  }

  function setAnim(dir: FacingDirection, anim: CharacterAnimation | null) {
    if (isMain) setCharacterAnimation(dir, anim)
    else if (selectedNpc) setNpcAnimation(selectedNpc.id, dir, anim)
  }

  function handleAddNpc() {
    const npc: NpcCharacter = {
      id: `npc-${Date.now()}`,
      name: `NPC ${npcs.length + 1}`,
      description: '',
      width: 64,
      height: 96,
      defaultFacing: 'down',
      animations: { up: null, down: null, left: null, right: null },
    }
    addNpc(npc)
    setSelectedId(npc.id)
  }

  return (
    <div className="flex h-full bg-gray-900">

      {/* ── Left: character list ─────────────────────────────────────────────── */}
      <div className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold">Characters</span>
          <button
            onClick={handleAddNpc}
            className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
            title="Add NPC"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {/* Main character — always first, non-deletable */}
          <div
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
              isMain ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
            onClick={() => setSelectedId('main-character')}
          >
            <Crown size={12} className={isMain ? 'text-yellow-300 shrink-0' : 'text-yellow-500 shrink-0'} />
            <span className="text-sm truncate flex-1">{mainCharacter.name || 'Player'}</span>
          </div>

          {/* NPCs */}
          {npcs.map((npc) => (
            <div
              key={npc.id}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer group ${
                selectedId === npc.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => setSelectedId(npc.id)}
            >
              <User size={12} className={`shrink-0 ${selectedId === npc.id ? 'text-indigo-300' : 'text-gray-500'}`} />
              <span className="text-sm truncate flex-1">{npc.name || 'NPC'}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteNpc(npc.id)
                  if (selectedId === npc.id) setSelectedId('main-character')
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-600 text-gray-400 hover:text-white shrink-0"
                title="Delete NPC"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          {npcs.length === 0 && (
            <p className="text-xs text-gray-600 px-3 py-3 leading-relaxed">
              No NPCs yet.<br />Click + to add one.
            </p>
          )}
        </div>

        <div className="p-3 border-t border-gray-700 text-xs text-gray-600 leading-relaxed">
          <Crown size={10} className="inline text-yellow-600 mr-1" />Player-controlled<br />
          <User size={10} className="inline mr-1" />NPC — place via Scene Editor
        </div>
      </div>

      {/* ── Center: properties ───────────────────────────────────────────────── */}
      <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-gray-200 text-sm font-semibold flex items-center gap-2">
            {isMain
              ? <><Crown size={14} className="text-yellow-500" />{mainCharacter.name || 'Player'}</>
              : <><User size={14} className="text-indigo-400" />{char.name || 'NPC'}</>
            }
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {isMain ? 'Player-controlled character' : 'Non-player character (NPC)'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Name</label>
            <input
              type="text"
              value={char.name}
              onChange={(e) => updateChar({ name: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Description</label>
            <textarea
              value={char.description}
              onChange={(e) => updateChar({ description: e.target.value })}
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="Optional..."
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Sprite Size (px)</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Width</label>
                <input
                  type="number" min={8} max={512}
                  value={char.width}
                  onChange={(e) => updateChar({ width: parseInt(e.target.value) || 64 })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Height</label>
                <input
                  type="number" min={8} max={512}
                  value={char.height}
                  onChange={(e) => updateChar({ height: parseInt(e.target.value) || 96 })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Default Facing</label>
            <select
              value={char.defaultFacing}
              onChange={(e) => updateChar({ defaultFacing: e.target.value as FacingDirection })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              {FACING_OPTIONS.map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="border border-gray-700 rounded-lg p-3 bg-gray-900/40">
            <p className="text-xs text-gray-500 mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div
                className="rounded border border-indigo-700/50 bg-indigo-900/20 flex items-center justify-center text-indigo-300 shrink-0"
                style={{ width: Math.min(char.width, 64), height: Math.min(char.height, 96) }}
              >
                {isMain ? <Crown size={16} className="text-yellow-400" /> : <User size={16} />}
              </div>
              <div className="text-xs text-gray-400 space-y-0.5">
                <p className="text-gray-200 font-medium">{char.name || 'Unnamed'}</p>
                <p>{char.width} × {char.height} px</p>
                <p>Facing: {char.defaultFacing}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: animations ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-gray-200 text-base font-semibold mb-1">Walking Animations</h3>
          <p className="text-gray-500 text-sm mb-5">
            {isMain
              ? 'Assign a sprite sheet animation for each walking direction. These play while the character moves.'
              : 'Assign animations for this NPC. The default-facing animation is shown when the NPC is placed in a scene.'}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {DIRECTIONS.map(({ dir, label, icon }) => (
              <AnimationSlot
                key={`${selectedId}-${dir}`}
                direction={dir}
                label={label}
                icon={icon}
                current={char.animations[dir]}
                spriteSheets={spriteSheets}
                onSet={(anim) => setAnim(dir, anim)}
                onClear={() => setAnim(dir, null)}
              />
            ))}
          </div>

          <div className="mt-6 border border-gray-700 rounded-lg p-4 bg-gray-800/40">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Animation Summary</p>
            <div className="space-y-1.5">
              {DIRECTIONS.map(({ dir, label, icon }) => {
                const anim = char.animations[dir]
                const sheet = spriteSheets.find((s) => s.id === anim?.spriteSheetId)
                const animation = sheet?.animations.find((a) => a.id === anim?.animationId)
                return (
                  <div key={dir} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-4">{icon}</span>
                    <span className="text-gray-400 w-24">{label}</span>
                    {animation
                      ? <span className="text-green-400">{sheet?.name} / {animation.name}</span>
                      : <span className="text-gray-600 italic">not assigned</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {!isMain && (
            <div className="mt-4 p-3 rounded-lg bg-teal-900/20 border border-teal-700/30 text-xs text-teal-200">
              <strong>Tip:</strong> Place this NPC in a scene by adding a <strong>Character</strong> object in the Scene Editor, then selecting this NPC from the character picker in the properties panel.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
