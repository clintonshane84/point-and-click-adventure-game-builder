import { useEffect, useState } from 'react'
import {
  Plus, Trash2, BookOpen, ChevronUp, ChevronDown, Volume2, VolumeX, ImageIcon, Music,
} from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import type { StoryBook, StoryPage, StoryPaperStyle } from '../../types'

const PAPER_LABELS: Record<StoryPaperStyle, string> = {
  parchment: 'Parchment',
  white: 'White',
  dark: 'Dark',
}

const PAPER_PREVIEW: Record<StoryPaperStyle, string> = {
  parchment: 'bg-amber-100 text-stone-800',
  white: 'bg-white text-gray-900',
  dark: 'bg-gray-800 text-gray-100',
}

function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])
  return voices
}

export function StoryTellerEditor() {
  const {
    project,
    addStoryBook, updateStoryBook, deleteStoryBook,
    addStoryPage, updateStoryPage, deleteStoryPage, moveStoryPage,
  } = useGameStore()
  const books = project.storyBooks ?? []
  const assets = project.assets ?? []
  const images = assets.filter((a) => a.type === 'image')
  const audios = assets.filter((a) => a.type === 'audio')
  const voices = useVoices()

  const [selectedBookId, setSelectedBookId] = useState<string | null>(books[0]?.id ?? null)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)

  const book = books.find((b) => b.id === selectedBookId) ?? null
  const page = book?.pages.find((p) => p.id === selectedPageId) ?? null
  const pageIndex = book ? book.pages.findIndex((p) => p.id === selectedPageId) : -1

  function handleAddBook() {
    const b: StoryBook = {
      id: `story-${Date.now()}`,
      name: `Story ${books.length + 1}`,
      description: '',
      pages: [],
      paperStyle: 'parchment',
      fontSize: 22,
      autoRead: false,
      autoAdvance: false,
    }
    addStoryBook(b)
    setSelectedBookId(b.id)
    setSelectedPageId(null)
  }

  function handleAddPage() {
    if (!book) return
    const p: StoryPage = {
      id: `page-${Date.now()}`,
      text: '',
      rate: 1,
      pitch: 1,
    }
    addStoryPage(book.id, p)
    setSelectedPageId(p.id)
  }

  function speakPreview(text: string, p: StoryPage) {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    if (!text.trim()) return
    const u = new SpeechSynthesisUtterance(text)
    u.rate = p.rate ?? 1
    u.pitch = p.pitch ?? 1
    const voice = voices.find((v) => v.name === p.voiceName)
    if (voice) u.voice = voice
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  return (
    <div className="flex h-full bg-gray-900">

      {/* ── Left: book list ───────────────────────────────────────────────── */}
      <div className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <span className="text-gray-300 text-sm font-semibold flex items-center gap-1.5">
            <BookOpen size={14} className="text-amber-400" /> Story Books
          </span>
          <button
            onClick={handleAddBook}
            className="p-1 rounded bg-amber-700 hover:bg-amber-600 text-white"
            title="Add story book"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {books.map((b) => (
            <div
              key={b.id}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer group ${
                b.id === selectedBookId ? 'bg-amber-700 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => { setSelectedBookId(b.id); setSelectedPageId(null); stopSpeaking() }}
            >
              <BookOpen size={12} className="shrink-0 opacity-60" />
              <span className="text-sm truncate flex-1">{b.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteStoryBook(b.id)
                  if (selectedBookId === b.id) {
                    setSelectedBookId(books.find((x) => x.id !== b.id)?.id ?? null)
                    setSelectedPageId(null)
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-600 text-gray-400 hover:text-white shrink-0"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {books.length === 0 && (
            <p className="text-xs text-gray-600 px-3 py-3 leading-relaxed">
              No story books yet.<br />Click + to create one.
            </p>
          )}
        </div>

        <div className="p-3 border-t border-gray-700 text-xs text-gray-600 leading-relaxed">
          Play a book before or after a stage from the <span className="text-gray-400">Stage Editor</span>,
          or with the <span className="text-gray-400">Play Story</span> event action.
        </div>
      </div>

      {!book ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpen size={48} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No story book selected</p>
            <p className="text-gray-500 text-sm mt-1">Select one from the list or click + to create.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Book settings header */}
          <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 space-y-3 shrink-0">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={book.name}
                onChange={(e) => updateStoryBook(book.id, { name: e.target.value })}
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-amber-500 font-medium"
              />
              <span className="text-xs text-gray-500">{book.pages.length} page{book.pages.length !== 1 ? 's' : ''}</span>
            </div>
            <input
              type="text"
              value={book.description}
              placeholder="Description (optional)"
              onChange={(e) => updateStoryBook(book.id, { description: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
            />
            <div className="grid grid-cols-4 gap-2 items-end">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Paper</label>
                <select
                  value={book.paperStyle}
                  onChange={(e) => updateStoryBook(book.id, { paperStyle: e.target.value as StoryPaperStyle })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
                >
                  {(Object.keys(PAPER_LABELS) as StoryPaperStyle[]).map((k) => (
                    <option key={k} value={k}>{PAPER_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Font size: {book.fontSize}px</label>
                <input
                  type="range" min={14} max={36} value={book.fontSize}
                  onChange={(e) => updateStoryBook(book.id, { fontSize: Number(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-300">
                <input
                  type="checkbox" checked={book.autoRead}
                  onChange={(e) => updateStoryBook(book.id, { autoRead: e.target.checked })}
                  className="accent-amber-500"
                /> Read each page aloud
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-300">
                <input
                  type="checkbox" checked={book.autoAdvance}
                  onChange={(e) => updateStoryBook(book.id, { autoAdvance: e.target.checked })}
                  className="accent-amber-500"
                /> Turn page when narration ends
              </label>
            </div>
            <label className={`flex items-start gap-2 text-xs ${book.pages.length === 1 ? 'text-gray-300' : 'text-gray-600'}`}>
              <input
                type="checkbox"
                checked={!!book.playAtGameStart}
                disabled={!book.playAtGameStart && book.pages.length !== 1}
                onChange={(e) => updateStoryBook(book.id, { playAtGameStart: e.target.checked })}
                className="mt-0.5 accent-amber-500"
              />
              <span>
                Play at game start, before the title menu
                <span className="block text-gray-500">
                  {book.pages.length === 1
                    ? 'Only one book can do this. Ticking it here clears it on the other books.'
                    : 'Needs exactly one page. Add or remove pages so this book has one page.'}
                </span>
              </span>
            </label>
          </div>

          <div className="flex-1 flex overflow-hidden">

            {/* Page list */}
            <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                <span className="text-gray-300 text-xs font-semibold">Pages</span>
                <button
                  onClick={handleAddPage}
                  className="p-1 rounded bg-amber-700 hover:bg-amber-600 text-white"
                  title="Add page"
                >
                  <Plus size={12} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {book.pages.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer group ${
                      p.id === selectedPageId ? 'bg-amber-700 text-white' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                    onClick={() => { setSelectedPageId(p.id); stopSpeaking() }}
                  >
                    <span className="text-xs opacity-60 w-5 shrink-0">{i + 1}.</span>
                    <span className="text-xs truncate flex-1">{p.text.trim() || <em className="opacity-50">(empty page)</em>}</span>
                    <div className="flex flex-col opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveStoryPage(book.id, p.id, 'up') }}
                        className="hover:text-white text-gray-400"
                      ><ChevronUp size={11} /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveStoryPage(book.id, p.id, 'down') }}
                        className="hover:text-white text-gray-400"
                      ><ChevronDown size={11} /></button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteStoryPage(book.id, p.id)
                        if (selectedPageId === p.id) setSelectedPageId(null)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-600 text-gray-400 hover:text-white shrink-0"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
                {book.pages.length === 0 && (
                  <p className="text-xs text-gray-600 px-3 py-3 leading-relaxed">No pages yet. Click + to add one.</p>
                )}
              </div>
            </div>

            {/* Page editor + preview */}
            <div className="flex-1 overflow-y-auto p-4">
              {!page ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500 text-sm">Select a page to edit it.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 max-w-5xl">

                  {/* Properties */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Page text</label>
                      <textarea
                        value={page.text}
                        rows={8}
                        onChange={(e) => updateStoryPage(book.id, page.id, { text: e.target.value })}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-amber-500 resize-y"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 block mb-1 flex items-center gap-1">
                        <ImageIcon size={11} /> Illustration
                      </label>
                      <select
                        value={page.imageAssetId ?? ''}
                        onChange={(e) => updateStoryPage(book.id, page.id, { imageAssetId: e.target.value || undefined })}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">None</option>
                        {images.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 block mb-1 flex items-center gap-1">
                        <Music size={11} /> Narration audio (overrides text-to-speech)
                      </label>
                      <select
                        value={page.audioAssetId ?? ''}
                        onChange={(e) => updateStoryPage(book.id, page.id, { audioAssetId: e.target.value || undefined })}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Use text-to-speech</option>
                        {audios.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>

                    {!page.audioAssetId && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-3">
                          <label className="text-xs text-gray-500 block mb-1">Voice</label>
                          <select
                            value={page.voiceName ?? ''}
                            onChange={(e) => updateStoryPage(book.id, page.id, { voiceName: e.target.value || undefined })}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
                          >
                            <option value="">Default voice</option>
                            {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Rate {(page.rate ?? 1).toFixed(1)}</label>
                          <input
                            type="range" min={0.5} max={2} step={0.1} value={page.rate ?? 1}
                            onChange={(e) => updateStoryPage(book.id, page.id, { rate: Number(e.target.value) })}
                            className="w-full accent-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Pitch {(page.pitch ?? 1).toFixed(1)}</label>
                          <input
                            type="range" min={0} max={2} step={0.1} value={page.pitch ?? 1}
                            onChange={(e) => updateStoryPage(book.id, page.id, { pitch: Number(e.target.value) })}
                            className="w-full accent-amber-500"
                          />
                        </div>
                        <div className="flex items-end">
                          {speaking ? (
                            <button onClick={stopSpeaking}
                              className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-xs">
                              <VolumeX size={12} /> Stop
                            </button>
                          ) : (
                            <button onClick={() => speakPreview(page.text, page)}
                              className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white text-xs">
                              <Volume2 size={12} /> Listen
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-600">
                      Page {pageIndex + 1} of {book.pages.length}. Preview the full flip animation with the Preview Game button.
                    </p>
                  </div>

                  {/* Static page preview */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Page preview</label>
                    <div
                      className={`${PAPER_PREVIEW[book.paperStyle]} rounded shadow-lg p-5 min-h-[320px] flex flex-col gap-3 border border-black/20`}
                      style={{ fontSize: book.fontSize * 0.7, fontFamily: 'Georgia, serif' }}
                    >
                      {page.imageAssetId && (() => {
                        const img = assets.find((a) => a.id === page.imageAssetId)
                        return img ? (
                          <img src={img.url} alt={img.name} className="max-h-48 object-contain mx-auto rounded" />
                        ) : null
                      })()}
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {page.text || <span className="opacity-40">Page text appears here…</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
