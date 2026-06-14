import { useState, useRef } from 'react'
import { Upload, Trash2, Image, Music, Video, FileIcon, Sparkles } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { useAiStore } from '../../store/useAiStore'
import { AiGenerateModal } from '../../components/AiGenerateModal'
import type { Asset, AssetType } from '../../types'

const ACCEPT: Record<AssetType, string> = {
  image: 'image/*',
  audio: 'audio/*',
  video: 'video/*',
}

const TAB_LABELS: { id: AssetType; label: string; icon: React.ReactNode }[] = [
  { id: 'image', label: 'Images', icon: <Image size={16} /> },
  { id: 'audio', label: 'Audio', icon: <Music size={16} /> },
  { id: 'video', label: 'Video', icon: <Video size={16} /> },
]

function formatBytes(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AssetsManager() {
  const { project, addAsset, deleteAsset } = useGameStore()
  const { assets } = project
  const { settings: aiSettings } = useAiStore()

  const [activeTab, setActiveTab] = useState<AssetType>('image')
  const [showAiModal, setShowAiModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAiGenerated = (dataUrl: string, prompt: string) => {
    const asset: Asset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: `ai-image-${Date.now()}.png`,
      type: 'image',
      url: dataUrl,
      createdAt: new Date().toISOString(),
    }
    addAsset(asset)
    setShowAiModal(false)
  }

  const filteredAssets = assets.filter((a) => a.type === activeTab)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const url = ev.target?.result as string
        const asset: Asset = {
          id: `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: activeTab,
          url,
          size: file.size,
          createdAt: new Date().toISOString(),
        }
        addAsset(asset)
      }
      reader.readAsDataURL(file)
    })
    // Reset input
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <h2 className="text-gray-100 font-semibold">Assets Manager</h2>
        <div className="flex items-center gap-2">
          {aiSettings.enabled && activeTab === 'image' && (
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-medium"
            >
              <Sparkles size={16} /> AI Generate
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
          >
            <Upload size={16} /> Import {activeTab === 'image' ? 'Image' : activeTab === 'audio' ? 'Audio' : 'Video'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT[activeTab]}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-gray-800">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className="ml-1 text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">
              {assets.filter((a) => a.type === tab.id).length}
            </span>
          </button>
        ))}
      </div>

      {showAiModal && (
        <AiGenerateModal
          title="AI Generate Image"
          onGenerated={handleAiGenerated}
          onClose={() => setShowAiModal(false)}
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredAssets.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-700 rounded-xl text-center p-12 cursor-pointer hover:border-indigo-500 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={48} className="text-gray-600 mb-4" />
            <p className="text-gray-400 font-medium text-lg">Drop files here or click to import</p>
            <p className="text-gray-500 text-sm mt-2">
              {activeTab === 'image' && 'Supports PNG, JPG, GIF, WebP, SVG'}
              {activeTab === 'audio' && 'Supports MP3, WAV, OGG, AAC'}
              {activeTab === 'video' && 'Supports MP4, WebM, OGV'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} onDelete={() => deleteAsset(asset.id)} />
            ))}
            {/* Add more button */}
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg h-40 cursor-pointer hover:border-indigo-500 transition-colors text-gray-600 hover:text-indigo-400"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={24} />
              <span className="text-xs mt-2">Add more</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface AssetCardProps {
  asset: Asset
  onDelete: () => void
}

function AssetCard({ asset, onDelete }: AssetCardProps) {
  return (
    <div className="group relative bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-indigo-500 transition-colors">
      {/* Preview */}
      <div className="h-32 flex items-center justify-center bg-gray-900">
        {asset.type === 'image' ? (
          <img
            src={asset.url}
            alt={asset.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : asset.type === 'audio' ? (
          <div className="flex flex-col items-center text-gray-500">
            <Music size={32} />
            <span className="text-xs mt-1">Audio</span>
          </div>
        ) : (
          <div className="flex flex-col items-center text-gray-500">
            <Video size={32} />
            <span className="text-xs mt-1">Video</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2 py-2">
        <p className="text-gray-200 text-xs font-medium truncate" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-gray-500 text-xs mt-0.5">{formatBytes(asset.size)}</p>
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-red-600 hover:bg-red-500 text-white rounded transition-opacity"
        title="Delete asset"
      >
        <Trash2 size={12} />
      </button>

      {/* Type icon */}
      <div className="absolute top-2 left-2">
        <div className="p-1 bg-gray-900 bg-opacity-70 rounded text-gray-400">
          {asset.type === 'image' ? (
            <Image size={12} />
          ) : asset.type === 'audio' ? (
            <Music size={12} />
          ) : (
            <FileIcon size={12} />
          )}
        </div>
      </div>
    </div>
  )
}
