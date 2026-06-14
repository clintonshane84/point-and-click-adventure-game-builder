import { useState } from 'react'
import { Plus, Trash2, Target, ChevronDown, ChevronUp } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type {
  Goal,
  GoalCondition,
  GoalConditionType,
  ConditionOperator,
  GoalLogic,
  GoalCompletionAction,
} from '../../types'

const CONDITION_TYPES: { value: GoalConditionType; label: string }[] = [
  { value: 'variable_equals', label: 'Variable Equals' },
  { value: 'scene_visited', label: 'Scene Visited' },
  { value: 'item_collected', label: 'Item Collected' },
  { value: 'event_triggered', label: 'Event Triggered' },
]

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '≠' },
  { value: 'greater_than', label: '>' },
  { value: 'less_than', label: '<' },
  { value: 'contains', label: 'contains' },
]

const COMPLETION_ACTIONS: { value: GoalCompletionAction; label: string }[] = [
  { value: 'advance_stage', label: 'Advance to Next Stage' },
  { value: 'end_game', label: 'End Game' },
  { value: 'show_dialog', label: 'Show Dialog' },
]

export function GoalEditor() {
  const { project, addGoal, updateGoal, deleteGoal, addGoalCondition, updateGoalCondition, deleteGoalCondition } =
    useGameStore()
  const { stages, goals } = project

  const [selectedStageId, setSelectedStageId] = useState<string>(stages[0]?.id ?? '')
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalForm, setGoalForm] = useState({
    name: '',
    description: '',
    logic: 'AND' as GoalLogic,
    completionAction: 'advance_stage' as GoalCompletionAction,
    completionValue: '',
  })

  const stageGoals = goals.filter((g) => g.stageId === selectedStageId)

  const handleAddGoal = () => {
    if (!selectedStageId) return
    const goal: Goal = {
      id: `goal-${Date.now()}`,
      stageId: selectedStageId,
      name: goalForm.name || `Goal ${stageGoals.length + 1}`,
      description: goalForm.description,
      conditions: [],
      logic: goalForm.logic,
      completionAction: goalForm.completionAction,
      completionValue: goalForm.completionValue,
      completed: false,
    }
    addGoal(goal)
    setShowGoalForm(false)
    setGoalForm({ name: '', description: '', logic: 'AND', completionAction: 'advance_stage', completionValue: '' })
    setExpandedGoalId(goal.id)
  }

  const handleAddCondition = (goalId: string) => {
    const condition: GoalCondition = {
      id: `cond-${Date.now()}`,
      type: 'variable_equals',
      target: '',
      operator: 'equals',
      value: '',
    }
    addGoalCondition(goalId, condition)
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left: Stage selector */}
      <div className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold">Stage</span>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {stages
            .sort((a, b) => a.order - b.order)
            .map((stage) => (
              <div
                key={stage.id}
                className={`px-3 py-2.5 cursor-pointer text-sm ${
                  stage.id === selectedStageId
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => setSelectedStageId(stage.id)}
              >
                <div className="font-medium">{stage.name}</div>
                <div className="text-xs opacity-60 mt-0.5">
                  {goals.filter((g) => g.stageId === stage.id).length} goal{goals.filter((g) => g.stageId === stage.id).length !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          {stages.length === 0 && (
            <p className="text-gray-500 text-xs px-3 py-2">No stages. Create stages in Stage Editor.</p>
          )}
        </div>
      </div>

      {/* Center: Goals list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div>
            <h2 className="text-gray-100 font-semibold">
              Goals for {stages.find((s) => s.id === selectedStageId)?.name ?? 'Stage'}
            </h2>
            <p className="text-gray-400 text-xs">
              {stageGoals.length} goal{stageGoals.length !== 1 ? 's' : ''} defined
            </p>
          </div>
          <button
            onClick={() => setShowGoalForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm"
          >
            <Plus size={14} /> Add Goal
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {stageGoals.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Target size={48} className="text-gray-600 mb-3" />
              <p className="text-gray-400 font-medium">No goals for this stage</p>
              <p className="text-gray-500 text-sm mt-1">Click "Add Goal" to define completion conditions</p>
            </div>
          )}

          {stageGoals.map((goal) => {
            const isExpanded = expandedGoalId === goal.id
            return (
              <div key={goal.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                {/* Goal Header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Target size={16} className="text-indigo-400 shrink-0" />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={goal.name}
                      onChange={(e) => updateGoal(goal.id, { name: e.target.value })}
                      className="bg-transparent text-gray-100 font-medium text-sm focus:outline-none focus:bg-gray-700 px-1 rounded w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      goal.completionAction === 'advance_stage'
                        ? 'bg-green-600 text-white'
                        : goal.completionAction === 'end_game'
                        ? 'bg-red-600 text-white'
                        : 'bg-blue-600 text-white'
                    }`}>
                      {COMPLETION_ACTIONS.find((a) => a.value === goal.completionAction)?.label}
                    </span>
                    <span className="text-xs text-gray-400">{goal.conditions.length} conditions</span>
                    <button
                      onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                      className="text-gray-400 hover:text-gray-200"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-700 px-4 py-4 space-y-4">
                    {/* Settings Row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Logic</label>
                        <select
                          value={goal.logic}
                          onChange={(e) => updateGoal(goal.id, { logic: e.target.value as GoalLogic })}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="AND">AND (all must pass)</option>
                          <option value="OR">OR (any can pass)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">On Complete</label>
                        <select
                          value={goal.completionAction}
                          onChange={(e) =>
                            updateGoal(goal.id, { completionAction: e.target.value as GoalCompletionAction })
                          }
                          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                        >
                          {COMPLETION_ACTIONS.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Value / Message</label>
                        <input
                          type="text"
                          value={goal.completionValue}
                          onChange={(e) => updateGoal(goal.id, { completionValue: e.target.value })}
                          placeholder="Optional..."
                          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Conditions */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                          Conditions ({goal.logic})
                        </span>
                        <button
                          onClick={() => handleAddCondition(goal.id)}
                          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          <Plus size={12} /> Add Condition
                        </button>
                      </div>

                      <div className="space-y-2">
                        {goal.conditions.map((cond, idx) => (
                          <div key={cond.id} className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
                            {goal.conditions.length > 1 && idx > 0 && (
                              <span className="text-xs text-indigo-400 font-semibold w-8 shrink-0 text-center">
                                {goal.logic}
                              </span>
                            )}
                            <select
                              value={cond.type}
                              onChange={(e) =>
                                updateGoalCondition(goal.id, cond.id, { type: e.target.value as GoalConditionType })
                              }
                              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                            >
                              {CONDITION_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Target / variable name"
                              value={cond.target}
                              onChange={(e) =>
                                updateGoalCondition(goal.id, cond.id, { target: e.target.value })
                              }
                              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                            />
                            <select
                              value={cond.operator}
                              onChange={(e) =>
                                updateGoalCondition(goal.id, cond.id, { operator: e.target.value as ConditionOperator })
                              }
                              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500 w-20"
                            >
                              {OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Value"
                              value={cond.value}
                              onChange={(e) =>
                                updateGoalCondition(goal.id, cond.id, { value: e.target.value })
                              }
                              className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              onClick={() => deleteGoalCondition(goal.id, cond.id)}
                              className="text-gray-500 hover:text-red-400 shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                        {goal.conditions.length === 0 && (
                          <p className="text-gray-500 text-xs text-center py-3">
                            No conditions. Add at least one to define when this goal is complete.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Description (optional)</label>
                      <input
                        type="text"
                        value={goal.description}
                        onChange={(e) => updateGoal(goal.id, { description: e.target.value })}
                        placeholder="Describe this goal..."
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Goal Modal */}
      {showGoalForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-xl w-[480px] p-6 space-y-4">
            <h3 className="text-gray-100 font-semibold text-lg">Add Goal</h3>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Goal Name</label>
              <input
                type="text"
                placeholder="e.g. Collect all items"
                value={goalForm.name}
                onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Description</label>
              <input
                type="text"
                placeholder="Optional description..."
                value={goalForm.description}
                onChange={(e) => setGoalForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Logic</label>
                <select
                  value={goalForm.logic}
                  onChange={(e) => setGoalForm((f) => ({ ...f, logic: e.target.value as GoalLogic }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">On Complete</label>
                <select
                  value={goalForm.completionAction}
                  onChange={(e) =>
                    setGoalForm((f) => ({ ...f, completionAction: e.target.value as GoalCompletionAction }))
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  {COMPLETION_ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowGoalForm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddGoal}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
              >
                Add Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
