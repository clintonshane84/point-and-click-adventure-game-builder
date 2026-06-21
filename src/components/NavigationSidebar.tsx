import {
  Map,
  Zap,
  Image,
  Layout,
  Layers,
  User,
  Film,
  Gamepad2,
  Settings,
  Monitor,
  BookOpen,
  Target,
  MousePointer2,
  Play,
  Download,
  ScrollText,
} from 'lucide-react'
import { useGameStore } from '../store/useGameStore'
import type { EditorType } from '../types'

interface NavItem {
  id: EditorType
  label: string
  icon: React.ReactNode
}

const editorItems: NavItem[] = [
  { id: 'scene', label: 'Scene Editor', icon: <Map size={20} /> },
  { id: 'event', label: 'Event Editor', icon: <Zap size={20} /> },
  { id: 'assets', label: 'Assets', icon: <Image size={20} /> },
  { id: 'ui', label: 'UI Editor', icon: <Layout size={20} /> },
  { id: 'sprite', label: 'Sprites', icon: <Layers size={20} /> },
  { id: 'character', label: 'Characters', icon: <User size={20} /> },
  { id: 'cinematic', label: 'Cinematics', icon: <Film size={20} /> },
  { id: 'minigame', label: 'Mini Games', icon: <Gamepad2 size={20} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  { id: 'titlescreen', label: 'Title Screen', icon: <Monitor size={20} /> },
  { id: 'stage', label: 'Stage Editor', icon: <BookOpen size={20} /> },
  { id: 'goal', label: 'Goal Editor', icon: <Target size={20} /> },
  { id: 'quest', label: 'Quest Log', icon: <ScrollText size={20} /> },
  { id: 'cursor', label: 'Cursor Editor', icon: <MousePointer2 size={20} /> },
]

const buildItems: NavItem[] = [
  { id: 'preview', label: 'Preview Game', icon: <Play size={20} /> },
  { id: 'export', label: 'Export Game', icon: <Download size={20} /> },
]

export function NavigationSidebar() {
  const { activeEditor, setActiveEditor } = useGameStore()

  const renderItem = (item: NavItem) => {
    const isActive = activeEditor === item.id
    return (
      <button
        key={item.id}
        onClick={() => setActiveEditor(item.id)}
        title={item.label}
        className={`
          flex items-center gap-3 px-4 py-3 text-left transition-colors whitespace-nowrap
          ${isActive
            ? 'bg-indigo-600 text-white'
            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
          }
        `}
      >
        <span className="shrink-0">{item.icon}</span>
        <span className="hidden group-hover:block text-sm font-medium">{item.label}</span>
      </button>
    )
  }

  return (
    <nav className="flex flex-col w-16 bg-gray-900 border-r border-gray-700 h-full shrink-0 hover:w-52 transition-all duration-200 overflow-hidden group">
      <div className="flex items-center justify-center h-12 border-b border-gray-700 shrink-0">
        <span className="text-indigo-400 font-bold text-lg group-hover:hidden">A</span>
        <span className="hidden group-hover:block text-indigo-400 font-bold text-sm whitespace-nowrap px-3">
          Adventure Builder
        </span>
      </div>

      <div className="flex flex-col flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {/* Editor tools */}
        {editorItems.map(renderItem)}

        {/* Separator */}
        <div className="my-2 mx-3 border-t border-gray-700/60" />
        <div className="hidden group-hover:block px-4 pb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Build</span>
        </div>

        {/* Build tools */}
        {buildItems.map(renderItem)}
      </div>

      {/* Version badge */}
      <div className="shrink-0 border-t border-gray-700/60 flex items-center justify-center h-8">
        <span className="group-hover:hidden text-gray-600 text-xs font-mono">v</span>
        <span className="hidden group-hover:block text-gray-600 text-xs font-mono px-3">
          v{__APP_VERSION__}
        </span>
      </div>
    </nav>
  )
}
