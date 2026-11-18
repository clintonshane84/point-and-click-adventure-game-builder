import { useState } from 'react'
import { Plus, Trash2, ScrollText } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { Quest, QuestObjective } from '../../types'

export function QuestEditor() {
  const { project, addQuest, updateQuest, deleteQuest, addQuestObjective, updateQuestObjective, deleteQuestObjective } =
    useGameStore()
  const quests = project.quests ?? []

  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(quests[0]?.id ?? null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  const selected = quests.find((q) => q.id === selectedQuestId) ?? null

  const handleAdd = () => {
    const quest: Quest = {
      id: `quest-${Date.now()}`,
      name: form.name || `Quest ${quests.length + 1}`,
      description: form.description,
      objectives: [],
    }
    addQuest(quest)
    setSelectedQuestId(quest.id)
    setShowForm(false)
    setForm({ name: '', description: '' })
  }

  const handleAddObjective = () => {
    if (!selected) return
    const obj: QuestObjective = { id: `obj-${Date.now()}`, text: '' }
    addQuestObjective(selected.id, obj)
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left panel — quest list */}
      <div className="w-64 flex-shrink-0 border-r border-gray-700 flex flex-col">
        <div className="p-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText size={16} className="text-indigo-400" />
            <span className="text-sm font-semibold text-gray-200">Quests</span>
          </div>
          <button
            onClick={() => setShowForm((f) => !f)}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        {showForm && (
          <div className="p-3 border-b border-gray-700 space-y-2 bg-gray-800">
            <input
              type="text" placeholder="Quest name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            />
            <textarea
              placeholder="Description"
              value={form.description}
              rows={2}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded py-1.5"
              >
                Create Quest
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-3 text-xs text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {quests.length === 0 ? (
            <p className="text-xs text-gray-500 p-4">No quests defined. Click Add to create one.</p>
          ) : (
            quests.map((quest) => (
              <button
                key={quest.id}
                onClick={() => setSelectedQuestId(quest.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-800 transition-colors ${
                  selectedQuestId === quest.id
                    ? 'bg-indigo-900/40 text-indigo-200'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <p className="text-sm font-medium truncate">{quest.name}</p>
                {quest.description && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{quest.description}</p>
                )}
                <p className="text-xs text-gray-600 mt-0.5">
                  {(quest.objectives ?? []).length} objective{(quest.objectives ?? []).length !== 1 ? 's' : ''}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel — quest form */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Select a quest or create a new one.
          </div>
        ) : (
          <div className="p-6 max-w-xl space-y-6">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-gray-100">{selected.name}</h2>
              <button
                onClick={() => {
                  deleteQuest(selected.id)
                  setSelectedQuestId(quests.find((q) => q.id !== selected.id)?.id ?? null)
                }}
                className="text-gray-500 hover:text-red-400 mt-0.5"
                title="Delete quest"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Name</label>
              <input
                type="text"
                value={selected.name}
                onChange={(e) => updateQuest(selected.id, { name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Description</label>
              <textarea
                value={selected.description}
                rows={3}
                onChange={(e) => updateQuest(selected.id, { description: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Describe this quest..."
              />
            </div>

            {/* Objectives */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Objectives</label>
                <button
                  onClick={handleAddObjective}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Plus size={12} /> Add objective
                </button>
              </div>
              {(selected.objectives ?? []).length === 0 ? (
                <p className="text-xs text-gray-600">No objectives — click "Add objective" to add one.</p>
              ) : (
                (selected.objectives ?? []).map((obj) => (
                  <div key={obj.id} className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">○</span>
                    <input
                      type="text"
                      value={obj.text}
                      placeholder="Objective description"
                      onChange={(e) => updateQuestObjective(selected.id, obj.id, { text: e.target.value })}
                      className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => deleteQuestObjective(selected.id, obj.id)}
                      className="text-gray-500 hover:text-red-400 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500">
                Quest ID: <span className="font-mono text-gray-400">{selected.id}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Use <span className="font-semibold text-gray-400">Add Quest</span> and{' '}
                <span className="font-semibold text-gray-400">Complete Quest</span> event actions to activate and complete this quest during gameplay.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
