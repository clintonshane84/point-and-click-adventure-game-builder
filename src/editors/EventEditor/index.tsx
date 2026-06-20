import { useState } from 'react'
import { Plus, Trash2, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { EventTrigger, EventAction, TriggerType, ActionType, FacingDirection } from '../../types'

const TRIGGER_LABELS: Record<TriggerType, string> = {
  click: 'Click',
  hover: 'Hover',
  enter: 'Enter',
  exit: 'Exit',
  keypress: 'Key Press',
}

const TRIGGER_COLORS: Record<TriggerType, string> = {
  click: 'bg-blue-600',
  hover: 'bg-yellow-600',
  enter: 'bg-green-600',
  exit: 'bg-red-600',
  keypress: 'bg-purple-600',
}

const ACTION_LABELS: Record<ActionType, string> = {
  navigate_scene: 'Navigate to Scene',
  play_sound: 'Play Sound',
  show_dialog: 'Show Dialog',
  set_variable: 'Set Variable',
  show_object: 'Show Object',
  hide_object: 'Hide Object',
  play_animation: 'Play Animation',
  stop_animation: 'Stop Animation',
  play_cinematic: 'Play Cinematic',
  launch_minigame: 'Launch Mini-Game',
}

interface EventFormState {
  trigger: TriggerType
  actions: Array<Pick<EventAction, 'type' | 'value' | 'entryX' | 'entryY' | 'entryFacing'>>
}

export function EventEditor() {
  const { project, addEvent, updateEvent, deleteEvent } = useGameStore()
  const { scenes, events } = project
  const cinematics = project.cinematics ?? []
  const miniGames = project.miniGames ?? []
  const allStageVarNames = Array.from(
    new Set((project.stages ?? []).flatMap((s) => (s.variables ?? []).map((v) => v.name)))
  )

  const [selectedSceneId, setSelectedSceneId] = useState(scenes[0]?.id ?? '')
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<EventFormState>({
    trigger: 'click',
    actions: [{ type: 'navigate_scene', value: '' }],
  })

  const selectedScene = scenes.find((s) => s.id === selectedSceneId)
  const sceneObjects = selectedScene?.objects ?? []

  const filteredEvents = events.filter(
    (e) => e.sceneId === selectedSceneId && (selectedObjId ? e.objectId === selectedObjId : true)
  )

  const handleAddAction = () => {
    setForm((f) => ({
      ...f,
      actions: [...f.actions, { type: 'show_dialog', value: '' }],
    }))
  }

  const handleRemoveAction = (idx: number) => {
    setForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }))
  }

  const handleSubmit = () => {
    if (!selectedSceneId || !selectedObjId) return
    const newEvent: EventTrigger = {
      id: `event-${Date.now()}`,
      sceneId: selectedSceneId,
      objectId: selectedObjId,
      trigger: form.trigger,
      actions: form.actions.map((a, i) => ({
        id: `action-${Date.now()}-${i}`,
        type: a.type,
        value: a.value,
        ...(a.entryX != null ? { entryX: a.entryX } : {}),
        ...(a.entryY != null ? { entryY: a.entryY } : {}),
        ...(a.entryFacing ? { entryFacing: a.entryFacing } : {}),
      })),
      enabled: true,
    }
    addEvent(newEvent)
    setShowForm(false)
    setForm({ trigger: 'click', actions: [{ type: 'navigate_scene', value: '' }] })
  }

  const handleDeleteAction = (eventId: string, actionId: string) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return
    updateEvent(eventId, {
      actions: event.actions.filter((a) => a.id !== actionId),
    })
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left panel: scene + object selection */}
      <div className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="px-3 py-2 border-b border-gray-700">
          <label className="text-xs text-gray-400 block mb-1">Scene</label>
          <select
            value={selectedSceneId}
            onChange={(e) => {
              setSelectedSceneId(e.target.value)
              setSelectedObjId(null)
            }}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
          >
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="px-3 py-2 border-b border-gray-700">
          <span className="text-xs text-gray-400 font-semibold">Objects</span>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          <div
            className={`px-3 py-2 cursor-pointer text-sm ${
              selectedObjId === null ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
            onClick={() => setSelectedObjId(null)}
          >
            All Objects
          </div>
          {sceneObjects.map((obj) => (
            <div
              key={obj.id}
              className={`px-3 py-2 cursor-pointer text-sm truncate ${
                selectedObjId === obj.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => setSelectedObjId(obj.id)}
            >
              {obj.name}
            </div>
          ))}
          {sceneObjects.length === 0 && (
            <p className="text-gray-500 text-xs px-3 py-2">No objects in scene</p>
          )}
        </div>
      </div>

      {/* Center: event list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div>
            <h2 className="text-gray-100 font-semibold">Events</h2>
            <p className="text-gray-400 text-xs">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
              {selectedObjId && ` for ${sceneObjects.find((o) => o.id === selectedObjId)?.name}`}
            </p>
          </div>
          <button
            onClick={() => {
              if (!selectedObjId) {
                alert('Select an object first to add an event.')
                return
              }
              setShowForm(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm"
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
                Select an object and click "Add Event" to create game logic
              </p>
            </div>
          )}

          {filteredEvents.map((event) => {
            const objName = sceneObjects.find((o) => o.id === event.objectId)?.name ?? event.objectId
            const isExpanded = expandedEventId === event.id
            return (
              <div key={event.id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${
                      TRIGGER_COLORS[event.trigger]
                    }`}
                  >
                    {TRIGGER_LABELS[event.trigger]}
                  </span>
                  <span className="text-gray-300 text-sm flex-1">
                    on <span className="font-medium text-gray-100">{objName}</span>
                  </span>
                  <span className="text-gray-500 text-xs">
                    {event.actions.length} action{event.actions.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                    className="text-gray-400 hover:text-gray-200"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-700 px-4 py-3 space-y-2">
                    {event.actions.map((action: EventAction) => (
                      <div
                        key={action.id}
                        className="flex items-center gap-3 bg-gray-750 bg-gray-900 rounded px-3 py-2"
                      >
                        <span className="text-gray-300 text-sm font-medium flex-1">
                          {ACTION_LABELS[action.type]}
                        </span>
                        {action.value && (
                          <span className="text-gray-400 text-xs bg-gray-700 px-2 py-0.5 rounded">
                            {action.value}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteAction(event.id, action.id)}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newAction: EventAction = {
                          id: `action-${Date.now()}`,
                          type: 'show_dialog',
                          value: '',
                        }
                        updateEvent(event.id, {
                          actions: [...event.actions, newAction],
                        })
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

      {/* Add Event Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-xl w-[480px] max-h-[80vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-gray-100 font-semibold text-lg">Add Event</h3>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Trigger</label>
              <select
                value={form.trigger}
                onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value as TriggerType }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400 font-semibold">Actions</label>
                <button
                  onClick={handleAddAction}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              {form.actions.map((action, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <select
                      value={action.type}
                      onChange={(e) => {
                        const updated = [...form.actions]
                        updated[idx] = { ...updated[idx], type: e.target.value as ActionType }
                        setForm((f) => ({ ...f, actions: updated }))
                      }}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                    >
                      {(Object.keys(ACTION_LABELS) as ActionType[]).map((a) => (
                        <option key={a} value={a}>
                          {ACTION_LABELS[a]}
                        </option>
                      ))}
                    </select>
                    {action.type === 'play_cinematic' ? (
                      <select
                        value={action.value}
                        onChange={(e) => {
                          const updated = [...form.actions]
                          updated[idx] = { ...updated[idx], value: e.target.value }
                          setForm((f) => ({ ...f, actions: updated }))
                        }}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">— select cinematic —</option>
                        {cinematics.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : action.type === 'launch_minigame' ? (
                      <select
                        value={action.value}
                        onChange={(e) => {
                          const updated = [...form.actions]
                          updated[idx] = { ...updated[idx], value: e.target.value }
                          setForm((f) => ({ ...f, actions: updated }))
                        }}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">— select mini-game —</option>
                        {miniGames.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    ) : action.type === 'navigate_scene' ? (
                      <div className="space-y-1.5">
                        <select
                          value={action.value}
                          onChange={(e) => {
                            const updated = [...form.actions]
                            updated[idx] = { ...updated[idx], value: e.target.value }
                            setForm((f) => ({ ...f, actions: updated }))
                          }}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">— select scene —</option>
                          {scenes.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <div className="border border-gray-600 rounded p-2 bg-gray-800 space-y-1.5">
                          <p className="text-xs text-gray-400 font-medium">Arrival Position <span className="text-gray-500 font-normal">— where the hero appears in the destination scene</span></p>
                          <div className="flex gap-2">
                            <label className="flex items-center gap-1 flex-1 text-xs text-gray-400">
                              X
                              <input
                                type="number"
                                placeholder="—"
                                value={action.entryX ?? ''}
                                onChange={(e) => {
                                  const updated = [...form.actions]
                                  const val = e.target.value === '' ? undefined : Number(e.target.value)
                                  updated[idx] = { ...updated[idx], entryX: val }
                                  setForm((f) => ({ ...f, actions: updated }))
                                }}
                                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 w-0"
                              />
                            </label>
                            <label className="flex items-center gap-1 flex-1 text-xs text-gray-400">
                              Y
                              <input
                                type="number"
                                placeholder="—"
                                value={action.entryY ?? ''}
                                onChange={(e) => {
                                  const updated = [...form.actions]
                                  const val = e.target.value === '' ? undefined : Number(e.target.value)
                                  updated[idx] = { ...updated[idx], entryY: val }
                                  setForm((f) => ({ ...f, actions: updated }))
                                }}
                                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 w-0"
                              />
                            </label>
                            <select
                              value={action.entryFacing ?? ''}
                              onChange={(e) => {
                                const updated = [...form.actions]
                                const val = e.target.value as FacingDirection | ''
                                updated[idx] = { ...updated[idx], entryFacing: val || undefined }
                                setForm((f) => ({ ...f, actions: updated }))
                              }}
                              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="">facing —</option>
                              <option value="down">↓ down</option>
                              <option value="up">↑ up</option>
                              <option value="left">← left</option>
                              <option value="right">→ right</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : action.type === 'set_variable' ? (
                      (() => {
                        const eqIdx = action.value.indexOf('=')
                        const varName = eqIdx !== -1 ? action.value.slice(0, eqIdx) : action.value
                        const varVal  = eqIdx !== -1 ? action.value.slice(eqIdx + 1) : ''
                        const setVarValue = (name: string, val: string) => {
                          const updated = [...form.actions]
                          updated[idx] = { ...updated[idx], value: `${name}=${val}` }
                          setForm((f) => ({ ...f, actions: updated }))
                        }
                        return (
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                list={`var-names-${idx}`}
                                value={varName}
                                onChange={(e) => setVarValue(e.target.value, varVal)}
                                placeholder="variableName"
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 font-mono"
                              />
                              <datalist id={`var-names-${idx}`}>
                                {allStageVarNames.map((n) => <option key={n} value={n} />)}
                              </datalist>
                            </div>
                            <span className="text-gray-500 self-center">=</span>
                            <input
                              type="text"
                              value={varVal}
                              onChange={(e) => setVarValue(varName, e.target.value)}
                              placeholder="value"
                              className="w-28 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        )
                      })()
                    ) : (
                      <input
                        type="text"
                        placeholder="Value"
                        value={action.value}
                        onChange={(e) => {
                          const updated = [...form.actions]
                          updated[idx] = { ...updated[idx], value: e.target.value }
                          setForm((f) => ({ ...f, actions: updated }))
                        }}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveAction(idx)}
                    className="mt-1 text-gray-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
