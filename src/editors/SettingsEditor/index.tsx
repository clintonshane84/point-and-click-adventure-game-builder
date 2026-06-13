import { useState } from 'react'
import { Plus, Trash2, Save, Settings } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { PlayerSetting, PlayerSettingType } from '../../types'

const RESOLUTIONS = [
  { label: '1280×720 (HD)', w: 1280, h: 720 },
  { label: '1280×768', w: 1280, h: 768 },
  { label: '1920×1080 (Full HD)', w: 1920, h: 1080 },
  { label: '800×600', w: 800, h: 600 },
  { label: '1024×768', w: 1024, h: 768 },
]

export function SettingsEditor() {
  const { project, updateSettings } = useGameStore()
  const { settings, scenes } = project

  const [form, setForm] = useState({ ...settings })
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    updateSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAddPlayerSetting = () => {
    const newSetting: PlayerSetting = {
      id: `ps-${Date.now()}`,
      name: `setting_${form.playerSettings.length + 1}`,
      type: 'number',
      defaultValue: '0',
    }
    setForm((f) => ({ ...f, playerSettings: [...f.playerSettings, newSetting] }))
  }

  const handleUpdatePlayerSetting = (id: string, updates: Partial<PlayerSetting>) => {
    setForm((f) => ({
      ...f,
      playerSettings: f.playerSettings.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }))
  }

  const handleDeletePlayerSetting = (id: string) => {
    setForm((f) => ({
      ...f,
      playerSettings: f.playerSettings.filter((s) => s.id !== id),
    }))
  }

  return (
    <div className="flex h-full bg-gray-900 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <Settings size={28} className="text-indigo-400" />
          <div>
            <h1 className="text-gray-100 text-2xl font-bold">Game Settings</h1>
            <p className="text-gray-400 text-sm">Configure global game metadata and player preferences</p>
          </div>
        </div>

        {/* Game Metadata */}
        <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6 space-y-4">
          <h2 className="text-gray-200 font-semibold text-lg">Game Metadata</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Game Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Author</label>
              <input
                type="text"
                value={form.author}
                onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Version</label>
              <input
                type="text"
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Save Slots</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.saveSlotCount}
                onChange={(e) => setForm((f) => ({ ...f, saveSlotCount: parseInt(e.target.value) || 1 }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </section>

        {/* Display Settings */}
        <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6 space-y-4">
          <h2 className="text-gray-200 font-semibold text-lg">Display</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Resolution</label>
              <select
                value={`${form.resolutionWidth}x${form.resolutionHeight}`}
                onChange={(e) => {
                  const res = RESOLUTIONS.find((r) => `${r.w}x${r.h}` === e.target.value)
                  if (res) setForm((f) => ({ ...f, resolutionWidth: res.w, resolutionHeight: res.h }))
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                {RESOLUTIONS.map((r) => (
                  <option key={`${r.w}x${r.h}`} value={`${r.w}x${r.h}`}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Starting Scene</label>
              <select
                value={form.startingSceneId}
                onChange={(e) => setForm((f) => ({ ...f, startingSceneId: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 text-sm text-gray-400">
            <span>Width:</span>
            <input
              type="number"
              value={form.resolutionWidth}
              onChange={(e) => setForm((f) => ({ ...f, resolutionWidth: parseInt(e.target.value) || 1280 }))}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            />
            <span>Height:</span>
            <input
              type="number"
              value={form.resolutionHeight}
              onChange={(e) => setForm((f) => ({ ...f, resolutionHeight: parseInt(e.target.value) || 720 }))}
              className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </section>

        {/* Player Settings */}
        <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-gray-200 font-semibold text-lg">Player Settings</h2>
            <button
              onClick={handleAddPlayerSetting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm"
            >
              <Plus size={14} /> Add Variable
            </button>
          </div>

          {form.playerSettings.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">
              No player settings defined. Add variables to track player state, scores, flags, etc.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-xs text-gray-400 pb-2 pr-4">Name</th>
                    <th className="text-left text-xs text-gray-400 pb-2 pr-4">Type</th>
                    <th className="text-left text-xs text-gray-400 pb-2 pr-4">Default</th>
                    <th className="text-left text-xs text-gray-400 pb-2 pr-4">Min</th>
                    <th className="text-left text-xs text-gray-400 pb-2 pr-4">Max</th>
                    <th className="text-left text-xs text-gray-400 pb-2"></th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  {form.playerSettings.map((ps) => (
                    <tr key={ps.id} className="border-b border-gray-700">
                      <td className="pr-4 py-2">
                        <input
                          type="text"
                          value={ps.name}
                          onChange={(e) => handleUpdatePlayerSetting(ps.id, { name: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="pr-4 py-2">
                        <select
                          value={ps.type}
                          onChange={(e) =>
                            handleUpdatePlayerSetting(ps.id, { type: e.target.value as PlayerSettingType })
                          }
                          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                          <option value="string">String</option>
                        </select>
                      </td>
                      <td className="pr-4 py-2">
                        <input
                          type="text"
                          value={ps.defaultValue}
                          onChange={(e) => handleUpdatePlayerSetting(ps.id, { defaultValue: e.target.value })}
                          className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="pr-4 py-2">
                        {ps.type === 'number' && (
                          <input
                            type="number"
                            value={ps.min ?? ''}
                            onChange={(e) =>
                              handleUpdatePlayerSetting(ps.id, {
                                min: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                          />
                        )}
                      </td>
                      <td className="pr-4 py-2">
                        {ps.type === 'number' && (
                          <input
                            type="number"
                            value={ps.max ?? ''}
                            onChange={(e) =>
                              handleUpdatePlayerSetting(ps.id, {
                                max: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                          />
                        )}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleDeletePlayerSetting(ps.id)}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-2.5 rounded font-medium text-sm transition-colors ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <Save size={16} />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
