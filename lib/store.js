/** File-backed store for the four-quadrant todo plugin: one JSON document, serialized atomic writes. */

import { readFile, writeFile, rename, mkdir, copyFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const VERSION = 1
const MAX_TODOS = 500
const TITLE_MAX = 200
const RADIUS_MIN = 0
const RADIUS_MAX = 24
const FONT_MIN = 11
const FONT_MAX = 17
const CORRUPT_UNBACKUPED = '数据文件损坏且无法备份，已停止写入以保护原文件'

/**
 * Panel layout preferences, persisted next to the todos.
 * `frame`: cards = four rounded cards, grid = outer border with a cross (田字格),
 * cross = a true cross with no outer border. `tint`: soft pastel cell backgrounds.
 */
export const DEFAULT_SETTINGS = Object.freeze({
  urgentSide: 'right',
  frame: 'cross',
  radius: 10,
  tint: 'plain',
  fontSize: 14,
  dueFormat: 'countdown',
  titleStyle: 'wrap',
  colRatio: 0.5,
  rowRatio: 0.5,
  navLabel: '',
})

const NAV_LABEL_MAX = 24

const URGENT_SIDES = ['left', 'right']
const FRAMES = ['cards', 'grid', 'cross']
const TINTS = ['plain', 'soft']
const DUE_FORMATS = ['date', 'countdown']
const TITLE_STYLES = ['wrap', 'truncate']
const RATIO_MIN = 0.2
const RATIO_MAX = 0.8

/** Valid split ratio, or the default when the value is unusable. */
function sanitizeRatio(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= RATIO_MIN && value <= RATIO_MAX
    ? value
    : 0.5
}

/** Error with a stable code, so the HTTP layer can map it to a status. */
export class StoreError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'StoreError'
    this.code = code
  }
}

function emptyDoc() {
  return { version: VERSION, todos: [], settings: { ...DEFAULT_SETTINGS }, reordered: false }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** `YYYY-MM-DD` that names a real calendar day, or null when absent/blank. */
function normalizeDueDate(raw) {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw !== 'string' || !DAY_RE.test(raw)) {
    throw new StoreError('invalid-input', '截止日期格式应为 YYYY-MM-DD')
  }
  const [year, month, day] = raw.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new StoreError('invalid-input', '截止日期不是真实存在的日期')
  }
  return raw
}

/** Lenient variant for rows read off disk: an unusable due date becomes null. */
function sanitizeDueDate(raw) {
  try {
    return normalizeDueDate(raw)
  } catch {
    return null
  }
}

/** Unknown or malformed preference fields fall back to the default, never throw. */
function sanitizeSettings(value) {
  const source = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    urgentSide: URGENT_SIDES.includes(source.urgentSide) ? source.urgentSide : DEFAULT_SETTINGS.urgentSide,
    frame: FRAMES.includes(source.frame) ? source.frame : DEFAULT_SETTINGS.frame,
    radius:
      Number.isInteger(source.radius) && source.radius >= RADIUS_MIN && source.radius <= RADIUS_MAX
        ? source.radius
        : DEFAULT_SETTINGS.radius,
    tint: TINTS.includes(source.tint) ? source.tint : DEFAULT_SETTINGS.tint,
    fontSize:
      Number.isInteger(source.fontSize) && source.fontSize >= FONT_MIN && source.fontSize <= FONT_MAX
        ? source.fontSize
        : DEFAULT_SETTINGS.fontSize,
    dueFormat: DUE_FORMATS.includes(source.dueFormat) ? source.dueFormat : DEFAULT_SETTINGS.dueFormat,
    titleStyle: TITLE_STYLES.includes(source.titleStyle) ? source.titleStyle : DEFAULT_SETTINGS.titleStyle,
    colRatio: sanitizeRatio(source.colRatio),
    rowRatio: sanitizeRatio(source.rowRatio),
    navLabel:
      typeof source.navLabel === 'string' ? source.navLabel.trim().slice(0, NAV_LABEL_MAX) : DEFAULT_SETTINGS.navLabel,
  }
}

/** Contract id format: e_<base36 timestamp>_<4 random base36 chars>. */
function newId() {
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  return `e_${Date.now().toString(36)}_${rand}`
}

function asRecord(value) {
  if (value === undefined) return {}
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new StoreError('invalid-input', '参数必须是对象')
  }
  return value
}

/** Title: trim the textual form, then require 1..200 characters. */
function normalizeTitle(raw) {
  const title = raw === undefined || raw === null ? '' : String(raw).trim()
  if (title.length === 0) throw new StoreError('invalid-input', '标题不能为空')
  if (title.length > TITLE_MAX) throw new StoreError('invalid-input', `标题最长 ${TITLE_MAX} 字`)
  return title
}

/** Quadrant flags default to false when absent; anything non-boolean is rejected. */
function normalizeFlag(raw, field) {
  if (raw === undefined) return false
  if (typeof raw !== 'boolean') throw new StoreError('invalid-input', `${field} 必须是布尔值`)
  return raw
}

function requireId(raw) {
  if (typeof raw !== 'string' || raw === '') throw new StoreError('invalid-input', 'id 必填')
  return raw
}

/** Keep manually edited files tolerable: drop rows that cannot be rendered, keep every usable field. */
function sanitizeTodos(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    if (typeof raw.id !== 'string' || raw.id === '') continue
    const title = typeof raw.title === 'string' ? raw.title.trim() : ''
    if (title === '' || title.length > TITLE_MAX) continue
    const done = raw.done === true
    const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
    out.push({
      id: raw.id,
      title,
      important: raw.important === true,
      urgent: raw.urgent === true,
      done,
      dueDate: sanitizeDueDate(raw.dueDate),
      createdAt,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt,
      completedAt: done && typeof raw.completedAt === 'string' ? raw.completedAt : null,
    })
  }
  return out
}

/** Read the document; unreadable shape or unparseable JSON is reported as corrupt, not fatal. */
async function readDoc(file) {
  let raw
  try {
    raw = await readFile(file, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return { doc: emptyDoc(), corrupt: false }
    throw new StoreError('io-error', `无法读取待办数据：${err.message}`)
  }
  try {
    const doc = JSON.parse(raw)
    if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !Array.isArray(doc.todos)) {
      throw new Error('shape')
    }
    return { doc, corrupt: false }
  } catch {
    return { doc: emptyDoc(), corrupt: true }
  }
}

/** Backup name next to the data file: todos.json -> todos.corrupt-<timestamp>.json */
function corruptBackupPath(file) {
  return `${file.replace(/\.json$/i, '')}.corrupt-${Date.now()}.json`
}

export function createStore({ file } = {}) {
  if (typeof file !== 'string' || file === '') throw new StoreError('invalid-input', '数据文件路径必填')
  const dataFile = file
  const state = { todos: [], settings: { ...DEFAULT_SETTINGS }, reordered: false, corrupt: false, sealed: false }
  let queue = Promise.resolve()
  let closed = false

  /** Latest in-memory todos, copied so callers cannot mutate the source of truth. */
  function snapshot() {
    return state.todos.map((todo) => ({ ...todo }))
  }

  async function persist() {
    if (state.sealed) throw new StoreError('io-error', CORRUPT_UNBACKUPED)
    const snapshotText = JSON.stringify(
      { version: VERSION, todos: state.todos, settings: state.settings, reordered: state.reordered },
      null,
      2,
    )
    const write = queue.then(async () => {
      await mkdir(dirname(dataFile), { recursive: true })
      const tmp = `${dataFile}.tmp`
      await writeFile(tmp, snapshotText, 'utf8')
      await rename(tmp, dataFile)
    })
    queue = write.catch(() => {})
    try {
      await write
    } catch (err) {
      if (err instanceof StoreError) throw err
      throw new StoreError('io-error', `待办数据写入失败：${err.message}`)
    }
  }

  async function guard(fn) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof StoreError) throw err
      throw new StoreError('io-error', `待办数据写入失败：${err.message}`)
    }
  }

  return {
    async load() {
      const { doc, corrupt } = await readDoc(dataFile)
      state.todos = sanitizeTodos(doc.todos)
      state.settings = sanitizeSettings(doc.settings)
      state.reordered = doc.reordered === true
      // Until someone drags a row, the list order is derived: newest first. Once
      // a drag is saved, the stored array order is the user's own order.
      if (!state.reordered) state.todos.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      state.corrupt = corrupt
      state.sealed = false
      if (!corrupt) return { corrupt: false }
      const backup = corruptBackupPath(dataFile)
      try {
        await copyFile(dataFile, backup)
      } catch {
        state.sealed = true
        throw new StoreError('io-error', CORRUPT_UNBACKUPED)
      }
      await guard(persist)
      return { corrupt: true, backup }
    },

    close() {
      if (closed) return queue
      closed = true
      return queue
    },

    list() {
      return snapshot()
    },

    /** Current layout preferences (a copy; callers cannot mutate the source of truth). */
    settings() {
      return { ...state.settings }
    },

    /** Merge validated preference fields and persist them with the todos. */
    async saveSettings(input = {}) {
      const source = asRecord(input)
      const next = { ...state.settings }
      if (source.urgentSide !== undefined) {
        if (!URGENT_SIDES.includes(source.urgentSide)) {
          throw new StoreError('invalid-input', 'urgentSide 只能是 left 或 right')
        }
        next.urgentSide = source.urgentSide
      }
      if (source.frame !== undefined) {
        if (!FRAMES.includes(source.frame)) {
          throw new StoreError('invalid-input', 'frame 只能是 cards、grid 或 cross')
        }
        next.frame = source.frame
      }
      if (source.tint !== undefined) {
        if (!TINTS.includes(source.tint)) {
          throw new StoreError('invalid-input', 'tint 只能是 plain 或 soft')
        }
        next.tint = source.tint
      }
      if (source.dueFormat !== undefined) {
        if (!DUE_FORMATS.includes(source.dueFormat)) {
          throw new StoreError('invalid-input', 'dueFormat 只能是 date 或 countdown')
        }
        next.dueFormat = source.dueFormat
      }
      if (source.titleStyle !== undefined) {
        if (!TITLE_STYLES.includes(source.titleStyle)) {
          throw new StoreError('invalid-input', 'titleStyle 只能是 wrap 或 truncate')
        }
        next.titleStyle = source.titleStyle
      }
      for (const field of ['colRatio', 'rowRatio']) {
        if (source[field] === undefined) continue
        if (
          typeof source[field] !== 'number' ||
          !Number.isFinite(source[field]) ||
          source[field] < RATIO_MIN ||
          source[field] > RATIO_MAX
        ) {
          throw new StoreError('invalid-input', `${field} 必须是 ${RATIO_MIN}–${RATIO_MAX} 之间的数字`)
        }
        next[field] = source[field]
      }
      if (source.navLabel !== undefined) {
        if (typeof source.navLabel !== 'string') {
          throw new StoreError('invalid-input', 'navLabel 必须是字符串')
        }
        const label = source.navLabel.trim()
        if (label.length > NAV_LABEL_MAX) {
          throw new StoreError('invalid-input', `侧边栏名称最长 ${NAV_LABEL_MAX} 字`)
        }
        next.navLabel = label
      }
      if (source.fontSize !== undefined) {
        if (!Number.isInteger(source.fontSize) || source.fontSize < FONT_MIN || source.fontSize > FONT_MAX) {
          throw new StoreError('invalid-input', `fontSize 必须是 ${FONT_MIN}-${FONT_MAX} 的整数`)
        }
        next.fontSize = source.fontSize
      }
      if (source.radius !== undefined) {
        if (!Number.isInteger(source.radius) || source.radius < RADIUS_MIN || source.radius > RADIUS_MAX) {
          throw new StoreError('invalid-input', `radius 必须是 ${RADIUS_MIN}-${RADIUS_MAX} 的整数`)
        }
        next.radius = source.radius
      }
      state.settings = next
      await guard(persist)
      return { ...next }
    },

    async create(input = {}) {
      const source = asRecord(input)
      if (state.todos.length >= MAX_TODOS) {
        throw new StoreError('invalid-input', `待办最多 ${MAX_TODOS} 条`)
      }
      const title = normalizeTitle(source.title)
      const important = normalizeFlag(source.important, 'important')
      const urgent = normalizeFlag(source.urgent, 'urgent')
      const dueDate = normalizeDueDate(source.dueDate)
      const now = new Date().toISOString()
      // Newest first inside its quadrant: the array order is the display order.
      state.todos.unshift({
        id: newId(),
        title,
        important,
        urgent,
        done: false,
        dueDate,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      })
      await guard(persist)
      return snapshot()
    },

    async update(input = {}) {
      const source = asRecord(input)
      const index = state.todos.findIndex((todo) => todo.id === requireId(source.id))
      if (index === -1) throw new StoreError('not-found', '这条待办已经不在了')
      const current = state.todos[index]
      const next = { ...current }
      if (source.title !== undefined) next.title = normalizeTitle(source.title)
      if (source.important !== undefined) next.important = normalizeFlag(source.important, 'important')
      if (source.urgent !== undefined) next.urgent = normalizeFlag(source.urgent, 'urgent')
      if (source.dueDate !== undefined) next.dueDate = normalizeDueDate(source.dueDate)
      next.updatedAt = new Date().toISOString()
      state.todos[index] = next
      await guard(persist)
      return snapshot()
    },

    async toggle(input = {}) {
      const source = asRecord(input)
      const index = state.todos.findIndex((todo) => todo.id === requireId(source.id))
      if (index === -1) throw new StoreError('not-found', '这条待办已经不在了')
      const current = state.todos[index]
      const now = new Date().toISOString()
      const done = !current.done
      state.todos[index] = {
        ...current,
        done,
        completedAt: done ? now : null,
        updatedAt: now,
      }
      await guard(persist)
      return snapshot()
    },

    /**
     * Drag-and-drop result: move one row to another quadrant and/or another
     * position. `beforeId` names the row it should sit above (null = last).
     */
    async reorder(input = {}) {
      const source = asRecord(input)
      const id = requireId(source.id)
      const index = state.todos.findIndex((todo) => todo.id === id)
      if (index === -1) throw new StoreError('not-found', '这条待办已经不在了')
      const current = state.todos[index]
      const next = { ...current }
      if (source.important !== undefined) next.important = normalizeFlag(source.important, 'important')
      if (source.urgent !== undefined) next.urgent = normalizeFlag(source.urgent, 'urgent')
      if (source.beforeId !== undefined && source.beforeId !== null && typeof source.beforeId !== 'string') {
        throw new StoreError('invalid-input', 'beforeId 必须是字符串或 null')
      }
      const anchorId = typeof source.beforeId === 'string' && source.beforeId !== '' ? source.beforeId : null
      // Validate the anchor before touching the array: a late throw would
      // otherwise leave the detached row missing from memory and lose it on the
      // next write. `beforeId === id` means "keep this position".
      if (anchorId !== null && anchorId !== id && !state.todos.some((todo) => todo.id === anchorId)) {
        throw new StoreError('not-found', '拖放的目标位置已经不在了')
      }
      state.todos.splice(index, 1)
      let insertAt = state.todos.length
      if (anchorId === id) insertAt = index
      else if (anchorId !== null) insertAt = state.todos.findIndex((todo) => todo.id === anchorId)
      next.updatedAt = new Date().toISOString()
      state.todos.splice(insertAt, 0, next)
      state.reordered = true
      await guard(persist)
      return snapshot()
    },

    async remove(input = {}) {
      const source = asRecord(input)
      const id = requireId(source.id)
      const index = state.todos.findIndex((todo) => todo.id === id)
      if (index === -1) throw new StoreError('not-found', '这条待办已经不在了')
      state.todos.splice(index, 1)
      await guard(persist)
      return snapshot()
    },

    async clearCompleted(input = {}) {
      asRecord(input)
      const before = state.todos.length
      state.todos = state.todos.filter((todo) => !todo.done)
      if (state.todos.length !== before) await guard(persist)
      return snapshot()
    },
  }
}

/** Default data file, resolved from the running profile. */
export function resolveDataFile(override) {
  if (typeof override === 'string' && override.trim() !== '') return override
  const base = process.env.DSH_PROFILE_DIR || process.cwd()
  return join(base, 'data', 'dsh-matrix-todo', 'todos.json')
}
