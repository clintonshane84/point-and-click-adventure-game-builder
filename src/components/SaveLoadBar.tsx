import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Save, FolderOpen, FolderCog, Clock,
  CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'
import { useGameStore } from '../store/useGameStore'
import {
  saveProject, loadProject,
  autoSave, autoSaveToFile, getAutoSave,
  getSavedDirectoryName, changeProjectDirectory,
  fsaSupported,
} from '../lib/fileSystemStorage'

type OpStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'ok';  msg: string }
  | { type: 'err'; msg: string }

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function SaveLoadBar() {
  const project          = useGameStore((s) => s.project)
  const fileOpen         = useGameStore((s) => s.fileOpen)
  const loadStoreProject = useGameStore((s) => s.loadProject)
  const setFileOpen      = useGameStore((s) => s.setFileOpen)

  const [status, setStatus]         = useState<OpStatus>({ type: 'idle' })
  const [savedDir, setSavedDir]     = useState<string | null>(null)
  const [lastAutoSave, setLastAutoSave] = useState<string | null>(null)

  // Clear status automatically after 4 s
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showStatus(s: OpStatus) {
    setStatus(s)
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    if (s.type === 'ok' || s.type === 'err') {
      statusTimerRef.current = setTimeout(() => setStatus({ type: 'idle' }), 4000)
    }
  }

  // On mount: restore last session automatically if auto-save exists
  useEffect(() => {
    getSavedDirectoryName().then(setSavedDir)

    const saved = getAutoSave()
    if (saved?.project) {
      loadStoreProject(saved.project)
      setFileOpen(true)
      setLastAutoSave(saved.savedAt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save every 60 s — only while a file is open
  useEffect(() => {
    if (!fileOpen) return
    const id = setInterval(() => {
      autoSave(project)
      autoSaveToFile(project)
      setLastAutoSave(new Date().toISOString())
    }, 60_000)
    return () => clearInterval(id)
  }, [fileOpen, project])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    showStatus({ type: 'busy' })
    const result = await saveProject(project)
    if (!result.ok) {
      if (result.error === 'cancelled') { showStatus({ type: 'idle' }); return }
      showStatus({ type: 'err', msg: result.error })
      return
    }
    // Update displayed folder name when saving to a directory
    if (result.method === 'fsa-dir') {
      const dir = result.path.split('/')[0]
      setSavedDir(dir)
    }
    setFileOpen(true)
    autoSave(project)
    setLastAutoSave(new Date().toISOString())
    showStatus({
      type: 'ok',
      msg: result.method === 'download'
        ? `Downloaded ${result.path}`
        : `Saved — ${result.path}`,
    })
  }, [project, setFileOpen])

  // ── Load ──────────────────────────────────────────────────────────────────
  const handleLoad = useCallback(async () => {
    showStatus({ type: 'busy' })
    const result = await loadProject()
    if (!result.ok) {
      if (result.error === 'cancelled') { showStatus({ type: 'idle' }); return }
      showStatus({ type: 'err', msg: result.error })
      return
    }
    loadStoreProject(result.project)
    setFileOpen(true)
    showStatus({ type: 'ok', msg: `Loaded "${result.project.name}"` })
  }, [loadStoreProject, setFileOpen])

  // ── Change folder ─────────────────────────────────────────────────────────
  const handleChangeDir = useCallback(async () => {
    const dir = await changeProjectDirectory()
    if (dir) {
      setSavedDir(dir)
      showStatus({ type: 'ok', msg: `Save folder set to "${dir}"` })
    }
  }, [])

  const busy = status.type === 'busy'

  return (
    <>

      {/* ── Main toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-950 border-b border-gray-800 shrink-0 min-h-[40px]">

        {/* Project name */}
        <span className="text-sm font-semibold text-indigo-400 mr-1 max-w-[180px] truncate" title={project.name}>
          {project.name || 'Untitled Project'}
        </span>

        <div className="h-4 w-px bg-gray-700 mx-1" />

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
          title="Save project (Ctrl+S)"
        >
          {busy && status.type === 'busy' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Save size={12} />
          )}
          Save
        </button>

        {/* Load */}
        <button
          onClick={handleLoad}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 transition-colors"
          title="Load project from file"
        >
          <FolderOpen size={12} />
          Load
        </button>

        {/* Change folder — FSA only */}
        {fsaSupported && (
          <button
            onClick={handleChangeDir}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors max-w-[160px]"
            title="Change save folder"
          >
            <FolderCog size={12} className="shrink-0" />
            <span className="truncate">{savedDir ?? 'Set folder'}</span>
          </button>
        )}

        {/* Status feedback */}
        {status.type === 'ok' && (
          <span className="flex items-center gap-1.5 text-xs text-green-400 animate-in">
            <CheckCircle2 size={12} />
            {status.msg}
          </span>
        )}
        {status.type === 'err' && (
          <span className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle size={12} />
            {status.msg}
          </span>
        )}

        <div className="flex-1" />

        {/* No-file-open notice */}
        {!fileOpen && (
          <span className="text-xs text-amber-500">
            No project loaded —{' '}
            <button onClick={handleLoad} className="underline hover:text-amber-300">
              load a file
            </button>
            {' '}or save to activate auto-save
          </span>
        )}

        {/* Auto-save clock — only shown when a file is open */}
        {fileOpen && lastAutoSave && (
          <span className="flex items-center gap-1 text-xs text-gray-600" title={`Auto-saved at ${lastAutoSave}`}>
            <Clock size={11} />
            Auto-saved {formatTime(lastAutoSave)}
          </span>
        )}

        {/* Fallback notice */}
        {!fsaSupported && (
          <span className="text-xs text-gray-600 ml-2">
            Saves download to your browser's Downloads folder
          </span>
        )}
      </div>
    </>
  )
}
