import { useState, useEffect, useRef } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { useGameStore } from '../store/useGameStore'
import { HELP_CONTENT } from '../help/helpContent'

export function HelpButton() {
  const activeEditor = useGameStore((s) => s.activeEditor)
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const help = HELP_CONTENT[activeEditor]

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Close when clicking the backdrop
  function handleBackdropClick(e: React.MouseEvent) {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      setOpen(false)
    }
  }

  // Close and re-open when the active editor changes while the dialog is open
  const prevEditor = useRef(activeEditor)
  useEffect(() => {
    if (open && prevEditor.current !== activeEditor) {
      // Let the new content slide in — keep dialog open, just scroll to top
      if (dialogRef.current) dialogRef.current.scrollTop = 0
    }
    prevEditor.current = activeEditor
  }, [activeEditor, open])

  return (
    <>
      {/* ── Floating trigger button ────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open help"
        className="
          fixed bottom-5 right-5 z-40
          w-12 h-12 rounded-full shadow-lg
          flex items-center justify-center
          bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
          text-white transition-all duration-150
          hover:scale-110 active:scale-95
          ring-2 ring-indigo-400/30
        "
      >
        <HelpCircle size={22} />
      </button>

      {/* ── Modal backdrop + dialog ────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-5 sm:items-center sm:justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
          onClick={handleBackdropClick}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Help — ${help.title}`}
            className="
              relative w-full max-w-xl max-h-[85vh]
              flex flex-col
              bg-gray-900 border border-gray-700
              rounded-2xl shadow-2xl
              overflow-hidden
              animate-in
            "
            style={{ animation: 'slideUp 0.18s ease-out' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700 shrink-0">
              <HelpCircle size={18} className="text-indigo-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-indigo-400 uppercase tracking-widest">Help</p>
                <h2 className="text-base font-semibold text-gray-100 truncate">{help.title}</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors shrink-0"
                aria-label="Close help"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-5 py-4 text-gray-300 leading-relaxed">
              {help.content}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-3 border-t border-gray-700/60 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Showing help for the <span className="text-gray-400 font-medium">{help.title}</span>
              </p>
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-up keyframe */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
      `}</style>
    </>
  )
}
