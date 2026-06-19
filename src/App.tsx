import { useEffect } from 'react'
import { useGameStore } from './store/useGameStore'
import { NavigationSidebar } from './components/NavigationSidebar'
import { SaveLoadBar } from './components/SaveLoadBar'
import { HelpButton } from './components/HelpButton'
import { SceneEditor } from './editors/SceneEditor'
import { EventEditor } from './editors/EventEditor'
import { AssetsManager } from './editors/AssetsManager'
import { UIEditor } from './editors/UIEditor'
import { SpriteManager } from './editors/SpriteManager'
import { SettingsEditor } from './editors/SettingsEditor'
import { TitleScreenEditor } from './editors/TitleScreenEditor'
import { StageEditor } from './editors/StageEditor'
import { GoalEditor } from './editors/GoalEditor'
import { CursorEditor } from './editors/CursorEditor'
import { CharacterEditor } from './editors/CharacterEditor'
import { CinematicEditor } from './editors/CinematicEditor'
import { MiniGameEditor } from './editors/MiniGameEditor'
import { PreviewGameManager } from './editors/PreviewGameManager'
import { ExportGameManager } from './editors/ExportGameManager'
import { saveProject, autoSave } from './lib/fileSystemStorage'

function App() {
  const activeEditor = useGameStore((s) => s.activeEditor)
  const project      = useGameStore((s) => s.project)

  // Ctrl/Cmd + S → save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveProject(project)
        autoSave(project)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [project])

  const renderEditor = () => {
    switch (activeEditor) {
      case 'scene':       return <SceneEditor />
      case 'event':       return <EventEditor />
      case 'assets':      return <AssetsManager />
      case 'ui':          return <UIEditor />
      case 'sprite':      return <SpriteManager />
      case 'settings':    return <SettingsEditor />
      case 'titlescreen': return <TitleScreenEditor />
      case 'stage':       return <StageEditor />
      case 'goal':        return <GoalEditor />
      case 'cursor':      return <CursorEditor />
      case 'character':   return <CharacterEditor />
      case 'cinematic':   return <CinematicEditor />
      case 'minigame':    return <MiniGameEditor />
      case 'preview':     return <PreviewGameManager />
      case 'export':      return <ExportGameManager />
      default:            return <SceneEditor />
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-950">
      {/* Top bar: project name, save/load, auto-save indicator */}
      <SaveLoadBar />

      {/* Main layout: sidebar + editor */}
      <div className="flex flex-1 overflow-hidden">
        <NavigationSidebar />
        <main className="flex-1 overflow-hidden">{renderEditor()}</main>
      </div>

      {/* Floating help button */}
      <HelpButton />
    </div>
  )
}

export default App
