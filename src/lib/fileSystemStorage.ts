/**
 * fileSystemStorage.ts
 *
 * Three-layer save/load strategy:
 *  1. File System Access API  — writes directly to a user-chosen folder on disk,
 *     handle persisted in IndexedDB so subsequent saves need no prompt.
 *     When a file is loaded via the open picker the file handle is stored so
 *     subsequent saves overwrite the same file rather than creating a new one.
 *  2. Browser download / file-input — fallback for browsers without FSA.
 *  3. localStorage auto-save — runs every 60 s while a file is open; restored
 *     automatically on next session startup.
 */

import type { GameProject } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const IDB_DB       = 'adventure-game-builder-v1'
const IDB_STORE    = 'handles'
const IDB_DIR_KEY  = 'project-directory'
const IDB_FILE_KEY = 'current-file-handle'   // stores the last-opened FileSystemFileHandle

const LS_PROJECT_KEY = 'agb-autosave'
const LS_TIME_KEY    = 'agb-autosave-time'

// ── FSA availability ──────────────────────────────────────────────────────────

export const fsaSupported =
  typeof window !== 'undefined' &&
  'showDirectoryPicker' in window &&
  'showOpenFilePicker' in window

export const savePickerSupported =
  typeof window !== 'undefined' && 'showSaveFilePicker' in window

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror  = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve((req.result as T) ?? null)
    req.onerror  = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

// ── File handle storage (for overwrite-save) ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FileHandle = any  // FileSystemFileHandle — typed loosely for cross-browser TS compat

export async function saveFileHandle(h: FileHandle): Promise<void> {
  try { await idbSet(IDB_FILE_KEY, h) } catch { /* ignore */ }
}

export async function getFileHandle(): Promise<FileHandle | null> {
  try { return await idbGet<FileHandle>(IDB_FILE_KEY) } catch { return null }
}

export async function clearFileHandle(): Promise<void> {
  try { await idbSet(IDB_FILE_KEY, null) } catch { /* ignore */ }
}

// ── Directory handle management ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DirHandle = any   // FileSystemDirectoryHandle — typed loosely for cross-browser TS compat

async function getSavedDirHandle(): Promise<DirHandle | null> {
  try { return await idbGet<DirHandle>(IDB_DIR_KEY) }
  catch { return null }
}

async function checkPermission(handle: DirHandle): Promise<boolean> {
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') return true
    const req  = await handle.requestPermission({ mode: 'readwrite' })
    return req === 'granted'
  } catch { return false }
}

/** Returns the stored directory handle (re-requesting permission if needed),
 *  or opens the directory picker if none is stored or permission was revoked. */
async function getOrPickDirectory(): Promise<DirHandle> {
  const saved = await getSavedDirHandle()
  if (saved && await checkPermission(saved)) return saved

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handle: DirHandle = await (window as any).showDirectoryPicker({
    id: 'adventure-game-builder',
    mode: 'readwrite',
    startIn: 'desktop',
  })
  await idbSet(IDB_DIR_KEY, handle)
  return handle
}

// ── Public: change / query saved folder ──────────────────────────────────────

/** Opens the directory picker so the user can change the save folder. */
export async function changeProjectDirectory(): Promise<string | null> {
  if (!fsaSupported) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle: DirHandle = await (window as any).showDirectoryPicker({
      id: 'adventure-game-builder',
      mode: 'readwrite',
      startIn: 'desktop',
    })
    await idbSet(IDB_DIR_KEY, handle)
    return handle.name as string
  } catch { return null }
}

/** Returns the name of the currently saved folder, or null. */
export async function getSavedDirectoryName(): Promise<string | null> {
  const h = await getSavedDirHandle()
  return h ? (h.name as string) : null
}

// ── Save ──────────────────────────────────────────────────────────────────────

export type SaveResult =
  | { ok: true;  path: string;  method: 'fsa-file' | 'fsa-dir' | 'download' }
  | { ok: false; error: string }

/**
 * Save the project.
 *
 * Priority order:
 *  1. Overwrite the last-opened file (stored FileSystemFileHandle) — silent.
 *  2. Write to the chosen FSA directory — silent if permission held, prompts otherwise.
 *  3. Trigger a browser download — always works as fallback.
 */
export async function saveProject(project: GameProject): Promise<SaveResult> {
  const json     = JSON.stringify(project, null, 2)
  const filename = `${slugify(project.name || 'my-adventure-game')}.agb.json`

  if (fsaSupported) {
    // 1. Try the stored file handle (overwrite the file that was last opened/saved)
    const fh = await getFileHandle()
    if (fh) {
      try {
        const perm = await fh.queryPermission({ mode: 'readwrite' })
        const granted =
          perm === 'granted' ||
          (await fh.requestPermission({ mode: 'readwrite' })) === 'granted'
        if (granted) {
          const writable = await fh.createWritable()
          await writable.write(json)
          await writable.close()
          return { ok: true, path: fh.name as string, method: 'fsa-file' }
        }
      } catch {
        // Permission revoked or handle stale — fall through to directory approach
      }
    }

    // 2. "Save As" file picker — user picks exact file; handle stored for future overwrites
    if (savePickerSupported) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newHandle: FileHandle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Adventure Game Builder Project',
            accept: { 'application/json': ['.json'] },
          }],
        })
        const writable = await newHandle.createWritable()
        await writable.write(json)
        await writable.close()
        await saveFileHandle(newHandle)
        return { ok: true, path: newHandle.name as string, method: 'fsa-file' }
      } catch (err) {
        const name = (err as Error).name
        if (name === 'AbortError') return { ok: false, error: 'cancelled' }
        console.warn('showSaveFilePicker failed, trying directory approach:', err)
      }
    }

    // 3. Write to the chosen FSA directory
    try {
      const dirHandle  = await getOrPickDirectory()
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
      const writable   = await fileHandle.createWritable()
      await writable.write(json)
      await writable.close()
      // Store this file handle so next save is a direct overwrite
      await saveFileHandle(fileHandle)
      return { ok: true, path: `${dirHandle.name as string}/${filename}`, method: 'fsa-dir' }
    } catch (err) {
      const name = (err as Error).name
      if (name === 'AbortError') return { ok: false, error: 'cancelled' }
      console.warn('FSA save failed, falling back to download:', err)
    }
  }

  // 3. Fallback: browser download
  triggerDownload(json, filename)
  return { ok: true, path: filename, method: 'download' }
}

// ── Load ──────────────────────────────────────────────────────────────────────

export type LoadResult =
  | { ok: true;  project: GameProject }
  | { ok: false; error: string }

/**
 * Load a project file.
 *
 * With FSA: opens the native file-picker.
 * Without FSA: uses an <input type="file"> element.
 */
export async function loadProject(): Promise<LoadResult> {
  if (fsaSupported) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'Adventure Game Builder Project',
          accept: { 'application/json': ['.json', '.agb.json'] },
        }],
        excludeAcceptAllOption: false,
        multiple: false,
      })
      const file = await fileHandle.getFile()
      const result = await parseProjectFile(file)
      if (result.ok) {
        // Remember this handle so Save will overwrite the same file
        await saveFileHandle(fileHandle)
      }
      return result
    } catch (err) {
      const name = (err as Error).name
      if (name === 'AbortError') return { ok: false, error: 'cancelled' }
      return { ok: false, error: `Could not read file: ${(err as Error).message}` }
    }
  }

  // Fallback: <input type="file">
  return new Promise((resolve) => {
    const input   = document.createElement('input')
    input.type    = 'file'
    input.accept  = '.json,.agb.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve({ ok: false, error: 'cancelled' })
      resolve(await parseProjectFile(file))
    }
    // Some browsers fire cancel; guard with a blur fallback
    input.click()
  })
}

async function parseProjectFile(file: File): Promise<LoadResult> {
  try {
    const text    = await file.text()
    const project = JSON.parse(text) as GameProject
    if (!project.id || !Array.isArray(project.scenes))
      return { ok: false, error: 'File does not appear to be a valid Adventure Game Builder project.' }
    return { ok: true, project }
  } catch {
    return { ok: false, error: 'Could not parse file — make sure it is a valid .agb.json project.' }
  }
}

// ── Auto-save ─────────────────────────────────────────────────────────────────

/** Write to localStorage. Always called as part of every auto-save. */
export function autoSave(project: GameProject): void {
  try {
    localStorage.setItem(LS_PROJECT_KEY, JSON.stringify(project))
    localStorage.setItem(LS_TIME_KEY, new Date().toISOString())
  } catch { /* quota exceeded — silently skip */ }
}

/**
 * Silently write to the previously chosen FSA directory, if permission is
 * already granted. Never opens a picker — returns false if no handle exists
 * or permission has lapsed, so the caller can fall back to localStorage only.
 */
export async function autoSaveToFile(project: GameProject): Promise<boolean> {
  if (!fsaSupported) return false
  try {
    // Prefer writing to the stored file handle (overwrite same file)
    const fh = await getFileHandle()
    if (fh) {
      const perm = await fh.queryPermission({ mode: 'readwrite' })
      if (perm === 'granted') {
        const writable = await fh.createWritable()
        await writable.write(JSON.stringify(project, null, 2))
        await writable.close()
        return true
      }
    }
    // Fall back to directory-based auto-save
    const dirHandle = await getSavedDirHandle()
    if (!dirHandle) return false
    const perm = await dirHandle.queryPermission({ mode: 'readwrite' })
    if (perm !== 'granted') return false
    const filename = `${slugify(project.name || 'my-adventure-game')}.agb.json`
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(JSON.stringify(project, null, 2))
    await writable.close()
    return true
  } catch { return false }
}

export interface AutoSaveData {
  project: GameProject
  savedAt: string   // ISO timestamp
}

export function getAutoSave(): AutoSaveData | null {
  try {
    const raw    = localStorage.getItem(LS_PROJECT_KEY)
    const savedAt = localStorage.getItem(LS_TIME_KEY)
    if (!raw || !savedAt) return null
    return { project: JSON.parse(raw) as GameProject, savedAt }
  } catch { return null }
}

export function clearAutoSave(): void {
  localStorage.removeItem(LS_PROJECT_KEY)
  localStorage.removeItem(LS_TIME_KEY)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'
}

function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
