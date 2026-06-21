import { useState } from 'react'
import { Plus, Trash2, Zap, ChevronDown, ChevronUp, Globe, BookOpen } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { EventTrigger, EventAction, EventCondition, EventBranch, TriggerType, ActionType, ConditionOperator, FacingDirection, Scene, Cinematic, MiniGame } from '../../types'

type EventScope = 'scene' | 'stage' | 'global'

const SCENE_TRIGGER_LABELS: Partial<Record<TriggerType, string>> = {
  click: 'Click',
  hover: 'Hover',
  enter: 'Enter',
  exit: 'Exit',
  keypress: 'Key Press',
}

const TRIGGER_COLORS: Record<TriggerType, string> = {
  click:       'bg-blue-600',
  hover:       'bg-yellow-600',
  enter:       'bg-green-600',
  exit:        'bg-red-600',
  keypress:    'bg-purple-600',
  stage_start: 'bg-indigo-600',
  game_start:  'bg-teal-600',
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  click:       'Click',
  hover:       'Hover',
  enter:       'Enter',
  exit:        'Exit',
  keypress:    'Key Press',
  stage_start: 'Stage Start',
  game_start:  'Game Start',
}

const ACTION_LABELS: Record<ActionType, string> = {
  navigate_scene: 'Navigate to Scene',
  play_sound:     'Play Sound',
  show_dialog:    'Show Dialog',
  set_variable:   'Set Variable',
  show_object:    'Show Object',
  hide_object:    'Hide Object',
  remove_object:  'Remove Object',
  spawn_object:   'Spawn Object',
  play_animation: 'Play Animation',
  stop_animation: 'Stop Animation',
  play_cinematic: 'Play Cinematic',
  launch_minigame:'Launch Mini-Game',
}

type FormAction = Pick<EventAction, 'type' | 'value' | 'entryX' | 'entryY' | 'entryFacing' | 'spawnSceneId' | 'spawnX' | 'spawnY'>
type FormCondition = Omit<EventCondition, never>
type FormBranch = { id: string; conditions: FormCondition[]; logic: 'AND' | 'OR'; actions: FormAction[] }

interface EventFormState {
  trigger: TriggerType
  actions: FormAction[]
  branches: FormBranch[]
}

// ── Shared action value editor (used both in form and inline editing) ─────────
function ActionValueEditor({
  action, idx, actions, onActionsChange, scenes, cinematics, miniGames, allStageVarNames,
}: {
  action: FormAction
  idx: number
  actions: FormAction[]
  onActionsChange: (actions: FormAction[]) => void
  scenes: Scene[]
  cinematics: Cinematic[]
  miniGames: MiniGame[]
  allStageVarNames: string[]
}) {
  const update = (patch: Partial<FormAction>) => {
    const updated = [...actions]
    updated[idx] = { ...updated[idx], ...patch }
    onActionsChange(updated)
  }

  if (action.type === 'play_cinematic') {
    return (
      <select value={action.value} onChange={(e) => update({ value: e.target.value })}
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
        <option value="">— select cinematic —</option>
        {cinematics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    )
  }
  if (action.type === 'launch_minigame') {
    return (
      <select value={action.value} onChange={(e) => update({ value: e.target.value })}
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
        <option value="">— select mini-game —</option>
        {miniGames.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    )
  }
  if (action.type === 'navigate_scene') {
    return (
      <div className="space-y-1.5">
        <select value={action.value} onChange={(e) => update({ value: e.target.value })}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
          <option value="">— select scene —</option>
          {scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="border border-gray-600 rounded p-2 bg-gray-800 space-y-1.5">
          <p className="text-xs text-gray-400 font-medium">Arrival Position</p>
          <div className="flex gap-2">
            <label className="flex items-center gap-1 flex-1 text-xs text-gray-400">X
              <input type="number" placeholder="—" value={action.entryX ?? ''}
                onChange={(e) => update({ entryX: e.target.value === '' ? undefined : Number(e.target.value) })}
                className="flex-1 w-0 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </label>
            <label className="flex items-center gap-1 flex-1 text-xs text-gray-400">Y
              <input type="number" placeholder="—" value={action.entryY ?? ''}
                onChange={(e) => update({ entryY: e.target.value === '' ? undefined : Number(e.target.value) })}
                className="flex-1 w-0 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </label>
            <select value={action.entryFacing ?? ''}
              onChange={(e) => update({ entryFacing: (e.target.value as FacingDirection) || undefined })}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
              <option value="">facing —</option>
              <option value="down">↓ down</option>
              <option value="up">↑ up</option>
              <option value="left">← left</option>
              <option value="right">→ right</option>
            </select>
          </div>
        </div>
      </div>
    )
  }
  if (action.type === 'set_variable') {
    let op = '=', varName = '', varVal = ''
    const addIdx = action.value.indexOf('+=')
    const subIdx = action.value.indexOf('-=')
    if (addIdx !== -1) {
      op = '+='; varName = action.value.slice(0, addIdx).trim(); varVal = action.value.slice(addIdx + 2).trim()
    } else if (subIdx !== -1) {
      op = '-='; varName = action.value.slice(0, subIdx).trim(); varVal = action.value.slice(subIdx + 2).trim()
    } else {
      const eqIdx = action.value.indexOf('=')
      if (eqIdx !== -1) { varName = action.value.slice(0, eqIdx).trim(); varVal = action.value.slice(eqIdx + 1).trim() }
      else { varName = action.value }
    }
    const rebuild = (name: string, operator: string, val: string) => update({ value: `${name}${operator}${val}` })
    return (
      <div className="flex gap-2">
        <div className="flex-1">
          <input type="text" list={`var-names-${idx}`} value={varName}
            onChange={(e) => rebuild(e.target.value, op, varVal)}
            placeholder="variableName"
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 font-mono" />
          <datalist id={`var-names-${idx}`}>
            {allStageVarNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
        <select value={op} onChange={(e) => rebuild(varName, e.target.value, varVal)}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 font-mono">
          <option value="=">=</option>
          <option value="+=">+=</option>
          <option value="-=">-=</option>
        </select>
        <input type="text" value={varVal}
          onChange={(e) => rebuild(varName, op, e.target.value)}
          placeholder={op === '=' ? 'value' : 'number'}
          className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
      </div>
    )
  }
  if (action.type === 'remove_object') {
    return (
      <select value={action.value} onChange={(e) => update({ value: e.target.value })}
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
        <option value="">— select object to remove —</option>
        {scenes.map((s) => s.objects.length > 0 && (
          <optgroup key={s.id} label={s.name}>
            {s.objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </optgroup>
        ))}
      </select>
    )
  }
  if (action.type === 'spawn_object') {
    return (
      <div className="space-y-1.5">
        <select value={action.value} onChange={(e) => update({ value: e.target.value })}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
          <option value="">— select template object —</option>
          {scenes.map((s) => s.objects.length > 0 && (
            <optgroup key={s.id} label={s.name}>
              {s.objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </optgroup>
          ))}
        </select>
        <select value={action.spawnSceneId ?? ''} onChange={(e) => update({ spawnSceneId: e.target.value || undefined })}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
          <option value="">— current scene —</option>
          {scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-2">
          <input type="number" placeholder="X" value={action.spawnX ?? ''}
            onChange={(e) => update({ spawnX: e.target.value !== '' ? Number(e.target.value) : undefined })}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
          <input type="number" placeholder="Y" value={action.spawnY ?? ''}
            onChange={(e) => update({ spawnY: e.target.value !== '' ? Number(e.target.value) : undefined })}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
        </div>
      </div>
    )
  }
  return (
    <input type="text" placeholder="Value" value={action.value}
      onChange={(e) => update({ value: e.target.value })}
      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
  )
}

// ── Actions editor panel ──────────────────────────────────────────────────────
function ActionsEditor({
  actions, onActionsChange, scenes, cinematics, miniGames, allStageVarNames, label,
}: {
  actions: FormAction[]
  onActionsChange: (actions: FormAction[]) => void
  scenes: Scene[]
  cinematics: Cinematic[]
  miniGames: MiniGame[]
  allStageVarNames: string[]
  label?: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400 font-semibold">{label ?? 'Actions'}</label>
        <button
          onClick={() => onActionsChange([...actions, { type: 'set_variable' as ActionType, value: '' }])}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      {actions.map((action, idx) => (
        <div key={idx} className="flex gap-2 items-start">
          <div className="flex-1 space-y-1.5">
            <select value={action.type}
              onChange={(e) => {
                const updated = [...actions]
                updated[idx] = { ...updated[idx], type: e.target.value as ActionType }
                onActionsChange(updated)
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
              {(Object.keys(ACTION_LABELS) as ActionType[]).map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a]}</option>
              ))}
            </select>
            <ActionValueEditor
              action={action} idx={idx} actions={actions} onActionsChange={onActionsChange}
              scenes={scenes} cinematics={cinematics} miniGames={miniGames}
              allStageVarNames={allStageVarNames}
            />
          </div>
          <button
            onClick={() => onActionsChange(actions.filter((_, i) => i !== idx))}
            className="mt-1 text-gray-500 hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Branch editor ─────────────────────────────────────────────────────────────
const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals:       '=',
  not_equals:   '≠',
  greater_than: '>',
  less_than:    '<',
  contains:     'contains',
}

function BranchesEditor({
  branches, onBranchesChange, scenes, cinematics, miniGames, allStageVarNames,
}: {
  branches: FormBranch[]
  onBranchesChange: (branches: FormBranch[]) => void
  scenes: Scene[]
  cinematics: Cinematic[]
  miniGames: MiniGame[]
  allStageVarNames: string[]
}) {
  const addBranch = () => {
    const id = `br-${Date.now()}`
    onBranchesChange([...branches, {
      id,
      conditions: [{ id: `cond-${Date.now()}`, variable: '', operator: 'equals', value: '' }],
      logic: 'AND',
      actions: [{ type: 'set_variable', value: '' }],
    }])
  }

  const updateBranch = (i: number, patch: Partial<FormBranch>) => {
    const updated = [...branches]
    updated[i] = { ...updated[i], ...patch }
    onBranchesChange(updated)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400 font-semibold">Conditional Branches</label>
        <button onClick={addBranch} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
          <Plus size={12} /> Add Branch
        </button>
      </div>
      {branches.length === 0 && (
        <p className="text-xs text-gray-600 italic">No branches yet. Add a branch to run different actions when a condition is met.</p>
      )}
      {branches.map((branch, bi) => (
        <div key={branch.id} className="border border-indigo-800 rounded-lg overflow-hidden">
          {/* Branch header */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-950">
            <span className="text-xs font-semibold text-indigo-400">Branch {bi + 1}</span>
            <button onClick={() => onBranchesChange(branches.filter((_, i) => i !== bi))}
              className="text-gray-500 hover:text-red-400"><Trash2 size={12} /></button>
          </div>
          {/* Conditions */}
          <div className="px-3 py-2 space-y-1.5 bg-gray-850 border-b border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">If</span>
              {branch.conditions.length > 1 && (
                <div className="flex gap-1">
                  {(['AND', 'OR'] as const).map((l) => (
                    <button key={l} onClick={() => updateBranch(bi, { logic: l })}
                      className={`text-xs px-2 py-0.5 rounded ${branch.logic === l ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {branch.conditions.map((cond, ci) => (
              <div key={cond.id} className="flex gap-1.5 items-center">
                <input type="text" value={cond.variable}
                  onChange={(e) => {
                    const conds = [...branch.conditions]
                    conds[ci] = { ...conds[ci], variable: e.target.value }
                    updateBranch(bi, { conditions: conds })
                  }}
                  placeholder="variable"
                  list={`br-vars-${bi}-${ci}`}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500 font-mono" />
                <datalist id={`br-vars-${bi}-${ci}`}>
                  {allStageVarNames.map((n) => <option key={n} value={n} />)}
                </datalist>
                <select value={cond.operator}
                  onChange={(e) => {
                    const conds = [...branch.conditions]
                    conds[ci] = { ...conds[ci], operator: e.target.value as ConditionOperator }
                    updateBranch(bi, { conditions: conds })
                  }}
                  className="bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500">
                  {(Object.keys(OPERATOR_LABELS) as ConditionOperator[]).map((op) => (
                    <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                  ))}
                </select>
                <input type="text" value={cond.value}
                  onChange={(e) => {
                    const conds = [...branch.conditions]
                    conds[ci] = { ...conds[ci], value: e.target.value }
                    updateBranch(bi, { conditions: conds })
                  }}
                  placeholder="value"
                  className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500" />
                <button onClick={() => updateBranch(bi, { conditions: branch.conditions.filter((_, i) => i !== ci) })}
                  className="text-gray-500 hover:text-red-400 flex-shrink-0"><Trash2 size={11} /></button>
              </div>
            ))}
            <button onClick={() => {
              const newCond: FormCondition = { id: `cond-${Date.now()}`, variable: '', operator: 'equals', value: '' }
              updateBranch(bi, { conditions: [...branch.conditions, newCond] })
            }} className="text-xs text-gray-500 hover:text-indigo-400 flex items-center gap-1">
              <Plus size={10} /> Add condition
            </button>
          </div>
          {/* Branch actions */}
          <div className="px-3 py-2">
            <p className="text-xs text-gray-500 mb-2">Then run:</p>
            <ActionsEditor
              actions={branch.actions}
              onActionsChange={(a) => updateBranch(bi, { actions: a })}
              scenes={scenes} cinematics={cinematics} miniGames={miniGames}
              allStageVarNames={allStageVarNames}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main EventEditor component ────────────────────────────────────────────────
export function EventEditor() {
  const { project, addEvent, updateEvent, deleteEvent } = useGameStore()
  const { scenes, events } = project
  const stages     = project.stages    ?? []
  const cinematics = project.cinematics ?? []
  const miniGames  = project.miniGames  ?? []
  const allStageVarNames = Array.from(
    new Set(stages.flatMap((s) => (s.variables ?? []).map((v) => v.name)))
  )

  const [scope, setScope]               = useState<EventScope>('scene')
  const [selectedSceneId, setSelectedSceneId] = useState(scenes[0]?.id ?? '')
  const [selectedObjId, setSelectedObjId]     = useState<string | null>(null)
  const [selectedStageId, setSelectedStageId] = useState(stages[0]?.id ?? '')
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState<EventFormState>({
    trigger: 'click',
    actions: [{ type: 'set_variable', value: '' }],
    branches: [],
  })

  const selectedScene   = scenes.find((s) => s.id === selectedSceneId)
  const sceneObjects    = selectedScene?.objects ?? []

  // Filter events by current scope
  const filteredEvents = events.filter((e) => {
    if (scope === 'scene')  return e.trigger !== 'stage_start' && e.trigger !== 'game_start' && e.sceneId === selectedSceneId && (selectedObjId ? e.objectId === selectedObjId : true)
    if (scope === 'stage')  return e.trigger === 'stage_start' && e.stageId === selectedStageId
    if (scope === 'global') return e.trigger === 'game_start'
    return false
  })

  const defaultTrigger = (s: EventScope): TriggerType =>
    s === 'stage' ? 'stage_start' : s === 'global' ? 'game_start' : 'click'

  const handleScopeChange = (s: EventScope) => {
    setScope(s)
    setShowForm(false)
    setExpandedEventId(null)
    setForm({ trigger: defaultTrigger(s), actions: [{ type: 'set_variable', value: '' }], branches: [] })
  }

  const handleSubmit = () => {
    let newEvent: EventTrigger
    const ts = Date.now()
    const serializeAction = (a: FormAction, id: string): EventAction => ({
      id,
      type: a.type,
      value: a.value,
      ...(a.entryX != null ? { entryX: a.entryX } : {}),
      ...(a.entryY != null ? { entryY: a.entryY } : {}),
      ...(a.entryFacing ? { entryFacing: a.entryFacing } : {}),
      ...(a.spawnSceneId ? { spawnSceneId: a.spawnSceneId } : {}),
      ...(a.spawnX != null ? { spawnX: a.spawnX } : {}),
      ...(a.spawnY != null ? { spawnY: a.spawnY } : {}),
    })
    const baseActions = form.actions.map((a, i) => serializeAction(a, `action-${ts}-${i}`))
    const baseBranches: EventBranch[] = form.branches.map((br, bi) => ({
      id: br.id || `br-${ts}-${bi}`,
      conditions: br.conditions.map((c, ci): EventCondition => ({
        id: c.id || `cond-${ts}-${bi}-${ci}`,
        variable: c.variable,
        operator: c.operator,
        value: c.value,
      })),
      logic: br.logic,
      actions: br.actions.map((a, ai) => serializeAction(a, `action-${ts}-br${bi}-${ai}`)),
    }))

    if (scope === 'scene') {
      if (!selectedObjId) return
      newEvent = {
        id: `event-${ts}`,
        sceneId: selectedSceneId,
        objectId: selectedObjId,
        trigger: form.trigger,
        actions: baseActions,
        branches: baseBranches,
        enabled: true,
      }
    } else if (scope === 'stage') {
      newEvent = {
        id: `event-${ts}`,
        sceneId: '',
        objectId: '',
        stageId: selectedStageId,
        trigger: 'stage_start',
        actions: baseActions,
        branches: baseBranches,
        enabled: true,
      }
    } else {
      newEvent = {
        id: `event-${ts}`,
        sceneId: '',
        objectId: '',
        trigger: 'game_start',
        actions: baseActions,
        branches: baseBranches,
        enabled: true,
      }
    }
    addEvent(newEvent)
    setShowForm(false)
    setForm({ trigger: defaultTrigger(scope), actions: [{ type: 'set_variable', value: '' }], branches: [] })
  }

  const handleDeleteAction = (eventId: string, actionId: string) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return
    updateEvent(eventId, { actions: event.actions.filter((a) => a.id !== actionId) })
  }

  const canAddEvent =
    scope === 'global' ||
    (scope === 'stage'  && !!selectedStageId) ||
    (scope === 'scene'  && !!selectedObjId)

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left panel */}
      <div className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Scope tabs */}
        <div className="flex border-b border-gray-700">
          {([['scene', 'Scene', <Zap size={12} />], ['stage', 'Stage', <BookOpen size={12} />], ['global', 'Global', <Globe size={12} />]] as const).map(([s, label, icon]) => (
            <button
              key={s}
              onClick={() => handleScopeChange(s)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                scope === s
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Scene scope: scene + object selectors */}
        {scope === 'scene' && (
          <>
            <div className="px-3 py-2 border-b border-gray-700">
              <label className="text-xs text-gray-400 block mb-1">Scene</label>
              <select value={selectedSceneId}
                onChange={(e) => { setSelectedSceneId(e.target.value); setSelectedObjId(null) }}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-indigo-500">
                {scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="px-3 py-1.5 border-b border-gray-700">
              <span className="text-xs text-gray-400 font-semibold">Objects</span>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              <div
                className={`px-3 py-2 cursor-pointer text-sm ${selectedObjId === null ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                onClick={() => setSelectedObjId(null)}>
                All Objects
              </div>
              {sceneObjects.map((obj) => (
                <div key={obj.id}
                  className={`px-3 py-2 cursor-pointer text-sm truncate ${selectedObjId === obj.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                  onClick={() => setSelectedObjId(obj.id)}>
                  {obj.name}
                </div>
              ))}
              {sceneObjects.length === 0 && <p className="text-gray-500 text-xs px-3 py-2">No objects in scene</p>}
            </div>
          </>
        )}

        {/* Stage scope: stage selector */}
        {scope === 'stage' && (
          <div className="flex-1 overflow-y-auto py-1">
            {stages.sort((a, b) => a.order - b.order).map((stage) => (
              <div key={stage.id}
                className={`px-3 py-2.5 cursor-pointer text-sm ${selectedStageId === stage.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                onClick={() => { setSelectedStageId(stage.id); setExpandedEventId(null) }}>
                <div className="font-medium truncate">{stage.name}</div>
                <div className="text-xs opacity-60">
                  {events.filter((e) => e.trigger === 'stage_start' && e.stageId === stage.id).length} event(s)
                </div>
              </div>
            ))}
            {stages.length === 0 && <p className="text-gray-500 text-xs px-3 py-2">No stages defined</p>}
          </div>
        )}

        {/* Global scope: info blurb */}
        {scope === 'global' && (
          <div className="p-3 text-xs text-gray-400">
            <Globe size={20} className="text-teal-400 mb-2" />
            <p className="font-semibold text-gray-300 mb-1">Game Start events</p>
            <p>These actions run once when the game first starts, before the first scene loads. Use them to initialise global variables.</p>
          </div>
        )}
      </div>

      {/* Center: event list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div>
            <h2 className="text-gray-100 font-semibold">
              {scope === 'scene'  ? 'Scene Events' : scope === 'stage' ? 'Stage Events' : 'Global Events'}
            </h2>
            <p className="text-gray-400 text-xs">
              {scope === 'stage' && selectedStageId
                ? `${filteredEvents.length} event(s) for ${stages.find((s) => s.id === selectedStageId)?.name}`
                : `${filteredEvents.length} event(s)`}
            </p>
          </div>
          <button
            onClick={() => {
              if (scope === 'scene' && !selectedObjId) { alert('Select an object first to add a scene event.'); return }
              setShowForm(true)
            }}
            disabled={scope === 'stage' && !selectedStageId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-sm"
          >
            <Plus size={14} /> Add Event
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Zap size={48} className="text-gray-600 mb-3" />
              <p className="text-gray-400 font-medium">No events yet</p>
              <p className="text-gray-500 text-sm mt-1">
                {scope === 'scene'  ? 'Select an object and click "Add Event"' :
                 scope === 'stage'  ? 'Click "Add Event" to run actions when this stage starts' :
                                     'Click "Add Event" to run actions at game start'}
              </p>
            </div>
          )}

          {filteredEvents.map((event) => {
            const label =
              scope === 'scene'
                ? sceneObjects.find((o) => o.id === event.objectId)?.name ?? event.objectId
                : scope === 'stage'
                ? stages.find((s) => s.id === event.stageId)?.name ?? 'Stage'
                : 'Game'
            const isExpanded = expandedEventId === event.id
            return (
              <div key={event.id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${TRIGGER_COLORS[event.trigger]}`}>
                    {TRIGGER_LABELS[event.trigger]}
                  </span>
                  <span className="text-gray-300 text-sm flex-1">
                    on <span className="font-medium text-gray-100">{label}</span>
                  </span>
                  <span className="text-gray-500 text-xs">
                    {event.actions.length} action{event.actions.length !== 1 ? 's' : ''}
                  </span>
                  <button onClick={() => setExpandedEventId(isExpanded ? null : event.id)} className="text-gray-400 hover:text-gray-200">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button onClick={() => deleteEvent(event.id)} className="text-gray-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-700 px-4 py-3 space-y-3">
                    {/* Branches summary */}
                    {(event.branches ?? []).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500 font-semibold">Branches</p>
                        {(event.branches ?? []).map((branch, bi) => (
                          <div key={branch.id} className="bg-indigo-950 border border-indigo-800 rounded px-3 py-1.5 text-xs text-gray-300">
                            <span className="text-indigo-400 font-medium">Branch {bi + 1}: </span>
                            {branch.conditions.map((c, ci) => (
                              <span key={c.id}>
                                {ci > 0 && <span className="text-gray-500 mx-1">{branch.logic}</span>}
                                <span className="font-mono">{c.variable} {OPERATOR_LABELS[c.operator]} {c.value}</span>
                              </span>
                            ))}
                            <span className="text-gray-500 ml-2">→ {branch.actions.length} action{branch.actions.length !== 1 ? 's' : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Default actions */}
                    <p className="text-xs text-gray-500 font-semibold">
                      {(event.branches ?? []).length > 0 ? 'Default Actions' : 'Actions'}
                    </p>
                    {event.actions.map((action: EventAction) => (
                      <div key={action.id} className="flex items-center gap-3 bg-gray-900 rounded px-3 py-2">
                        <span className="text-gray-300 text-sm font-medium flex-1">{ACTION_LABELS[action.type]}</span>
                        {action.value && (
                          <span className="text-gray-400 text-xs bg-gray-700 px-2 py-0.5 rounded font-mono">{action.value}</span>
                        )}
                        <button onClick={() => handleDeleteAction(event.id, action.id)} className="text-gray-500 hover:text-red-400">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newAction: EventAction = { id: `action-${Date.now()}`, type: 'set_variable', value: '' }
                        updateEvent(event.id, { actions: [...event.actions, newAction] })
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1"
                    >
                      <Plus size={12} /> Add Action
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Event modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-xl w-[480px] max-h-[80vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-gray-100 font-semibold text-lg">
              Add {scope === 'stage' ? 'Stage' : scope === 'global' ? 'Global' : 'Scene'} Event
            </h3>

            {scope === 'scene' && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Trigger</label>
                <select value={form.trigger}
                  onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value as TriggerType }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
                  {(Object.keys(SCENE_TRIGGER_LABELS) as TriggerType[]).map((t) => (
                    <option key={t} value={t}>{SCENE_TRIGGER_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            )}

            {scope === 'stage' && (
              <p className="text-sm text-gray-400">
                Actions below will run once when <span className="text-gray-100 font-medium">{stages.find((s) => s.id === selectedStageId)?.name}</span> starts.
              </p>
            )}

            {scope === 'global' && (
              <p className="text-sm text-gray-400">
                Actions below will run once when the game starts, before the first scene loads.
              </p>
            )}

            <BranchesEditor
              branches={form.branches}
              onBranchesChange={(b) => setForm((f) => ({ ...f, branches: b }))}
              scenes={scenes} cinematics={cinematics} miniGames={miniGames}
              allStageVarNames={allStageVarNames}
            />
            <ActionsEditor
              actions={form.actions}
              onActionsChange={(a) => setForm((f) => ({ ...f, actions: a }))}
              scenes={scenes} cinematics={cinematics} miniGames={miniGames}
              allStageVarNames={allStageVarNames}
              label="Default Actions (when no branch matches)"
            />

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={!canAddEvent}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-sm font-medium">
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
