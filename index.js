/** Host half of the matrix-todo bundle: one JSON route over the file-backed store. */

import { createStore, resolveDataFile } from './lib/store.js'

export const name = 'dsh-matrix-todo'
export const inject = ['webServer']

const PREFIX = '/matrix-todo/api/'
const STATUS = { 'invalid-input': 400, 'not-found': 404, 'io-error': 500 }

function sendJson(res, status, body, extraHeaders) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  })
  res.end(text)
}

/** Body is JSON; an empty body and malformed JSON both count as {}. */
async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    return {}
  }
}

function isLoopbackPeer(address) {
  if (address === undefined) return false
  const plain = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address
  return plain === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(plain)
}

/**
 * Same-origin / loopback fence. The connection service is authoritative when present;
 * otherwise fall back to the same checks the harness engine uses for local routes.
 * Returns undefined when allowed, or the HTTP status of the refusal.
 */
function refusalOf(ctx, req) {
  const connection = ctx.get('connection')
  if (typeof connection?.requestRejection === 'function') return connection.requestRejection(req)
  if (!isLoopbackPeer(req.socket?.remoteAddress)) return 403
  const host = req.headers.host
  if (host !== undefined) {
    if (!URL.canParse(`http://${host}`)) return 403
    const name = new URL(`http://${host}`).hostname
    if (name !== 'localhost' && name !== '[::1]' && !/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(name)) return 403
  }
  const site = req.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return 403
  const origin = req.headers.origin
  if (origin === undefined) return undefined
  if (!URL.canParse(origin)) return 403
  return new URL(origin).host === host ? undefined : 403
}

const ACTIONS = {
  list: (store) => store.list(),
  seed: (store, body) => store.seed(body),
  create: (store, body) => store.create(body),
  update: (store, body) => store.update(body),
  toggle: (store, body) => store.toggle(body),
  remove: (store, body) => store.remove(body),
  clearCompleted: (store, body) => store.clearCompleted(body),
  reorder: (store, body) => store.reorder(body),
}

/** Every response carries the full list plus the layout preferences. */
function resultOf(store) {
  return { todos: store.list(), settings: store.settings(), seeded: store.seeded() }
}

export function apply(ctx, config = {}) {
  // config.dataPath: optional override for the data file
  // (default: %DSH_PROFILE_DIR%/data/dsh-matrix-todo/todos.json).
  const store = createStore({ file: resolveDataFile(config.dataPath) })
  const ready = store.load()
  void ready.catch(() => {}) // keep load failures out of the unhandled-rejection path; callers still await it

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/matrix-todo/api',
    handler: async (req, res) => {
      try {
        if (refusalOf(ctx, req) !== undefined) {
          sendJson(res, 403, { ok: false, error: { code: 'forbidden', message: '请求来源不受信任' } })
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: { code: 'method', message: '只支持 POST' } }, { allow: 'POST' })
          return
        }
        const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
        const action = pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length) : ''
        const known = action === 'saveSettings' || Object.hasOwn(ACTIONS, action)
        if (action === '' || action.includes('/') || !known) {
          sendJson(res, 404, { ok: false, error: { code: 'not-found', message: '未知接口' } })
          return
        }
        await ready
        const body = await readJson(req)
        if (action === 'saveSettings') await store.saveSettings(body)
        else await ACTIONS[action](store, body)
        sendJson(res, 200, { ok: true, result: resultOf(store) })
      } catch (err) {
        const code = typeof err?.code === 'string' && err.code !== '' ? err.code : 'internal'
        sendJson(res, STATUS[code] ?? 500, {
          ok: false,
          error: { code, message: err?.message ?? '待办操作失败' },
        })
      }
    },
  }), 'matrix-todo: http')

  ctx.effect(() => () => { void store.close() }, 'matrix-todo: store')
}
