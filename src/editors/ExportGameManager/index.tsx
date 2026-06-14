import { useState } from 'react'
import {
  Download,
  Package,
  CheckCircle,
  AlertCircle,
  FileCode,
  Folder,
  ChevronRight,
  Loader,
  Info,
} from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { generateGameZip, downloadBlob } from '../../game-runtime/generateZip'

type ExportStatus = 'idle' | 'building' | 'done' | 'error'

interface ProjectFile {
  path: string
  description: string
}

const PROJECT_FILES: ProjectFile[] = [
  { path: 'package.json', description: 'Vite project manifest with dev/build/preview scripts' },
  { path: 'vite.config.js', description: 'Vite configuration — outputs to dist/' },
  { path: 'index.html', description: 'Entry HTML with canvas sized to your resolution' },
  { path: 'src/engine.js', description: 'Standalone game runtime engine (no dependencies)' },
  { path: 'src/game-data.json', description: 'Serialized game project (scenes, events, assets)' },
  { path: 'src/main.js', description: 'Wires engine to canvas and starts the game' },
  { path: 'src/style.css', description: 'Base canvas centering styles' },
  { path: 'README.md', description: 'Setup instructions for building & deploying' },
]

export function ExportGameManager() {
  const project = useGameStore((s) => s.project)
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [exportedName, setExportedName] = useState('')

  const title = project.settings.title || 'My Adventure Game'
  const w = project.settings.resolutionWidth || 1280
  const h = project.settings.resolutionHeight || 720

  async function handleExport() {
    setStatus('building')
    setErrorMsg('')
    try {
      const blob = await generateGameZip(project)
      const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`
      downloadBlob(blob, filename)
      setExportedName(filename)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  const hasScenes = project.scenes.length > 0
  const startScene = project.scenes.find((s) => s.id === project.settings.startingSceneId)
    ?? project.scenes[0]

  return (
    <div className="flex h-full overflow-hidden bg-gray-950 text-gray-100">
      {/* Left panel — export controls */}
      <div className="w-80 shrink-0 flex flex-col border-r border-gray-700 bg-gray-900">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="font-semibold text-gray-100 flex items-center gap-2">
            <Package size={16} className="text-indigo-400" />
            Export Game
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Generates a Vite project ZIP ready to build and serve.
          </p>
        </div>

        {/* Project summary */}
        <div className="p-4 border-b border-gray-700 space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project</h3>
          <SummaryRow label="Title" value={title} />
          <SummaryRow label="Author" value={project.settings.author || '—'} />
          <SummaryRow label="Version" value={project.settings.version || '1.0.0'} />
          <SummaryRow label="Resolution" value={`${w} × ${h}`} />
          <SummaryRow label="Scenes" value={String(project.scenes.length)} />
          <SummaryRow label="Events" value={String(project.events.length)} />
          <SummaryRow label="Assets" value={String(project.assets.length)} />
          <SummaryRow
            label="Start Scene"
            value={startScene?.name ?? 'None — set in Settings'}
            warn={!startScene}
          />
        </div>

        {/* Warnings */}
        {!hasScenes && (
          <div className="mx-4 my-3 flex items-start gap-2 p-3 rounded bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-xs">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>No scenes created yet. Add scenes in the Scene Editor before exporting.</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Export button */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleExport}
            disabled={status === 'building'}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'building' ? (
              <>
                <Loader size={16} className="animate-spin" />
                Building ZIP…
              </>
            ) : (
              <>
                <Download size={16} />
                Export as ZIP
              </>
            )}
          </button>

          {status === 'done' && (
            <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle size={16} />
              <span>
                <strong>{exportedName}</strong> downloaded
              </span>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-3 flex items-start gap-2 text-red-400 text-sm">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — info & file tree */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* How it works */}
        <section>
          <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <Info size={14} className="text-indigo-400" />
            How it works
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {[
              {
                step: '1',
                title: 'Export ZIP',
                desc: 'Click "Export as ZIP" to download a complete Vite project containing your game data and the standalone runtime engine.',
              },
              {
                step: '2',
                title: 'Install & Run',
                desc: 'Unzip, open a terminal inside the folder, then run npm install && npm run dev to preview on localhost.',
              },
              {
                step: '3',
                title: 'Build for production',
                desc: 'Run npm run build to generate a dist/ folder of static HTML + JS files deployable on any HTTP server or CDN.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-3 p-3 rounded-lg bg-gray-900 border border-gray-700">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-100">{item.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* File tree */}
        <section>
          <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <Folder size={14} className="text-indigo-400" />
            Generated project structure
          </h3>
          <div className="rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 text-xs text-gray-400 font-mono">
              {title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/
            </div>
            {PROJECT_FILES.map((f) => (
              <div
                key={f.path}
                className="flex items-start gap-3 px-3 py-2 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors"
              >
                <ChevronRight size={12} className="text-gray-600 shrink-0 mt-1" />
                <FileCode size={13} className="text-indigo-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-mono text-gray-200">{f.path}</p>
                  <p className="text-xs text-gray-500">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick-start snippet */}
        <section>
          <h3 className="text-sm font-semibold text-gray-200 mb-2">Quick start</h3>
          <pre className="text-xs text-green-300 bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto leading-relaxed">
{`# 1. Unzip and enter the folder
unzip ${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip
cd ${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}

# 2. Install Vite
npm install

# 3. Live development preview
npm run dev

# 4. Production build → dist/
npm run build

# 5. Serve production build locally
npm run preview`}
          </pre>
        </section>
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  warn = false,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs font-medium truncate max-w-[160px] ${warn ? 'text-yellow-400' : 'text-gray-200'}`}>
        {value}
      </span>
    </div>
  )
}
