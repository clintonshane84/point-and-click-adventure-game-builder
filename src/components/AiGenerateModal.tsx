import { useState } from 'react'
import { Sparkles, X, Loader2 } from 'lucide-react'
import { generateImageWithDalle } from '../lib/aiImageGeneration'
import { useAiStore } from '../store/useAiStore'

interface Props {
  title: string
  onGenerated: (dataUrl: string, prompt: string) => void
  onClose: () => void
}

export function AiGenerateModal({ title, onGenerated, onClose }: Props) {
  const { settings } = useAiStore()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    try {
      const dataUrl = await generateImageWithDalle(prompt.trim(), settings.apiKey)
      onGenerated(dataUrl, prompt.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-xl w-[480px] p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            <h3 className="text-gray-100 font-semibold">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1.5">
            Describe the image you want to generate
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate() }}
            placeholder="e.g. A dark forest scene with fog, pixelated style, side view, point-and-click adventure game background"
            rows={4}
            disabled={loading}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-1">Ctrl+Enter to generate</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="text-xs text-gray-500 bg-gray-900/50 rounded p-2">
          Provider: OpenAI DALL-E 3 · 1024×1024 · Uses your API key
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
