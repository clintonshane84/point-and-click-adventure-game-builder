import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, User, X } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { FacingDirection, CharacterAnimation } from '../../types'

const DIRECTIONS: { dir: FacingDirection; label: string; icon: React.ReactNode }[] = [
  { dir: 'up',    label: 'Walk Up',    icon: <ArrowUp size={14} /> },
  { dir: 'down',  label: 'Walk Down',  icon: <ArrowDown size={14} /> },
  { dir: 'left',  label: 'Walk Left',  icon: <ArrowLeft size={14} /> },
  { dir: 'right', label: 'Walk Right', icon: <ArrowRight size={14} /> },
]

const FACING_OPTIONS: FacingDirection[] = ['up', 'down', 'left', 'right']

function AnimationSlot({
  direction,
  label,
  icon,
  current,
}: {
  direction: FacingDirection
  label: string
  icon: React.ReactNode
  current: CharacterAnimation | null
}) {
  const { project, setCharacterAnimation } = useGameStore()
  const { spriteSheets } = project

  const selectedSheet = spriteSheets.find((s) => s.id === current?.spriteSheetId)
  const availableAnims = selectedSheet?.animations ?? []

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
        <span className="text-indigo-400">{icon}</span>
        {label}
        {current && (
          <button
            onClick={() => setCharacterAnimation(direction, null)}
            className="ml-auto p-0.5 rounded hover:bg-red-700/40 text-gray-500 hover:text-red-400"
            title="Clear animation"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Sprite Sheet selector */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Sprite Sheet</label>
        {spriteSheets.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No sprite sheets yet — add one in the Sprites editor.</p>
        ) : (
          <select
            value={current?.spriteSheetId ?? ''}
            onChange={(e) => {
              const sheetId = e.target.value
              if (!sheetId) { setCharacterAnimation(direction, null); return }
              setCharacterAnimation(direction, { spriteSheetId: sheetId, animationId: '' })
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

      {/* Animation selector */}
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
                setCharacterAnimation(direction, {
                  spriteSheetId: current.spriteSheetId,
                  animationId: e.target.value,
                })
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

      {/* Status badge */}
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
  const { project, updateMainCharacter } = useGameStore()
  const { mainCharacter } = project

  return (
    <div className="flex h-full bg-gray-900">

      {/* ── Left: character info ─────────────────────────────────────────────── */}
      <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-gray-200 text-sm font-semibold flex items-center gap-2">
            <User size={16} className="text-indigo-400" />
            Main Character
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">Define your player character and walking animations.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Name */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Character Name</label>
            <input
              type="text"
              value={mainCharacter.name}
              onChange={(e) => updateMainCharacter({ name: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              placeholder="Player"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Description</label>
            <textarea
              value={mainCharacter.description}
              onChange={(e) => updateMainCharacter({ description: e.target.value })}
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="Optional character description..."
            />
          </div>

          {/* Dimensions */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Sprite Size (px)</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Width</label>
                <input
                  type="number"
                  min={8}
                  max={512}
                  value={mainCharacter.width}
                  onChange={(e) => updateMainCharacter({ width: parseInt(e.target.value) || 64 })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Height</label>
                <input
                  type="number"
                  min={8}
                  max={512}
                  value={mainCharacter.height}
                  onChange={(e) => updateMainCharacter({ height: parseInt(e.target.value) || 96 })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Default facing */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Default Facing Direction</label>
            <select
              value={mainCharacter.defaultFacing}
              onChange={(e) => updateMainCharacter({ defaultFacing: e.target.value as FacingDirection })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              {FACING_OPTIONS.map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Visual preview card */}
          <div className="border border-gray-700 rounded-lg p-3 bg-gray-900/40">
            <p className="text-xs text-gray-500 mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div
                className="rounded border border-indigo-700/50 bg-indigo-900/20 flex items-center justify-center text-indigo-300 shrink-0"
                style={{ width: Math.min(mainCharacter.width, 64), height: Math.min(mainCharacter.height, 96) }}
              >
                <User size={20} />
              </div>
              <div className="text-xs text-gray-400 space-y-0.5">
                <p className="text-gray-200 font-medium">{mainCharacter.name || 'Unnamed'}</p>
                <p>{mainCharacter.width} × {mainCharacter.height} px</p>
                <p>Default: {mainCharacter.defaultFacing}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: animation slots ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-gray-200 text-base font-semibold mb-1">Walking Animations</h3>
          <p className="text-gray-500 text-sm mb-5">
            Assign a sprite sheet animation for each walking direction. These play while the character is moving.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {DIRECTIONS.map(({ dir, label, icon }) => (
              <AnimationSlot
                key={dir}
                direction={dir}
                label={label}
                icon={icon}
                current={mainCharacter.animations[dir]}
              />
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 border border-gray-700 rounded-lg p-4 bg-gray-800/40">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Animation Summary</p>
            <div className="space-y-1.5">
              {DIRECTIONS.map(({ dir, label, icon }) => {
                const anim = mainCharacter.animations[dir]
                const sheet = project.spriteSheets.find((s) => s.id === anim?.spriteSheetId)
                const animation = sheet?.animations.find((a) => a.id === anim?.animationId)
                return (
                  <div key={dir} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-4">{icon}</span>
                    <span className="text-gray-400 w-24">{label}</span>
                    {animation ? (
                      <span className="text-green-400">{sheet?.name} / {animation.name}</span>
                    ) : (
                      <span className="text-gray-600 italic">not assigned</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-blue-900/20 border border-blue-700/30 text-xs text-blue-200">
            <strong>Tip:</strong> Set up your sprite sheets in the <strong>Sprites</strong> editor first, then return here to link each walking direction to an animation. You can set where the character starts in each scene from the <strong>Scene Editor</strong> properties panel.
          </div>
        </div>
      </div>
    </div>
  )
}
