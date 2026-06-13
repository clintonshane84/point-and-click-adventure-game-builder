import {
  Map,
  Zap,
  Image,
  Layout,
  Layers,
  Settings,
  Monitor,
  BookOpen,
  Target,
  MousePointer2,
} from 'lucide-react'
import { useGameStore } from '../store/useGameStore'
import type { EditorType } from '../types'

interface NavItem {
  id: EditorType
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { id: 'scene', label: 'Scene Editor', icon: <Map size={20} /> },
  { id: 'event', label: 'Event Editor', icon: <Zap size={20} /> },
  { id: 'assets', label: 'Assets', icon: <Image size={20} /> },
  { id: 'ui', label: 'UI Editor', icon: <Layout size={20} /> },
  { id: 'sprite', label: 'Sprites', icon: <Layers size={20} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  { id: 'titlescreen', label: 'Title Screen', icon: <Monitor size={20} /> },
  { id: 'stage', label: 'Stage Editor', icon: <BookOpen size={20} /> },
  { id: 'goal', label: 'Goal Editor', icon: <Target size={20} /> },
  { id: 'cursor', label: 'Cursor Editor', icon: <MousePointer2 size={20} /> },
]

export function NavigationSidebar() {
  const { activeEditor, setActiveEditor } = useGameStore()

  return (
    <nav className="flex flex-col w-16 bg-gray-900 border-r border-gray-700 h-full shrink-0 hover:w-48 transition-all duration-200 overflow-hidden group">
      <div className="flex items-center justify-center h-12 border-b border-gray-700 shrink-0">
        <span className="text-indigo-400 font-bold text-lg group-hover:hidden">A</span>
        <span className="hidden group-hover:block text-indigo-400 font-bold text-sm whitespace-nowrap px-3">
          Adventure Builder
        </span>
      </div>
      <div className="flex flex-col flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = activeEditor === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveEditor(item.id)}
              title={item.label}
              className={`
                flex items-center gap-3 px-4 py-3 text-left transition-colors whitespace-nowrap
                ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }
              `}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="hidden group-hover:block text-sm font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
