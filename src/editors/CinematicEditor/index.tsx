import React, { useState } from 'react'
import {
  Plus, Trash2, Film, ChevronUp, ChevronDown,
  Footprints, MessageSquare, Swords, Clock, Volume2, Variable, AlignLeft,
} from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type {
  Cinematic, CinematicStep, CinematicStepType, CinematicCompletionAction,
} from '../../types'

// ── Step type metadata ────────────────────────────────────────────────────────

interface StepMeta {
  label: string
  icon: React.ReactNode
  color: string      // tailwind bg class for badge
  textColor: string
  summary: (step: CinematicStep, charName: string) => string
}

const STEP_META: Record<CinematicStepType, StepMeta> = {
  walk_to: {
    label: 'Walk To',
    icon: <Footprints size={12} />,
    color: 'bg-blue-700',
    textColor: 'text-blue-300',
    summary: (s, n) => `${n} → (${Math.round(s.targetX ?? 0)}, ${Math.round(s.targetY ?? 0)})`,
  },
  talk: {
    label: 'Talk',
    icon: <MessageSquare size={12} />,
    color: 'bg-green-700',
    textColor: 'text-green-300',
    summary: (s, n) => `${n}: "${(s.text ?? '').slice(0, 40)}${(s.text ?? '').length > 40 ? '…' : ''}"`,
  },
  action: {
    label: 'Action',
    icon: <Swords size={12} />,
    color: 'bg-orange-700',
    textColor: 'text-orange-300',
    summary: (s, n) => `${n} ${s.actionLabel ?? 'performs action'}`,
  },
  wait: {
    label: 'Wait',
    icon: <Clock size={12} />,
    color: 'bg-gray-600',
    textColor: 'text-gray-300',
    summary: (s) => `Pause ${s.duration ?? 1}s`,
  },
  show_dialog: {
    label: 'Show Dialog',
    icon: <AlignLeft size={12} />,
    color: 'bg-purple-700',
    textColor: 'text-purple-300',
    summary: (s) => `"${(s.text ?? '').slice(0, 50)}${(s.text ?? '').length > 50 ? '…' : ''}"`,
  },
  set_variable: {
    label: 'Set Variable',
    icon: <Variable size={12} />,
    color: 'bg-yellow-700',
    textColor: 'text-yellow-300',
    summary: (s) => s.variable ?? 'name=value',
  },
  play_sound: {
    label: 'Play Sound',
    icon: <Volume2 size={12} />,
    color: 'bg-teal-700',
    textColor: 'text-teal-300',
    summary: (s) => s.assetId ?? '—',
  },
}

const STEP_TYPES = Object.keys(STEP_META) as CinematicStepType[]

const COMPLETION_LABELS: Record<CinematicCompletionAction, string> = {
  return_to_game: 'Return to Game',
  navigate_scene: 'Navigate to Scene',
  show_dialog: 'Show Dialog',
  set_variable: 'Set Variable',
}

// ── Helper ────────────────────────────────────────────────────────────────────

function characterName(characterId: string | undefined, project: ReturnType<typeof useGameStore.getState>['project']): string {
  if (!characterId || characterId === 'main-character') return project.mainCharacter.name || 'Player'
  return (project.npcs ?? []).find((n) => n.id === characterId)?.name ?? 'Unknown'
}

// ── Step properties panel ────────────────────────────────────────────────────

function StepProperties({
  step, cinematic: _cinematic, onUpdate,
}: {
  step: CinematicStep
  cinematic: Cinematic
  onUpdate: (updates: Partial<CinematicStep>) => void
}) {
  const { project } = useGameStore()
  const npcs = project.npcs ?? []
  const hasCharacter = step.type === 'walk_to' || step.type === 'talk' || step.type === 'action'
  const audioAssets = project.assets.filter((a) => a.type === 'audio')

  return (
    <div className="space-y-3">
      {/* Character selector */}
      {hasCharacter && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Character</label>
          <select
            value={step.characterId ?? 'main-character'}
            onChange={(e) => onUpdate({ characterId: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="main-character">
              {project.mainCharacter.name || 'Player'} (main)
            </option>
            {npcs.map((npc) => (
              <option key={npc.id} value={npc.id}>{npc.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* walk_to fields */}
      {step.type === 'walk_to' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Target X</label>
            <input
              type="number"
              value={step.targetX ?? 0}
              onChange={(e) => onUpdate({ targetX: parseFloat(e.target.value) || 0 })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Target Y</label>
            <input
              type="number"
              value={step.targetY ?? 0}
              onChange={(e) => onUpdate({ targetY: parseFloat(e.target.value) || 0 })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* talk / show_dialog text */}
      {(step.type === 'talk' || step.type === 'show_dialog') && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Dialog Text</label>
          <textarea
            value={step.text ?? ''}
            onChange={(e) => onUpdate({ text: e.target.value })}
            rows={4}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none"
            placeholder="What do they say?"
          />
        </div>
      )}

      {/* action label */}
      {step.type === 'action' && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Action Label</label>
          <input
            type="text"
            value={step.actionLabel ?? ''}
            onChange={(e) => onUpdate({ actionLabel: e.target.value })}
            placeholder="e.g. attacks, gives gift, unlocks door"
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-xs text-gray-600 mt-1">Shown as a floating label for 2 seconds.</p>
        </div>
      )}

      {/* wait duration */}
      {step.type === 'wait' && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Duration — {step.duration ?? 1}s
          </label>
          <input
            type="range" min={0.5} max={10} step={0.5}
            value={step.duration ?? 1}
            onChange={(e) => onUpdate({ duration: parseFloat(e.target.value) })}
            className="w-full accent-gray-500"
          />
        </div>
      )}

      {/* play_sound asset */}
      {step.type === 'play_sound' && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Sound Asset</label>
          {audioAssets.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No audio assets yet — add one in Assets.</p>
          ) : (
            <select
              value={step.assetId ?? ''}
              onChange={(e) => onUpdate({ assetId: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— select audio —</option>
              {audioAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* set_variable */}
      {step.type === 'set_variable' && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Variable Assignment</label>
          <input
            type="text"
            value={step.variable ?? ''}
            onChange={(e) => onUpdate({ variable: e.target.value })}
            placeholder="variableName=value"
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-xs text-gray-600 mt-1">Format: <code className="text-gray-400">name=value</code></p>
        </div>
      )}
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

export function CinematicEditor() {
  const {
    project,
    addCinematic, updateCinematic, deleteCinematic,
    addCinematicStep, updateCinematicStep, deleteCinematicStep, moveCinematicStep,
  } = useGameStore()
  const cinematics = project.cinematics ?? []
  const { scenes } = project

  const [selectedCinematicId, setSelectedCinematicId] = useState<string | null>(
    cinematics[0]?.id ?? null
  )
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  const cinematic = cinematics.find((c) => c.id === selectedCinematicId) ?? null
  const selectedStep = cinematic?.steps.find((s) => s.id === selectedStepId) ?? null

  function handleAddCinematic() {
    const c: Cinematic = {
      id: `cine-${Date.now()}`,
      name: `Cinematic ${cinematics.length + 1}`,
      description: '',
      sceneId: scenes[0]?.id ?? '',
      steps: [],
      completionAction: 'return_to_game',
      completionValue: '',
    }
    addCinematic(c)
    setSelectedCinematicId(c.id)
    setSelectedStepId(null)
  }

  function handleAddStep(type: CinematicStepType) {
    if (!cinematic) return
    const step: CinematicStep = {
      id: `step-${Date.now()}`,
      type,
      characterId: 'main-character',
      targetX: 200,
      targetY: 400,
      text: '',
      actionLabel: '',
      duration: 1,
      variable: '',
    }
    addCinematicStep(cinematic.id, step)
    setSelectedStepId(step.id)
  }

  const [showAddStep, setShowAddStep] = useState(false)

  return (
    <div className="flex h-full bg-gray-900">

      {/* ── Left: cinematic list ─────────────────────────────────────────────── */}
      <div className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold flex items-center gap-1.5">
            <Film size={14} className="text-violet-400" /> Cinematics
          </span>
          <button
            onClick={handleAddCinematic}
            className="p-1 rounded bg-violet-700 hover:bg-violet-600 text-white"
            title="Add cinematic"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {cinematics.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer group ${
                c.id === selectedCinematicId ? 'bg-violet-700 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => { setSelectedCinematicId(c.id); setSelectedStepId(null) }}
            >
              <Film size={12} className="shrink-0 opacity-60" />
              <span className="text-sm truncate flex-1">{c.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteCinematic(c.id)
                  if (selectedCinematicId === c.id) {
                    setSelectedCinematicId(cinematics.find((x) => x.id !== c.id)?.id ?? null)
                    setSelectedStepId(null)
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-600 text-gray-400 hover:text-white shrink-0"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {cinematics.length === 0 && (
            <p className="text-xs text-gray-600 px-3 py-3 leading-relaxed">
              No cinematics yet.<br />Click + to create one.
            </p>
          )}
        </div>

        {/* Info box */}
        <div className="p-3 border-t border-gray-700 text-xs text-gray-600 leading-relaxed">
          Trigger cinematics from the Event Editor using the <span className="text-gray-400">Play Cinematic</span> action.
        </div>
      </div>

      {/* ── Center: steps timeline ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!cinematic ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Film size={48} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No cinematic selected</p>
              <p className="text-gray-500 text-sm mt-1">Select one from the list or click + to create.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Cinematic properties header */}
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 space-y-3 shrink-0">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={cinematic.name}
                  onChange={(e) => updateCinematic(cinematic.id, { name: e.target.value })}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500 font-medium"
                />
                <span className="text-xs text-gray-500">{cinematic.steps.length} step{cinematic.steps.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Scene</label>
                  <select
                    value={cinematic.sceneId}
                    onChange={(e) => updateCinematic(cinematic.id, { sceneId: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-violet-500"
                  >
                    {scenes.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">On Complete</label>
                  <select
                    value={cinematic.completionAction}
                    onChange={(e) => updateCinematic(cinematic.id, {
                      completionAction: e.target.value as CinematicCompletionAction,
                    })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-violet-500"
                  >
                    {(Object.keys(COMPLETION_LABELS) as CinematicCompletionAction[]).map((k) => (
                      <option key={k} value={k}>{COMPLETION_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {cinematic.completionAction !== 'return_to_game' && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    {cinematic.completionAction === 'navigate_scene' ? 'Scene ID / Name' :
                     cinematic.completionAction === 'show_dialog' ? 'Dialog Text' : 'Variable (name=value)'}
                  </label>
                  {cinematic.completionAction === 'navigate_scene' ? (
                    <select
                      value={cinematic.completionValue}
                      onChange={(e) => updateCinematic(cinematic.id, { completionValue: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-violet-500"
                    >
                      <option value="">— select scene —</option>
                      {scenes.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={cinematic.completionValue}
                      onChange={(e) => updateCinematic(cinematic.id, { completionValue: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-violet-500"
                    />
                  )}
                </div>
              )}
              <input
                type="text"
                value={cinematic.description}
                onChange={(e) => updateCinematic(cinematic.id, { description: e.target.value })}
                placeholder="Description (optional)..."
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Steps list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cinematic.steps.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-center border-2 border-dashed border-gray-700 rounded-lg">
                  <p className="text-gray-500 text-sm">No steps yet</p>
                  <p className="text-gray-600 text-xs mt-1">Use the "Add Step" button below to build your cinematic.</p>
                </div>
              )}

              {cinematic.steps.map((step, idx) => {
                const meta = STEP_META[step.type]
                const charName = characterName(step.characterId, project)
                const isSelected = step.id === selectedStepId
                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-violet-500 bg-violet-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                    onClick={() => setSelectedStepId(isSelected ? null : step.id)}
                  >
                    {/* Step number */}
                    <span className="text-xs text-gray-600 w-5 shrink-0 pt-0.5 text-right">{idx + 1}</span>

                    {/* Type badge */}
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 text-white ${meta.color}`}>
                      {meta.icon} {meta.label}
                    </span>

                    {/* Summary */}
                    <span className={`text-xs flex-1 leading-relaxed truncate ${meta.textColor}`}>
                      {meta.summary(step, charName)}
                    </span>

                    {/* Controls */}
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => moveCinematicStep(cinematic.id, step.id, 'up')}
                        disabled={idx === 0}
                        className="p-0.5 rounded text-gray-500 hover:text-gray-200 disabled:opacity-30"
                        title="Move up"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        onClick={() => moveCinematicStep(cinematic.id, step.id, 'down')}
                        disabled={idx === cinematic.steps.length - 1}
                        className="p-0.5 rounded text-gray-500 hover:text-gray-200 disabled:opacity-30"
                        title="Move down"
                      >
                        <ChevronDown size={13} />
                      </button>
                      <button
                        onClick={() => {
                          deleteCinematicStep(cinematic.id, step.id)
                          if (selectedStepId === step.id) setSelectedStepId(null)
                        }}
                        className="p-0.5 rounded text-gray-500 hover:text-red-400 ml-1"
                        title="Delete step"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Add step */}
              <div className="relative pt-2">
                <button
                  onClick={() => setShowAddStep((v) => !v)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-dashed border-gray-600 hover:border-violet-500 text-gray-500 hover:text-violet-400 text-sm w-full justify-center transition-colors"
                >
                  <Plus size={14} /> Add Step
                </button>
                {showAddStep && (
                  <div className="absolute left-0 right-0 mt-1 z-20 bg-gray-900 border border-gray-600 rounded-lg shadow-xl overflow-hidden grid grid-cols-2 gap-0.5 p-1">
                    {STEP_TYPES.map((type) => {
                      const meta = STEP_META[type]
                      return (
                        <button
                          key={type}
                          onClick={() => { handleAddStep(type); setShowAddStep(false) }}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 rounded transition-colors"
                        >
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-white shrink-0 ${meta.color}`}>
                            {meta.icon}
                          </span>
                          {meta.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Right: step properties ───────────────────────────────────────────── */}
      <div className="w-64 bg-gray-800 border-l border-gray-700 flex flex-col shrink-0">
        <div className="px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold">
            {selectedStep ? `${STEP_META[selectedStep.type].label} Properties` : 'Step Properties'}
          </span>
        </div>

        {selectedStep && cinematic ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Step type selector */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Step Type</label>
              <select
                value={selectedStep.type}
                onChange={(e) => updateCinematicStep(cinematic.id, selectedStep.id, {
                  type: e.target.value as CinematicStepType,
                })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500"
              >
                {STEP_TYPES.map((t) => (
                  <option key={t} value={t}>{STEP_META[t].label}</option>
                ))}
              </select>
            </div>

            {/* Type-specific fields */}
            <StepProperties
              step={selectedStep}
              cinematic={cinematic}
              onUpdate={(updates) => updateCinematicStep(cinematic.id, selectedStep.id, updates)}
            />

            <button
              onClick={() => {
                deleteCinematicStep(cinematic.id, selectedStep.id)
                setSelectedStepId(null)
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm bg-red-800 hover:bg-red-700 text-white mt-2"
            >
              <Trash2 size={13} /> Delete Step
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-gray-600 text-xs text-center leading-relaxed">
              Click a step in the timeline to edit its properties.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
