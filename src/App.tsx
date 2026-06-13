import { useGameStore } from './store/useGameStore'
import { NavigationSidebar } from './components/NavigationSidebar'
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
import { PreviewGameManager } from './editors/PreviewGameManager'
import { ExportGameManager } from './editors/ExportGameManager'
import { HelpButton } from './components/HelpButton'

function App() {
  const activeEditor = useGameStore((s) => s.activeEditor)

  const renderEditor = () => {
    switch (activeEditor) {
      case 'scene':
        return <SceneEditor />
      case 'event':
        return <EventEditor />
      case 'assets':
        return <AssetsManager />
      case 'ui':
        return <UIEditor />
      case 'sprite':
        return <SpriteManager />
      case 'settings':
        return <SettingsEditor />
      case 'titlescreen':
        return <TitleScreenEditor />
      case 'stage':
        return <StageEditor />
      case 'goal':
        return <GoalEditor />
      case 'cursor':
        return <CursorEditor />
      case 'preview':
        return <PreviewGameManager />
      case 'export':
        return <ExportGameManager />
      default:
        return <SceneEditor />
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
      <NavigationSidebar />
      <main className="flex-1 overflow-hidden">{renderEditor()}</main>
      <HelpButton />
    </div>
  )
}

export default App
