/** ─────────────────────────────────────────────────────────────────────────────
 *  Imports
 *  ───────────────────────────────────────────────────────────────────────────*/
import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  Tray,
  Menu,
  dialog,
  shell,
  nativeImage,
  screen
} from 'electron'
import path from 'node:path'
import Store from 'electron-store'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import chokidar from 'chokidar'

/** Discord Rich Presence */
import RPC from 'discord-rpc'

/** ─────────────────────────────────────────────────────────────────────────────
 *  Constants
 *  ───────────────────────────────────────────────────────────────────────────*/
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1428920385776386078'
const MIN_PRESENCE_INTERVAL_MS = 15_000
const SYNC_DONE_SHOW_MS = 5_000

// Splash / window animation tunables
const SPLASH_DURATION_MS = 6300       // how long to keep the splash visible
const SHOW_ANIM_MS       = 320        // main window show animation
const HIDE_ANIM_MS       = 200        // main window hide animation
const SHOW_SCALE_FROM    = 1.1       // start scale of the show animation

/** ─────────────────────────────────────────────────────────────────────────────
 *  Store & Globals
 *  ───────────────────────────────────────────────────────────────────────────*/
const store = new Store({
  name: 'settings',
  defaults: { vaults: [], paused: false, notifications: [] }
})

let tray = null
let win = null
let overlay = null
let splash = null
let quitting = false

/** per-vault watchers + schedulers */
const watchers = new Map() // id -> chokidar FSWatcher
const timers = new Map()   // id -> setInterval ID

/** ─────────────────────────────────────────────────────────────────────────────
 *  Utilities (notifications, git helpers, size, etc.)
 *  ───────────────────────────────────────────────────────────────────────────*/
function notifyOS(title, body) {
  new Notification({ title, body, silent: false }).show()
}

function runGit(cwd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn('git', args, { cwd })
    let out = '', err = ''
    p.stdout.on('data', d => (out += d.toString()))
    p.stderr.on('data', d => (err += d.toString()))
    p.on('close', c => (c === 0 ? resolve({ out, err }) : reject(new Error(err || out))))
  })
}

async function ensureRepo(v) {
  const gitDir = path.join(v.path, '.git')
  if (!fs.existsSync(gitDir)) {
    await runGit(v.path, ['init'])
    if (v.branch) await runGit(v.path, ['checkout', '-B', v.branch])
  }
  if (v.repoUrl) {
    try { await runGit(v.path, ['remote', 'set-url', 'origin', v.repoUrl]) }
    catch { await runGit(v.path, ['remote', 'add', 'origin', v.repoUrl]) }
  }
}

async function countChanges(cwd) {
  const s = await runGit(cwd, ['status', '--porcelain'])
  return s.out.split('\n').filter(Boolean).length
}

function countFilesUnder(root) {
  let count = 0
  function walk(p) {
    for (const dirent of fs.readdirSync(p, { withFileTypes: true })) {
      if (dirent.name === '.obsidian') continue
      const fp = path.join(p, dirent.name)
      if (dirent.isDirectory()) walk(fp)
      else count++
    }
  }
  try { walk(root) } catch {}
  return count
}

async function getGitCommitCount(cwd) {
  try {
    const result = await runGit(cwd, ['rev-list', '--count', 'HEAD'])
    return parseInt(result.out.trim()) || 0
  } catch { return 0 }
}

function getDirSize(dirPath) {
  let totalSize = 0
  function walk(p) {
    try {
      for (const dirent of fs.readdirSync(p, { withFileTypes: true })) {
        const fp = path.join(p, dirent.name)
        if (dirent.isDirectory()) {
          if (dirent.name !== '.git') walk(fp)
        } else {
          try { totalSize += fs.statSync(fp).size } catch {}
        }
      }
    } catch {}
  }
  walk(dirPath)

  if (totalSize < 1024) return totalSize + ' B'
  if (totalSize < 1024 * 1024) return (totalSize / 1024).toFixed(1) + ' KB'
  if (totalSize < 1024 * 1024 * 1024) return (totalSize / (1024 * 1024)).toFixed(1) + ' MB'
  return (totalSize / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  Overlay (toast) window
 *  ───────────────────────────────────────────────────────────────────────────*/
function createOverlay() {
  if (overlay && !overlay.isDestroyed()) return overlay
  const bounds = screen.getPrimaryDisplay().workArea

  overlay = new BrowserWindow({
    width: 360,
    height: 200,
    x: bounds.x + bounds.width - 360 - 16,
    y: bounds.y + bounds.height - 200 - 16,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(process.cwd(), 'electron', 'overlay_preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  overlay.setIgnoreMouseEvents(true)

  const devUrl = process.env.VITE_DEV_SERVER
  if (devUrl) overlay.loadURL(devUrl + '/notify.html')
  else overlay.loadFile(path.join(process.cwd(), 'public', 'notify.html'))

  return overlay
}

function showOverlay(payload) {
  const o = createOverlay()
  o.webContents.send('overlay:show', payload)
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  Window animations (show / hide)
 *  ───────────────────────────────────────────────────────────────────────────*/
function animateShowWindow(targetWin, ms = SHOW_ANIM_MS, fromScale = SHOW_SCALE_FROM) {
  if (!targetWin) return
  try { targetWin.setOpacity(0) } catch {}

  // Try a scale-like effect by resizing around center + fade in.
  const bounds = targetWin.getBounds()
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  const startW = Math.round(bounds.width * fromScale)
  const startH = Math.round(bounds.height * fromScale)

  const steps = Math.max(12, Math.floor(ms / 16))
  let i = 0

  targetWin.setBounds({
    x: Math.round(cx - startW / 2),
    y: Math.round(cy - startH / 2),
    width: startW,
    height: startH
  }, false)

  targetWin.showInactive?.()
  const timer = setInterval(() => {
    i++
    const t = i / steps
    const ease = t < 1 ? (1 - Math.pow(1 - t, 3)) : 1 // cubic out

    const w = Math.round(startW + (bounds.width - startW) * ease)
    const h = Math.round(startH + (bounds.height - startH) * ease)
    const x = Math.round(cx - w / 2)
    const y = Math.round(cy - h / 2)

    try {
      targetWin.setBounds({ x, y, width: w, height: h }, false)
      targetWin.setOpacity(0 + ease)
    } catch {}

    if (i >= steps) {
      clearInterval(timer)
      try {
        targetWin.setBounds(bounds, false)
        targetWin.setOpacity(1)
        targetWin.focus()
      } catch {}
    }
  }, Math.max(8, Math.floor(ms / steps)))
}

function animateHideWindow(targetWin, ms = HIDE_ANIM_MS) {
  if (!targetWin) return Promise.resolve()
  return new Promise(resolve => {
    const steps = Math.max(10, Math.floor(ms / 16))
    let i = 0
    const startOpacity = targetWin.getOpacity?.() ?? 1
    const timer = setInterval(() => {
      i++
      const t = i / steps
      const ease = t * t // quad in
      try { targetWin.setOpacity(startOpacity * (1 - ease)) } catch {}
      if (i >= steps) {
        clearInterval(timer)
        try { targetWin.hide(); targetWin.setOpacity(1) } catch {}
        resolve()
      }
    }, Math.max(8, Math.floor(ms / steps)))
  })
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  App Window & Tray
 *  ───────────────────────────────────────────────────────────────────────────*/
function resolveIcon() {
  const candidates = ['logo.ico', 'icon.ico', 'app.ico']
  for (const name of candidates) {
    const p = path.join(process.cwd(), 'build', name)
    try {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) return p
    } catch {}
  }
  return null
}

async function createWindow({ deferShow = false } = {}) {
  const iconPath = resolveIcon()
  win = new BrowserWindow({
    width: 1160,
    height: 720,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    titleBarStyle: 'hidden',
    hasShadow: true,
    autoHideMenuBar: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    minimizable: true,
    show: !deferShow,
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(process.cwd(), 'electron', 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  win.setMenuBarVisibility(false)

  const devUrl = process.env.VITE_DEV_SERVER
  if (devUrl) await win.loadURL(devUrl)
  else await win.loadFile(path.join(process.cwd(), 'dist', 'index.html'))

  // Intercept OS/window close (fade-to-tray)
  win.on('close', async (e) => {
    if (!quitting) {
      e.preventDefault()
      await animateHideWindow(win, HIDE_ANIM_MS)
    }
  })
}

function rebuildTray() {
  const iconPath = resolveIcon()
  let trayIcon
  if (iconPath) {
    try { trayIcon = nativeImage.createFromPath(iconPath) } catch {}
  }
  if (!trayIcon || trayIcon.isEmpty()) trayIcon = nativeImage.createEmpty()

  if (!tray) tray = new Tray(trayIcon)
  else tray.setImage(trayIcon)

  const menu = Menu.buildFromTemplate([
    { label: 'Open ObsiSync', click: () => { win?.show(); win?.focus() } },
    { type: 'separator' },
    { label: 'Sync all now', click: async () => {
        const tasks = store.get('vaults').map(v => syncVault(v))
        await Promise.all(tasks)
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit() } }
  ])
  tray.setToolTip('ObsiSync')
  tray.setContextMenu(menu)
  tray.on('click', () => { win?.show(); win?.focus() })
  tray.on('right-click', () => { win?.show(); win?.focus() })
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  Schedulers (watch + interval)
 *  ───────────────────────────────────────────────────────────────────────────*/
function startWatcher(v) {
  if (watchers.has(v.id)) return
  const w = chokidar.watch(v.path, { ignored: /(^|[/\\])\./, ignoreInitial: true })
  w.on('all', (event, f) => win?.webContents.send('vault:activity', { id: v.id, event, file: f }))
  watchers.set(v.id, w)
}

function getIntervalSeconds(v) {
  const s = v.intervalSec ?? (v.intervalMin ? v.intervalMin * 60 : 600)
  return Math.max(30, Number(s) || 600)
}

function scheduleVault(v) {
  if (timers.has(v.id)) clearInterval(timers.get(v.id))
  const ms = getIntervalSeconds(v) * 1000
  timers.set(v.id, setInterval(() => syncVault(v), ms))
}

function reloadSchedulers() {
  for (const [, t] of timers) clearInterval(t)
  timers.clear()
  if (store.get('paused')) return
  const vs = store.get('vaults')
  vs.forEach(v => {
    if (v.path && fs.existsSync(v.path)) {
      startWatcher(v)
      scheduleVault(v)
    }
  })
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  Discord Rich Presence (session-stable elapsed time)
 *  ───────────────────────────────────────────────────────────────────────────*/
let rpc = null
let lastPresenceAt = 0
let presenceTimer = null
let revertIdleTimer = null
const syncStartTimes = new Map()
const sessionStartTs = Math.floor(Date.now() / 1000)

function initDiscordRPC() {
  if (!DISCORD_CLIENT_ID) {
    console.log('[RPC] Skipping: no DISCORD_CLIENT_ID set')
    return
  }
  try { RPC.register(DISCORD_CLIENT_ID) } catch {}

  rpc = new RPC.Client({ transport: 'ipc' })
  rpc.on('ready', () => {
    console.log('[RPC] Ready as', rpc.user?.username)
    setPresenceIdle()
  })
  rpc.login({ clientId: DISCORD_CLIENT_ID }).catch(err => {
    console.error('[RPC] Login failed', err)
  })
}

function setPresence(activity, opts = { preserveSessionTs: true }) {
  if (!rpc) return
  if (opts.preserveSessionTs !== false && !activity.startTimestamp) {
    activity.startTimestamp = sessionStartTs
  }
  const now = Date.now()
  const wait = Math.max(0, MIN_PRESENCE_INTERVAL_MS - (now - lastPresenceAt))
  const apply = () => {
    lastPresenceAt = Date.now()
    rpc.setActivity(activity).catch(() => {})
  }
  if (wait > 0) {
    clearTimeout(presenceTimer)
    presenceTimer = setTimeout(apply, wait)
  } else {
    apply()
  }
}

function setPresenceIdle() {
  clearTimeout(revertIdleTimer)
  setPresence({
    details: 'Idle',
    state: 'Waiting for changes',
    largeImageKey: 'obsisync_logo',
    largeImageText: 'ObsiSync',
    smallImageKey: 'idle',
    smallImageText: 'Idle'
  }, { preserveSessionTs: true })
}

function setPresencePaused() {
  clearTimeout(revertIdleTimer)
  setPresence({
    details: 'Paused',
    state: 'Schedulers disabled',
    largeImageKey: 'obsisync_logo',
    smallImageKey: 'idle',
    smallImageText: 'Paused'
  }, { preserveSessionTs: true })
}

function toHttpsGithub(url) {
  if (!url) return null
  if (url.startsWith('git@github.com:')) {
    const slug = url.split(':')[1]?.replace(/\.git$/, '')
    if (slug) return `https://github.com/${slug}`
  }
  if (/^https?:\/\/(www\.)?github\.com\//i.test(url)) return url
  return null
}

function showVaultStatsPresence(v, stats) {
  clearTimeout(revertIdleTimer)
  const state = [
    stats?.files != null ? `${stats.files} files` : null,
    stats?.commits != null ? `${stats.commits} commits` : null,
    stats?.size || null
  ].filter(Boolean).join(' • ')
  const httpsRepo = toHttpsGithub(v?.repoUrl)
  setPresence({
    details: `Vault: ${v?.name || 'No vault'}`,
    state: state || 'Ready',
    largeImageKey: 'obsisync_logo',
    largeImageText: 'ObsiSync',
    buttons: httpsRepo ? [{ label: 'Open Repo', url: httpsRepo }] : undefined
  }, { preserveSessionTs: true })
}

function presenceSyncStart(v) {
  clearTimeout(revertIdleTimer)
  const started = Date.now()
  syncStartTimes.set(v.id, started)
  setPresence({
    details: `Syncing: ${v?.name || 'No vault'}`,
    state: 'Committing & pushing…',
    startTimestamp: Math.floor(started / 1000),
    largeImageKey: 'obsisync_logo',
    smallImageKey: 'sync',
    smallImageText: 'Syncing'
  }, { preserveSessionTs: false })
}

function presenceSyncDone(v, changed) {
  const started = syncStartTimes.get(v.id)
  clearTimeout(revertIdleTimer)
  setPresence({
    details: `Synced: ${v?.name || 'No vault'}`,
    state: `${changed} files`,
    startTimestamp: started ? Math.floor(started / 1000) : sessionStartTs,
    largeImageKey: 'obsisync_logo',
    smallImageKey: 'done',
    smallImageText: 'Done'
  }, { preserveSessionTs: false })
  revertIdleTimer = setTimeout(() => setPresenceIdle(), SYNC_DONE_SHOW_MS)
}

function presenceError(v, message) {
  clearTimeout(revertIdleTimer)
  setPresence({
    details: `Error: ${v?.name || 'No vault'}`,
    state: (message || '').slice(0, 100),
    largeImageKey: 'obsisync_logo',
    smallImageKey: 'error',
    smallImageText: 'Error'
  }, { preserveSessionTs: true })
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  Sync Pipeline
 *  ───────────────────────────────────────────────────────────────────────────*/
async function syncVault(v) {
  if (store.get('paused')) return { skipped: true }
  const started = new Date()

  try {
    presenceSyncStart(v)
    await ensureRepo(v)

    if (v.onlyIfChanges && (await countChanges(v.path)) === 0) {
      const p = { type:'info', text:`${v.name}: no changes to commit.`, title:'ObsiSync', meta:'', alpha: v.overlayAlpha ?? 0.55, scale: v.overlayScale ?? 0.92 }
      if (v.notifyOverlay !== false) showOverlay(p)
      setPresenceIdle()
      return { changed: 0, skipped: true }
    }

    await runGit(v.path, ['add', '-A'])
    const changed = await countChanges(v.path)
    if (changed === 0) { setPresenceIdle(); return { changed: 0, skipped: true } }

    const msg = (v.commitTemplate || 'ObsiSync: {count} files — {date}')
      .replace('{count}', String(changed))
      .replace('{date}', started.toLocaleString())

    await runGit(v.path, ['commit', '-m', msg])
    if (v.branch) {
      try { await runGit(v.path, ['pull', '--rebase', 'origin', v.branch]) } catch {}
      await runGit(v.path, ['push', 'origin', v.branch])
    }

    // Update lastSync
    const vaults = store.get('vaults')
    const idx = vaults.findIndex(x => x.id === v.id)
    if (idx !== -1) {
      vaults[idx].lastSync = new Date().toISOString()
      store.set('vaults', vaults)
    }

    // Emit latest commit line for History
    const fmt = '%H|%cI|%an|%ae|%s|%b'
    try {
      const latest = await runGit(v.path, ['log', '-1', `--pretty=${fmt}`])
      const line = (latest.out || '').split('\n')[0] || ''
      if (line) win?.webContents.send('vault:git-entry', { id: v.id, line })
    } catch {}

    // Toast
    const payload = { type:'success', text:`${v.name} synced ${changed} files`, title:'ObsiSync', meta:new Date().toLocaleTimeString(), alpha: v.overlayAlpha ?? 0.55, scale: v.overlayScale ?? 0.92 }
    if (v.notifyOS) notifyOS('ObsiSync', `${v.name} synced ${changed} files`)
    if (v.notifyOverlay !== false) showOverlay(payload)

    // UI event
    win?.webContents.send('vault:activity', { id: v.id, event: 'sync', type: 'sync-complete' })

    // RPC done
    presenceSyncDone(v, changed)

    // Optional: refresh stats presence
    try {
      const files = countFilesUnder(v.path)
      const commits = await getGitCommitCount(v.path)
      const size = getDirSize(v.path)
      showVaultStatsPresence(v, { files, commits, size })
    } catch {}

    return { changed }
  } catch (e) {
    const err = e?.message || String(e)
    const payload = { type:'error', text:`${v.name} ${err.slice(0,120)}`, title:'ObsiSync', meta:'', alpha: v.overlayAlpha ?? 0.55, scale: v.overlayScale ?? 0.92 }
    showOverlay(payload)
    notifyOS('ObsiSync error', err.slice(0,120))
    presenceError(v, err)
    return { error: err }
  }
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  Splash Window (cold start only)
 *  ───────────────────────────────────────────────────────────────────────────*/
function createSplashWindow() {
  if (splash && !splash.isDestroyed()) return splash
  const primary = screen.getPrimaryDisplay().workArea
  const width = 820
  const height = 520
  splash = new BrowserWindow({
    width,
    height,
    x: Math.round(primary.x + (primary.width - width) / 2),
    y: Math.round(primary.y + (primary.height - height) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  const devUrl = process.env.VITE_DEV_SERVER
  if (devUrl) splash.loadURL(devUrl + '/splash.html')
  else splash.loadFile(path.join(process.cwd(), 'public', 'splash.html'))
  return splash
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  App Lifecycle
 *  ───────────────────────────────────────────────────────────────────────────*/
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)

  // Cold start: create main window hidden, show splash, then animate main in.
  await createWindow({ deferShow: true })
  createOverlay()
  rebuildTray()
  reloadSchedulers()
  initDiscordRPC()

  const s = createSplashWindow()
  s.once('ready-to-show', () => s.showInactive?.())
  setTimeout(async () => {
    try { s.destroy() } catch {}
    animateShowWindow(win, SHOW_ANIM_MS, SHOW_SCALE_FROM)
  }, SPLASH_DURATION_MS)
})

app.on('before-quit', () => {
  quitting = true
  ;[presenceTimer, revertIdleTimer].forEach(t => { try { clearTimeout(t) } catch {} })
  if (rpc) { try { rpc.destroy() } catch {} }
})

app.on('window-all-closed', () => {
  // keep app running in tray
})

/** ─────────────────────────────────────────────────────────────────────────────
 *  IPC
 *  ───────────────────────────────────────────────────────────────────────────*/
ipcMain.handle('win:minimize', () => { win?.minimize(); return true })

ipcMain.handle('win:close', async () => {
  if (!win) return false
  await animateHideWindow(win, HIDE_ANIM_MS)
  return true
})

ipcMain.handle('dialog:pickFolder', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (r.canceled) return null
  return r.filePaths[0]
})

ipcMain.handle('store:get', (_, k) => Store.prototype.get.call(store, k))

ipcMain.handle('store:set', (_, k, v) => {
  Store.prototype.set.call(store, k, v)
  reloadSchedulers()
  return true
})

ipcMain.handle('vault:sync', async (_, id) => {
  const v = store.get('vaults').find(x => x.id === id)
  if (v) return await syncVault(v)
  return null
})

ipcMain.handle('vault:openPath', (_, id) => {
  const v = store.get('vaults').find(x => x.id === id)
  if (v?.path) shell.openPath(v.path)
})

ipcMain.handle('paused:toggle', () => {
  store.set('paused', !store.get('paused'))
  reloadSchedulers()
  rebuildTray()
  const paused = store.get('paused')
  paused ? setPresencePaused() : setPresenceIdle()
  return paused
})

ipcMain.handle('vault:countFiles', async (_e, root) => countFilesUnder(root))

ipcMain.handle('vault:getStats', async (_e, id) => {
  const v = store.get('vaults').find(x => x.id === id)
  if (!v || !v.path) return { files: undefined, commits: undefined, size: undefined }
  const files = countFilesUnder(v.path)
  const commits = await getGitCommitCount(v.path)
  const size = getDirSize(v.path)
  showVaultStatsPresence(v, { files, commits, size })
  return { files, commits, size }
})

ipcMain.handle('git:getLog', async (_e, id, limit = 500) => {
  const v = store.get('vaults').find(x => x.id === id)
  if (!v || !v.path) return []
  try {
    const fmt = '%H|%cI|%an|%ae|%s|%b'
    const res = await runGit(v.path, ['log', `--pretty=${fmt}`, '-n', String(limit)])
    return res.out.split('\n').filter(Boolean)
  } catch { return [] }
})

ipcMain.handle('shell:openExternal', async (_e, url) => {
  try { await shell.openExternal(url); return true }
  catch (err) { console.error('Failed to open external URL:', err); return false }
})
