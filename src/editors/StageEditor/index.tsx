import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, BookOpen } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { Stage, StageVariable } from '../../types'

export function StageEditor() {
  const { project, addStage, updateStage, deleteStage, reorderStages } = useGameStore()
  const { stages, scenes } = project

  const [selectedStageId, setSelectedStageId] = useState<string>(stages[0]?.id ?? '')

  const selectedStage = stages.find((s) => s.id === selectedStageId)
  const sortedStages = [...stages].sort((a, b) => a.order - b.order)

  const handleAddStage = () => {
    const id = `stage-${Date.now()}`
    const newStage: Stage = {
      id,
      name: `Stage ${stages.length + 1}`,
      order: stages.length,
      startingSceneId: scenes[0]?.id ?? '',
      sceneIds: [],
      description: '',
    }
    addStage(newStage)
    setSelectedStageId(id)
  }

  const handleDeleteStage = (id: string) => {
    if (stages.length <= 1) return
    deleteStage(id)
    if (selectedStageId === id) {
      setSelectedStageId(stages.find((s) => s.id !== id)?.id ?? '')
    }
  }

  const moveStage = (id: string, dir: -1 | 1) => {
    const sorted = [...stages].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((s) => s.id === id)
    if (idx < 0) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= sorted.length) return
    const reordered = [...sorted]
    ;[reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]]
    reorderStages(reordered.map((s, i) => ({ ...s, order: i })))
  }

  const toggleSceneAssignment = (sceneId: string) => {
    if (!selectedStage) return
    const sceneIds = selectedStage.sceneIds.includes(sceneId)
      ? selectedStage.sceneIds.filter((id) => id !== sceneId)
      : [...selectedStage.sceneIds, sceneId]
    updateStage(selectedStage.id, { sceneIds })
  }

  const handleAddVariable = () => {
    if (!selectedStage) return
    const newVar: StageVariable = {
      id: `var-${Date.now()}`,
      name: `variable${(selectedStage.variables?.length ?? 0) + 1}`,
      type: 'string',
      defaultValue: '',
    }
    updateStage(selectedStage.id, { variables: [...(selectedStage.variables ?? []), newVar] })
  }

  const handleUpdateVariable = (varId: string, updates: Partial<StageVariable>) => {
    if (!selectedStage) return
    updateStage(selectedStage.id, {
      variables: (selectedStage.variables ?? []).map((v) => v.id === varId ? { ...v, ...updates } : v),
    })
  }

  const handleDeleteVariable = (varId: string) => {
    if (!selectedStage) return
    updateStage(selectedStage.id, {
      variables: (selectedStage.variables ?? []).filter((v) => v.id !== varId),
    })
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left: Stage List */}
      <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-indigo-400" />
            <span className="text-gray-300 text-sm font-semibold">Stages</span>
          </div>
          <button
            onClick={handleAddStage}
            className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
            title="Add Stage"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {sortedStages.map((stage, idx) => (
            <div
              key={stage.id}
              className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer group ${
                stage.id === selectedStageId
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => setSelectedStageId(stage.id)}
            >
              <span className="text-xs font-bold w-5 text-center opacity-50">{idx + 1}</span>
              <span className="text-sm truncate flex-1">{stage.name}</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => { e.stopPropagation(); moveStage(stage.id, -1) }}
                  disabled={idx === 0}
                  className="p-0.5 rounded hover:bg-gray-600 disabled:opacity-30"
                >
                  <ChevronUp size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveStage(stage.id, 1) }}
                  disabled={idx === sortedStages.length - 1}
                  className="p-0.5 rounded hover:bg-gray-600 disabled:opacity-30"
                >
                  <ChevronDown size={11} />
                </button>
                {stages.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteStage(stage.id) }}
                    className="p-0.5 rounded hover:bg-red-600"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Stage Details */}
      <div className="flex-1 overflow-y-auto p-8">
        {selectedStage ? (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-gray-100 text-2xl font-bold">{selectedStage.name}</h2>
              <p className="text-gray-400 text-sm mt-1">
                Stage {sortedStages.findIndex((s) => s.id === selectedStage.id) + 1} of {stages.length}
              </p>
            </div>

            {/* Basic Info */}
            <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
              <h3 className="text-gray-200 font-semibold">Stage Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Stage Name</label>
                  <input
                    type="text"
                    value={selectedStage.name}
                    onChange={(e) => updateStage(selectedStage.id, { name: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Starting Scene</label>
                  <select
                    value={selectedStage.startingSceneId}
                    onChange={(e) => updateStage(selectedStage.id, { startingSceneId: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— None —</option>
                    {scenes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Description</label>
                <textarea
                  value={selectedStage.description}
                  onChange={(e) => updateStage(selectedStage.id, { description: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Describe this stage..."
                />
              </div>
            </section>

            {/* Scene Assignment */}
            <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-gray-200 font-semibold">Assigned Scenes</h3>
                <p className="text-gray-400 text-xs mt-1">
                  Select which scenes are part of this stage
                </p>
              </div>

              {scenes.length === 0 ? (
                <p className="text-gray-500 text-sm">No scenes available. Create scenes in the Scene Editor first.</p>
              ) : (
                <div className="space-y-2">
                  {scenes.map((scene) => {
                    const assigned = selectedStage.sceneIds.includes(scene.id)
                    return (
                      <label
                        key={scene.id}
                        className="flex items-center gap-3 px-4 py-3 bg-gray-700 hover:bg-gray-650 rounded-lg cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={assigned}
                          onChange={() => toggleSceneAssignment(scene.id)}
                          className="rounded text-indigo-500 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <span className="text-gray-200 text-sm">{scene.name}</span>
                          <span className="ml-2 text-gray-500 text-xs">
                            {scene.width}×{scene.height} · {scene.objects.length} object{scene.objects.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {selectedStage.startingSceneId === scene.id && (
                          <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                            Starting Scene
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}

              <div className="pt-2 text-xs text-gray-400">
                {selectedStage.sceneIds.length} scene{selectedStage.sceneIds.length !== 1 ? 's' : ''} assigned to this stage
              </div>
            </section>

            {/* Stage Variables */}
            <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-gray-200 font-semibold">Stage Variables</h3>
                  <p className="text-gray-400 text-xs mt-1">
                    Variables initialised when this stage starts. Set them in events; check them in goals.
                  </p>
                </div>
                <button
                  onClick={handleAddVariable}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm"
                >
                  <Plus size={14} /> Add Variable
                </button>
              </div>

              {(selectedStage.variables ?? []).length === 0 ? (
                <p className="text-gray-500 text-sm">No variables defined. Add one to track game state for this stage.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-1 mb-1">
                    <span className="col-span-4 text-xs text-gray-500 uppercase tracking-wide">Name</span>
                    <span className="col-span-3 text-xs text-gray-500 uppercase tracking-wide">Type</span>
                    <span className="col-span-4 text-xs text-gray-500 uppercase tracking-wide">Default Value</span>
                  </div>
                  {(selectedStage.variables ?? []).map((v) => (
                    <div key={v.id} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={v.name}
                        onChange={(e) => handleUpdateVariable(v.id, { name: e.target.value })}
                        placeholder="variableName"
                        className="col-span-4 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <select
                        value={v.type}
                        onChange={(e) => handleUpdateVariable(v.id, { type: e.target.value as StageVariable['type'], defaultValue: '' })}
                        className="col-span-3 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                      </select>
                      {v.type === 'boolean' ? (
                        <select
                          value={v.defaultValue}
                          onChange={(e) => handleUpdateVariable(v.id, { defaultValue: e.target.value })}
                          className="col-span-4 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </select>
                      ) : (
                        <input
                          type={v.type === 'number' ? 'number' : 'text'}
                          value={v.defaultValue}
                          onChange={(e) => handleUpdateVariable(v.id, { defaultValue: e.target.value })}
                          placeholder={v.type === 'number' ? '0' : '""'}
                          className="col-span-4 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      )}
                      <button
                        onClick={() => handleDeleteVariable(v.id)}
                        className="col-span-1 flex justify-center text-gray-500 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BookOpen size={64} className="text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg font-medium">No stage selected</p>
            <p className="text-gray-500 text-sm mt-1">Select a stage from the list or create a new one</p>
            <button
              onClick={handleAddStage}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm"
            >
              <Plus size={16} /> Add Stage
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
