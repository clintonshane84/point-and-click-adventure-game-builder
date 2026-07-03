import { useEffect, useRef, useState } from 'react'
import { Play, Square, RotateCcw, Maximize2, Minimize2, Info } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { GameRuntime } from '../../game-runtime/GameRuntime'

type PlayState = 'stopped' | 'playing'

// Shallow-clone each scene's objects array so runtime mutations (spawn_object)
// don't propagate back to the Zustand store after preview stops.
function isolateProject(project: ReturnType<typeof useGameStore.getState>['project']) {
  return {
    ...project,
    scenes: project.scenes.map((s) => ({ ...s, objects: [...s.objects] })),
  }
}

export function PreviewGameManager() {
  const project = useGameStore((s) => s.project)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtimeRef = useRef<GameRuntime | null>(null)
  const [playState, setPlayState] = useState<PlayState>('stopped')
  const [fullscreen, setFullscreen] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const w = project.settings.resolutionWidth || 1280
  const h = project.settings.resolutionHeight || 720

  // Teardown on unmount
  useEffect(() => {
    return () => { runtimeRef.current?.stop() }
  }, [])

  // Rebuild runtime if project changes while playing
  useEffect(() => {
    if (playState === 'playing' && runtimeRef.current) {
      runtimeRef.current.stop()
      const canvas = canvasRef.current
      if (canvas) {
        runtimeRef.current = new GameRuntime(canvas, isolateProject(project))
        runtimeRef.current.start()
      }
    }
  }, [project]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePlay() {
    const canvas = canvasRef.current
    if (!canvas) return

    if (project.scenes.length === 0) {
      setStatusMsg('No scenes yet — add scenes in the Scene Editor first.')
      return
    }

    setStatusMsg('')
    runtimeRef.current = new GameRuntime(canvas, isolateProject(project))
    runtimeRef.current.start()
    setPlayState('playing')
  }

  function handleStop() {
    runtimeRef.current?.stop()
    runtimeRef.current = null
    setPlayState('stopped')
    // Clear canvas
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  function handleReset() {
    if (runtimeRef.current) {
      runtimeRef.current.reset()
      setStatusMsg('')
    }
  }

  function toggleFullscreen() {
    setFullscreen((f) => !f)
  }

  const startScene = project.scenes.find((s) => s.id === project.settings.startingSceneId)
    ?? project.scenes[0]

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-700 shrink-0">
        <h1 className="text-sm font-semibold text-gray-100 mr-2">Preview Game</h1>

        {/* Controls */}
        <button
          onClick={handlePlay}
          disabled={playState === 'playing'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Play size={14} />
          Play
        </button>
        <button
          onClick={handleStop}
          disabled={playState === 'stopped'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Square size={14} />
          Stop
        </button>
        <button
          onClick={handleReset}
          disabled={playState === 'stopped'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw size={14} />
          Reset
        </button>

        <div className="flex-1" />

        {/* Scene info */}
        <span className="text-xs text-gray-400">
          Starting: <span className="text-gray-200">{startScene?.name ?? '—'}</span>
        </span>
        <span className="text-xs text-gray-500">
          {w}×{h}
        </span>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen preview'}
        >
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Status bar */}
      {statusMsg && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-900/40 border-b border-yellow-700/50 text-yellow-300 text-sm shrink-0">
          <Info size={14} />
          {statusMsg}
        </div>
      )}

      {/* Canvas area */}
      <div
        className={`flex-1 flex items-center justify-center overflow-hidden ${
          fullscreen
            ? 'fixed inset-0 z-50 bg-black'
            : 'bg-gray-950'
        }`}
      >
        {fullscreen && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-10 p-2 rounded bg-black/60 text-gray-300 hover:text-white transition-colors"
          >
            <Minimize2 size={20} />
          </button>
        )}

        <div className="relative">
          {/* Stopped overlay */}
          {playState === 'stopped' && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 z-10 rounded cursor-pointer select-none"
              onClick={handlePlay}
            >
              <div className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center mb-3 transition-colors">
                <Play size={28} className="ml-1" />
              </div>
              <p className="text-gray-300 text-sm">Click to play</p>
              <p className="text-gray-500 text-xs mt-1">
                {project.scenes.length} scene{project.scenes.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={w}
            height={h}
            className="block rounded border border-gray-700 shadow-2xl"
            style={{
              maxWidth: fullscreen ? '100vw' : 'min(calc(100vw - 80px), 1280px)',
              maxHeight: fullscreen ? '100vh' : 'calc(100vh - 100px)',
              aspectRatio: `${w}/${h}`,
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Info strip */}
      {!fullscreen && (
        <div className="shrink-0 px-4 py-1.5 border-t border-gray-800 bg-gray-900 flex items-center gap-6 text-xs text-gray-500">
          <span>
            <span className="text-gray-400 font-medium">Scenes: </span>
            {project.scenes.length}
          </span>
          <span>
            <span className="text-gray-400 font-medium">Events: </span>
            {project.events.length}
          </span>
          <span>
            <span className="text-gray-400 font-medium">Assets: </span>
            {project.assets.length}
          </span>
          <span>
            <span className="text-gray-400 font-medium">Status: </span>
            <span className={playState === 'playing' ? 'text-green-400' : 'text-gray-500'}>
              {playState === 'playing' ? '● Playing' : '○ Stopped'}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
