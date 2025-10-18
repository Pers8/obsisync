import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import VaultList from './components/VaultList'
import VaultSettings from './components/VaultSettings'
import { Plus, Bell, History, Download, Upload, Search, X } from './icons'

type Vault = {
  id: string; name: string; path: string; color: string;
  repoUrl?: string; branch?: string; intervalMin?: number; intervalSec?: number;
  lastSync?: string; onlyIfChanges?: boolean; include?: string; exclude?: string;
  notifyOS?: boolean; notifyOverlay?: boolean; overlayAlpha?: number; overlayScale?: number;
  commitTemplate?: string;
}

type Notification = {
  id: string; type: 'success'|'error'|'info'; message: string; timestamp: Date; vaultId?: string; read?: boolean;
}

type GitHistoryMap = Record<string, string[]>

function useEnterTransition(open: boolean, durationMs = 240) {
  const [render, setRender] = useState(open)
  useEffect(() => {
    if (open) setRender(true)
    else {
      const t = setTimeout(() => setRender(false), durationMs)
      return () => clearTimeout(t)
    }
  }, [open, durationMs])
  return { render, visible: open }
}

function IconButton({ icon, onClick, tooltip, badge }: { icon: React.ReactNode; onClick: () => void; tooltip: string; badge?: number }) {
  const [hover, setHover] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={ref}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={onClick}
        style={{
          position: 'relative', appearance: 'none',
          background: hover ? 'rgba(122,162,247,0.15)' : 'transparent',
          border: 0, borderRadius: 10, width: 28, height: 28,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 160ms ease',
          transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        }}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'linear-gradient(135deg, #ff6b6b, #ff5252)',
            color: 'white', borderRadius: '50%',
            width: 16, height: 16, fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(255,107,107,0.6)',
          }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>
      {hover && createPortal(
        <div style={{
          position: 'fixed',
          top: ref.current?.getBoundingClientRect().bottom! + 8,
          left: ref.current?.getBoundingClientRect().left! + 14,
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,.85)',
          color: '#fff', fontSize: 12,
          padding: '6px 12px', borderRadius: 8,
          pointerEvents: 'none', zIndex: 10000,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {tooltip}
        </div>,
        document.body
      )}
    </>
  )
}

function CustomSelect({ value, onChange, options }: {
  value: string; onChange: (v: any) => void;
  options: {value: string; label: string}[];
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', background: 'rgba(16,28,48,0.7)',
          border: '1.5px solid rgba(52,86,123,0.4)', borderRadius: 10,
          padding: '7px 12px', color: '#C5D4E8', fontSize: '11.5px',
          cursor: 'pointer', transition: 'all 200ms ease',
          fontWeight: 600, textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>{selected?.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms ease' }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div
        aria-hidden={!open}
        style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
          background: 'rgba(16,28,48,0.95)', border: '1px solid rgba(52,86,123,0.5)',
          borderRadius: 12, padding: 6, zIndex: 1000,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          visibility: open ? 'visible' : 'hidden',
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0)' : 'translateY(-4px)',
          transition: 'opacity 160ms ease, transform 160ms ease, visibility 160ms step-end',
        }}
      >
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); setOpen(false) }}
            style={{
              width: '100%', background: value === opt.value ? 'rgba(122,162,247,0.2)' : 'transparent',
              border: 0, borderRadius: 8, padding: '8px 12px',
              color: value === opt.value ? '#7aa2f7' : '#C5D4E8',
              fontSize: '11.5px', cursor: 'pointer', transition: 'all 160ms ease',
              fontWeight: 600, textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = value === opt.value ? 'rgba(122,162,247,0.25)' : 'rgba(122,162,247,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = value === opt.value ? 'rgba(122,162,247,0.2)' : 'transparent'}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function NotificationDrawer({
  open,
  notifications,
  notifFilter,
  unreadCount,
  onFilterChange,
  onToggleRead,
  onClearAll,
  onClose,
}: {
  open: boolean
  notifications: Notification[]
  notifFilter: 'all' | 'unread' | 'read'
  unreadCount: number
  onFilterChange: (v: 'all'|'unread'|'read') => void
  onToggleRead: (id: string) => void
  onClearAll: () => void
  onClose: () => void
}) {
  const { render, visible } = useEnterTransition(open, 260)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    let list = notifications
    if (notifFilter === 'unread') list = list.filter(n => !n.read)
    else if (notifFilter === 'read') list = list.filter(n => !!n.read)
    return [...list].sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [notifications, notifFilter])

  const groups = useMemo(() => {
    const byDay: Record<string, Notification[]> = {}
    for (const n of filtered) {
      const key = n.timestamp.toISOString().slice(0,10)
      if (!byDay[key]) byDay[key] = []
      byDay[key].push(n)
    }
    const orderedDays = Object.keys(byDay).sort((a,b) => b.localeCompare(a))
    return orderedDays.map(day => ({ day, items: byDay[day] }))
  }, [filtered])

  if (!render) return null

  return createPortal(
    <div
      role="dialog"
      aria-hidden={!visible}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        zIndex: 30000,
        opacity: visible ? 1 : 0,
        transition: 'opacity 220ms ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 420,
          background: 'rgba(10,18,35,0.92)',
          borderLeft: '1px solid rgba(122,162,247,0.25)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(16px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: 24,
          borderBottom: '1px solid rgba(52,86,123,0.3)',
          background: 'rgba(10,16,35,0.5)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ color: '#E8F0FF', fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
              Notifications {unreadCount > 0 ? `• ${unreadCount} new` : ''}
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClearAll} style={clearBtnStyle}>Clear All</button>
              <button
                onClick={onClose}
                style={iconCloseBtn}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,45,69,0.8)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(26,45,69,0.6)'}
              >
                <X style={{ width: 16, height: 16, color: '#9DB8D9' }} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'unread', 'read'] as const).map(f => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                style={{
                  ...filterBtnStyle,
                  background: notifFilter === f ? 'rgba(122,162,247,0.2)' : 'rgba(16,28,48,0.6)',
                  borderColor: notifFilter === f ? 'rgba(122,162,247,0.6)' : 'rgba(52,86,123,0.35)',
                  color: notifFilter === f ? '#7aa2f7' : '#9DB8D9',
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,12,24,0.3)' }} className="custom-scroll">
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#6B8099' }}>
              <Bell style={{ width: 56, height: 56, opacity: 0.2, margin: '0 auto 20px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No notifications</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>You're all caught up!</div>
            </div>
          ) : (
            groups.map(({ day, items }) => (
              <div key={day} style={{ marginBottom: 20 }}>
                <button
                  onClick={() => setCollapsed(c => ({...c, [day]: !c[day]}))}
                  style={{
                    width:'100%',
                    display:'flex',alignItems:'center',justifyContent:'space-between',
                    background:'rgba(16,28,48,0.8)',border:'1px solid rgba(52,86,123,0.4)',
                    borderRadius:12,padding:'10px 14px',color:'#C5D4E8',fontWeight:700,fontSize:12,
                    cursor:'pointer', transition:'all 180ms ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,28,48,0.95)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,28,48,0.8)'}
                >
                  <span>{new Date(day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{ opacity:.6 }}>{items.length}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ 
                      transform: collapsed[day] ? 'rotate(-90deg)' : 'rotate(0)', 
                      transition:'transform 200ms ease' 
                    }}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </button>

                {!collapsed[day] && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {items.map(n => (
                      <div
                        key={n.id}
                        style={{
                          background: 'rgba(16,28,48,0.7)',
                          border: '1px solid rgba(52,86,123,0.35)',
                          borderRadius: 14,
                          padding: 16,
                          opacity: n.read ? 0.6 : 1,
                          transition: 'all 200ms ease',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(16,28,48,0.9)'
                          e.currentTarget.style.transform = 'translateX(-2px)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(16,28,48,0.7)'
                          e.currentTarget.style.transform = 'translateX(0)'
                        }}
                        onClick={() => onToggleRead(n.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div
                            style={{
                              width: 10, height: 10, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                              background: n.type === 'success' ? '#34d399' : n.type === 'error' ? '#ff6b6b' : '#7aa2f7',
                              boxShadow: `0 0 12px ${n.type === 'success' ? 'rgba(52,211,153,0.6)' : n.type === 'error' ? 'rgba(255,107,107,0.6)' : 'rgba(122,162,247,0.6)'}`
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#E8F0FF', fontSize: 13.5, marginBottom: 8, lineHeight: 1.5, fontWeight: 500 }}>
                              {n.message}
                            </div>
                            <div style={{ color: '#6B8099', fontSize: 11, fontWeight: 600 }}>
                              {n.timestamp.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

const clearBtnStyle: React.CSSProperties = {
  background: 'rgba(16,28,48,0.7)', border: '1px solid rgba(52,86,123,0.5)',
  borderRadius: 10, padding: '6px 14px', color: '#9DB8D9', fontSize: 11.5,
  cursor: 'pointer', transition: 'all 180ms ease', fontWeight: 600,
}
const filterBtnStyle: React.CSSProperties = {
  flex: 1, padding: '6px 12px', borderRadius: 10, fontSize: 11.5,
  fontWeight: 600, cursor: 'pointer', transition: 'all 180ms ease', border: '1px solid',
}
const iconCloseBtn: React.CSSProperties = {
  background: 'rgba(26,45,69,0.6)',
  border: '1px solid rgba(52,86,123,0.5)',
  borderRadius: 8,
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 180ms ease',
}

type HistItem = {
  hash: string; iso: string; authorName: string; authorEmail: string; subject: string; body: string; date: Date;
}

function HistoryModal({
  open,
  vault,
  rawLines,
  search,
  onSearch,
  onClose,
  onExport,
}: {
  open: boolean
  vault: Vault | null
  rawLines: string[]
  search: string
  onSearch: (s: string) => void
  onClose: () => void
  onExport: () => void
}) {
  const { render, visible } = useEnterTransition(open, 260)
  const [showGraph, setShowGraph] = useState(false)

  // --- Clean Activity Chart (SVG line + area + 7d avg) ---
  function ActivityChart({
    series,
    height = 120,
  }: {
    series: { date: string; count: number }[]
    height?: number
  }) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [hoverIdx, setHoverIdx] = React.useState<number | null>(null)

    const W = 600 // logical width; SVG scales to container
    const H = height
    const pad = { top: 10, right: 12, bottom: 20, left: 12 }

    const n = series.length
    const max = Math.max(1, ...series.map(d => d.count))

    const x = (i: number) =>
      pad.left + (i * (W - pad.left - pad.right)) / Math.max(1, n - 1)
    const y = (c: number) =>
      pad.top + (H - pad.top - pad.bottom) * (1 - c / max)

    const lineD = React.useMemo(() => {
      if (!n) return ''
      let d = `M ${x(0)} ${y(series[0].count)}`
      for (let i = 1; i < n; i++) d += ` L ${x(i)} ${y(series[i].count)}`
      return d
    }, [series])

    const areaD = React.useMemo(() => {
      if (!n) return ''
      let d = `M ${x(0)} ${y(series[0].count)}`
      for (let i = 1; i < n; i++) d += ` L ${x(i)} ${y(series[i].count)}`
      d += ` L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`
      return d
    }, [series])

    // 7-day trailing average
    const avg7 = React.useMemo(() => {
      const arr: number[] = []
      for (let i = 0; i < n; i++) {
        let sum = 0
        let cnt = 0
        for (let k = Math.max(0, i - 6); k <= i; k++) {
          sum += series[k].count
          cnt++
        }
        arr.push(sum / Math.max(1, cnt))
      }
      return arr
    }, [series])

    const avgD = React.useMemo(() => {
      if (!n) return ''
      let d = `M ${x(0)} ${y(avg7[0])}`
      for (let i = 1; i < n; i++) d += ` L ${x(i)} ${y(avg7[i])}`
      return d
    }, [avg7])

    // Gridlines (0/25/50/75/100%)
    const grids = [0, 0.25, 0.5, 0.75, 1].map(p => ({
      y: pad.top + (H - pad.top - pad.bottom) * p,
    }))

    function handleMove(e: React.MouseEvent) {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const innerW = rect.width - pad.left - pad.right
      const px = e.clientX - rect.left - pad.left
      const ratio = Math.max(0, Math.min(1, px / innerW))
      const idx = Math.round(ratio * (n - 1))
      setHoverIdx(idx)
    }

    return (
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          background: 'rgba(6,12,24,0.35)',
          borderRadius: 12,
          border: '1px solid rgba(52,86,123,0.25)',
          padding: 8,
        }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(122,162,247,0.28)" />
              <stop offset="100%" stopColor="rgba(122,162,247,0.02)" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7aa2f7" />
              <stop offset="100%" stopColor="#5a82d7" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {grids.map((g, i) => (
            <line
              key={i}
              x1={pad.left}
              x2={W - pad.right}
              y1={g.y}
              y2={g.y}
              stroke="rgba(52,86,123,0.25)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}

          {/* Area */}
          <path d={areaD} fill="url(#areaGrad)" stroke="none" />

          {/* Main line */}
          <path
            d={lineD}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth={2}
            style={{ filter: 'drop-shadow(0 0 6px rgba(122,162,247,0.35))' }}
          />

          {/* 7d average */}
          <path d={avgD} fill="none" stroke="#34d399" strokeWidth={1.5} opacity={0.9} />

          {/* Hover cursor/point */}
          {hoverIdx !== null && (
            <>
              <line
                x1={x(hoverIdx)}
                x2={x(hoverIdx)}
                y1={pad.top}
                y2={H - pad.bottom}
                stroke="rgba(122,162,247,0.5)"
                strokeWidth={1}
              />
              <circle
                cx={x(hoverIdx)}
                cy={y(series[hoverIdx].count)}
                r={3.5}
                fill="#7aa2f7"
                stroke="white"
                strokeWidth={1}
              />
            </>
          )}
        </svg>

        {/* X-axis labels */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
            fontSize: 10,
            color: '#6B8099',
            fontWeight: 600,
            padding: '0 2px',
          }}
        >
          <span>
            {series.length
              ? new Date(series[0].date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : ''}
          </span>
          <span>Today</span>
        </div>

        {/* Tooltip */}
        {hoverIdx !== null && (
          <div
            style={{
              position: 'absolute',
              left: `calc(${pad.left}px + ${(hoverIdx / Math.max(1, n - 1)) * 100}% - 50px)`,
              top: 6,
              transform: 'translateX(-50%)',
              background: 'rgba(10,18,35,0.92)',
              border: '1px solid rgba(122,162,247,0.35)',
              borderRadius: 8,
              padding: '6px 8px',
              color: '#C5D4E8',
              fontSize: 11,
              fontWeight: 600,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
            }}
          >
            {new Date(series[hoverIdx].date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
            {' • '}
            {series[hoverIdx].count} commit{series[hoverIdx].count !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    )
  }
  // --- end chart ---

  const items: HistItem[] = useMemo(() => {
    const parsed = (rawLines || []).map(line => {
      const parts = line.split('|')
      const [hash='-', iso='', authorName='-', authorEmail='-', subject='', ...rest] = parts
      const body = rest.join('|')
      const d = iso ? new Date(iso) : new Date()
      return { hash, iso, authorName, authorEmail, subject, body, date: d }
    })
    return parsed.sort((a,b) => b.date.getTime() - a.date.getTime())
  }, [rawLines])

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(it =>
      it.subject.toLowerCase().includes(q) ||
      it.hash.toLowerCase().includes(q) ||
      it.authorName.toLowerCase().includes(q) ||
      it.authorEmail.toLowerCase().includes(q) ||
      (it.body && it.body.toLowerCase().includes(q))
    )
  }, [items, search])

  const byDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const it of items) {
      const k = it.date.toISOString().slice(0,10)
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [items])

  const last30 = useMemo(() => {
    const arr: { date: string; count: number }[] = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      const key = d.toISOString().slice(0,10)
      arr.push({ date: key, count: byDate.get(key) || 0 })
    }
    return arr
  }, [byDate])

  const total30 = last30.reduce((s, x) => s + x.count, 0)
  const activeDays = last30.filter(x => x.count > 0).length
  const maxDay = last30.reduce((m, x) => x.count > m.count ? x : m, { date: '', count: -1 })
  const avg7 = (() => {
    let sum = 0
    for (let i=last30.length-7;i<last30.length;i++) sum += last30[i]?.count || 0
    return (sum/7)
  })()

  if (!render) return null

  return createPortal(
    <div
      aria-hidden={!visible}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 40000,
        opacity: visible ? 1 : 0,
        transition: 'opacity 220ms ease',
        padding: 40,
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(10,18,35,0.92)',
          border: '1px solid rgba(122,162,247,0.25)',
          borderRadius: 24,
          width: '100%',
          maxWidth: 760,
          maxHeight: '85vh',
          backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
          opacity: visible ? 1 : 0,
          transition: 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: 24,
          borderBottom: '1px solid rgba(52,86,123,0.3)',
          background: 'rgba(10,16,35,0.5)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ color: '#E8F0FF', fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4, letterSpacing: '-0.01em' }}>
                Git History
              </h3>
              <p style={{ color: '#6B8099', fontSize: 13, margin: 0, fontWeight: 500 }}>
                {vault?.name} • {filtered.length} commit{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {items.length > 0 && (
                <>
                  <button
                    onClick={() => setShowGraph(!showGraph)}
                    title={showGraph ? 'Hide graph' : 'Show graph'}
                    style={{
                      background: showGraph ? 'rgba(122,162,247,0.2)' : 'rgba(16,28,48,0.8)',
                      border: '1px solid', borderColor: showGraph ? 'rgba(122,162,247,0.6)' : 'rgba(52,86,123,0.5)',
                      color: showGraph ? '#7aa2f7' : '#C5D4E8',
                      borderRadius: 10, width: 36, height: 36,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 180ms ease',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M7 16l4-4 3 3 5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={onExport}
                    title="Export to CSV"
                    style={{
                      background: 'rgba(16,28,48,0.8)',
                      border: '1px solid rgba(52,86,123,0.5)',
                      color:'#C5D4E8',
                      borderRadius: 10, padding: '8px 14px', fontSize: 11.5, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 180ms ease',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(122,162,247,0.15)'
                      e.currentTarget.style.borderColor = 'rgba(122,162,247,0.6)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(16,28,48,0.8)'
                      e.currentTarget.style.borderColor = 'rgba(52,86,123,0.5)'
                    }}
                  >
                    <Download style={{ width: 14, height: 14 }} />
                    CSV
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                style={iconCloseBtn}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,45,69,0.9)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(26,45,69,0.6)'}
              >
                <X style={{ width: 18, height: 18, color: '#9DB8D9' }} />
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: showGraph ? 16 : 0 }}>
            <input
              type="text"
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="Search commits..."
              style={{
                width: '100%',
                background: 'rgba(16,28,48,0.7)',
                border: '1px solid rgba(52,86,123,0.4)',
                borderRadius: 10,
                padding: '8px 12px 8px 36px',
                color: '#C5D4E8',
                fontSize: 12.5,
                outline: 'none',
                transition: 'all 180ms ease',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#7aa2f7'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(52,86,123,0.4)'}
            />
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#7aa2f7' }} />
          </div>

          {showGraph && items.length > 0 && (
            <div style={{
              padding: 18,
              background: 'linear-gradient(135deg, rgba(16,28,48,0.8), rgba(10,18,35,0.6))',
              borderRadius: 16,
              border: '1px solid rgba(122,162,247,0.25)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.2)',
              animation: 'slideUpFade 400ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:3, height:20, borderRadius:999, background:'linear-gradient(to bottom, #7aa2f7, #5a82d7)', boxShadow:'0 0 12px rgba(122,162,247,0.6)' }} />
                  <span style={{ color:'#E8F0FF', fontSize:13, fontWeight:700, letterSpacing:'0.03em' }}>ACTIVITY OVERVIEW</span>
                </div>
                <span style={{ color:'#6B8099', fontSize:10, fontWeight:600 }}>Last 30 Days</span>
              </div>

              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:16 }}>
                <div style={{
                  background:'rgba(122,162,247,0.12)',
                  border:'1px solid rgba(122,162,247,0.3)',
                  borderRadius:12,
                  padding:'10px 12px',
                  transition:'all 200ms ease',
                }} onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(122,162,247,0.18)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }} onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(122,162,247,0.12)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}>
                  <div style={{ fontSize:22, fontWeight:800, color:'#7aa2f7', marginBottom:4, letterSpacing:'-0.02em' }}>{total30}</div>
                  <div style={{ fontSize:9, color:'#9DB8D9', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Total</div>
                </div>
                <div style={{
                  background:'rgba(52,211,153,0.12)',
                  border:'1px solid rgba(52,211,153,0.3)',
                  borderRadius:12,
                  padding:'10px 12px',
                  transition:'all 200ms ease',
                }} onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(52,211,153,0.18)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }} onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(52,211,153,0.12)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}>
                  <div style={{ fontSize:22, fontWeight:800, color:'#34d399', marginBottom:4, letterSpacing:'-0.02em' }}>{maxDay.count}</div>
                  <div style={{ fontSize:9, color:'#9DB8D9', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Peak Day</div>
                </div>
                <div style={{
                  background:'rgba(245,158,11,0.12)',
                  border:'1px solid rgba(245,158,11,0.3)',
                  borderRadius:12,
                  padding:'10px 12px',
                  transition:'all 200ms ease',
                }} onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(245,158,11,0.18)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }} onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(245,158,11,0.12)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}>
                  <div style={{ fontSize:22, fontWeight:800, color:'#f59e0b', marginBottom:4, letterSpacing:'-0.02em' }}>{avg7.toFixed(1)}</div>
                  <div style={{ fontSize:9, color:'#9DB8D9', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>7d Avg</div>
                </div>
                <div style={{
                  background:'rgba(168,139,250,0.12)',
                  border:'1px solid rgba(168,139,250,0.3)',
                  borderRadius:12,
                  padding:'10px 12px',
                  transition:'all 200ms ease',
                }} onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(168,139,250,0.18)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }} onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(168,139,250,0.12)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}>
                  <div style={{ fontSize:22, fontWeight:800, color:'#a78bfa', marginBottom:4, letterSpacing:'-0.02em' }}>{activeDays}</div>
                  <div style={{ fontSize:9, color:'#9DB8D9', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Active</div>
                </div>
              </div>

              {/* Chart (new) */}
              <ActivityChart series={last30} />

              {/* Streak */}
              {(() => {
                let currentStreak = 0
                let longestStreak = 0
                let tempStreak = 0
                for (let i = last30.length - 1; i >= 0; i--) {
                  if (last30[i].count > 0) {
                    tempStreak++
                    if (i === last30.length - 1 || currentStreak > 0) currentStreak = tempStreak
                  } else {
                    tempStreak = 0
                  }
                  longestStreak = Math.max(longestStreak, tempStreak)
                }
                return currentStreak > 0 || longestStreak > 0 ? (
                  <div style={{
                    marginTop:12,
                    padding:'10px 14px',
                    background:'rgba(52,211,153,0.08)',
                    border:'1px solid rgba(52,211,153,0.2)',
                    borderRadius:12,
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{
                        width:8, height:8, borderRadius:'50%',
                        background:'#34d399',
                        boxShadow:'0 0 12px rgba(52,211,153,0.8)',
                        animation:'pulse 2s ease-in-out infinite',
                      }} />
                      <span style={{ fontSize:11, color:'#34d399', fontWeight:700 }}>
                        {currentStreak > 0 ? `${currentStreak} day streak! 🔥` : 'Start a new streak!'}
                      </span>
                    </div>
                    {longestStreak > 0 && (
                      <span style={{ fontSize:10, color:'#9DB8D9', fontWeight:600 }}>
                        Longest: {longestStreak} days
                      </span>
                    )}
                  </div>
                ) : null
              })()}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'rgba(6,12,24,0.3)' }} className="custom-scroll">
          {filtered.length === 0 ? (
            <div style={{ color: '#9DB8D9', textAlign: 'center', padding: 80 }}>
              <History style={{ width: 64, height: 64, opacity: 0.2, margin: '0 auto 24px' }} />
              <div style={{ fontSize: 16, marginBottom: 10, fontWeight: 600 }}>
                {search ? 'No matching commits' : 'No commits yet'}
              </div>
              <span style={{ fontSize: 13, color: '#6B8099', display: 'block', lineHeight: 1.6 }}>
                {search ? 'Try a different search query' : 'Sync your vault to see the commit history here'}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Object.entries(
                filtered.reduce((acc, it) => {
                  const k = it.date.toISOString().slice(0,10)
                  ;(acc[k] ||= []).push(it)
                  return acc
                }, {} as Record<string, HistItem[]>)
              )
              .sort((a,b)=>b[0].localeCompare(a[0]))
              .map(([day, items]) => (
                <div key={day}>
                  <div
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px',
                      background: 'rgba(16,28,48,0.8)',
                      border: '1px solid rgba(52,86,123,0.4)',
                      borderRadius: 12, color: '#C5D4E8', fontWeight: 700, fontSize: 12,
                      marginBottom: 14,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#7aa2f7', boxShadow: '0 0 10px rgba(122,162,247,0.5)' }} />
                    {new Date(day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {items.map((it, idx) => (
                      <div
                        key={`${it.hash}-${idx}`}
                        style={{
                          background: 'rgba(16,28,48,0.7)',
                          border: '1px solid rgba(52,86,123,0.35)',
                          borderRadius: 14, padding: 16, transition: 'all 200ms ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(16,28,48,0.9)'
                          e.currentTarget.style.borderColor = 'rgba(122,162,247,0.4)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(16,28,48,0.7)'
                          e.currentTarget.style.borderColor = 'rgba(52,86,123,0.35)'
                        }}
                      >
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div style={{ marginTop: 4 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#7aa2f7', boxShadow: '0 0 10px rgba(122,162,247,0.6)' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#E8F0FF', fontSize: 14, marginBottom: 10, lineHeight: 1.5, fontWeight: 600 }}>
                              {it.subject || 'Untitled commit'}
                            </div>
                            <div style={{
                              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px',
                              color: '#6B8099', fontSize: 11.5, fontWeight: 600,
                            }}>
                              <span style={{ opacity: 0.7 }}>Hash:</span>
                              <span style={{ fontFamily: 'monospace', color: '#7aa2f7' }}>{it.hash.slice(0, 12)}</span>
                              <span style={{ opacity: 0.7 }}>Time:</span>
                              <span>{it.date.toLocaleString()}</span>
                              <span style={{ opacity: 0.7 }}>Author:</span>
                              <span>{it.authorName} &lt;{it.authorEmail}&gt;</span>
                              {it.body && (<><span style={{ opacity: 0.7 }}>Body:</span><span style={{ color: '#8AA5C3' }}>{it.body}</span></>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}


function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { render, visible } = useEnterTransition(open, 240)
  const shortcuts = [
    { key: '⌘ S', desc: 'Sync selected vault', category: 'Actions' },
    { key: '⌘ N', desc: 'Add new vault', category: 'Actions' },
    { key: '⌘ F', desc: 'Focus search', category: 'Navigation' },
    { key: '⌘ H', desc: 'Toggle notifications', category: 'Navigation' },
    { key: '⌘ /', desc: 'Show shortcuts', category: 'Help' },
    { key: '?', desc: 'Show shortcuts', category: 'Help' },
    { key: 'ESC', desc: 'Close modals', category: 'Navigation' },
    { key: '⌘ ⇧ R', desc: 'Clear history (in modal)', category: 'Actions' },
  ]
  
  const grouped = shortcuts.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {} as Record<string, typeof shortcuts>)

  if (!render) return null
  return createPortal(
    <div
      aria-hidden={!visible}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50000,
        opacity: visible ? 1 : 0,
        transition: 'opacity 220ms ease',
        padding: 40,
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(16,28,48,0.95), rgba(10,18,35,0.9))',
          border: '1px solid rgba(122,162,247,0.3)',
          borderRadius: 24,
          width: 580, maxWidth: '90vw',
          backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
          opacity: visible ? 1 : 0,
          transition: 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease',
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 48px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: 24,
          borderBottom: '1px solid rgba(52,86,123,0.3)',
          background: 'linear-gradient(to bottom, rgba(122,162,247,0.08), transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:40, height:40, borderRadius:12,
              background:'linear-gradient(135deg, rgba(122,162,247,0.2), rgba(122,162,247,0.1))',
              border:'1px solid rgba(122,162,247,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 3h6l1 3h5l-1 15H4L3 6h5l1-3z" stroke="#7aa2f7" strokeWidth="1.6" strokeLinejoin="round"/>
                <circle cx="12" cy="14" r="2" stroke="#7aa2f7" strokeWidth="1.6"/>
              </svg>
            </div>
            <div>
              <h3 style={{ color: '#E8F0FF', fontSize: 19, fontWeight: 700, margin: 0, marginBottom: 2, letterSpacing:'-0.01em' }}>
                Keyboard Shortcuts
              </h3>
              <p style={{ color: '#6B8099', fontSize: 12, margin: 0, fontWeight: 500 }}>
                Master your workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              ...iconCloseBtn,
              width: 36, height: 36,
              background: 'rgba(26,45,69,0.6)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,107,107,0.15)'
              e.currentTarget.style.borderColor = 'rgba(255,107,107,0.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(26,45,69,0.6)'
              e.currentTarget.style.borderColor = 'rgba(52,86,123,0.5)'
            }}
          >
            <X style={{ width: 18, height: 18, color: '#9DB8D9' }} />
          </button>
        </div>
        <div style={{ padding: 24, background: 'rgba(6,12,24,0.3)', maxHeight:'70vh', overflowY:'auto' }} className="custom-scroll">
          {Object.entries(grouped).map(([category, items], catIdx) => (
            <div key={category} style={{ marginBottom: catIdx < Object.keys(grouped).length - 1 ? 20 : 0 }}>
              <div style={{
                fontSize: 11, color: '#7aa2f7', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ width:3, height:14, borderRadius:999, background:'linear-gradient(to bottom, #7aa2f7, #5a82d7)' }} />
                {category}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {items.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', 
                      background: 'linear-gradient(135deg, rgba(16,28,48,0.8), rgba(16,28,48,0.6))',
                      border: '1px solid rgba(52,86,123,0.3)',
                      borderRadius: 14, 
                      transition: 'all 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                      animation: `slideUpFade ${300 + i * 50}ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(122,162,247,0.12), rgba(122,162,247,0.08))'
                      e.currentTarget.style.borderColor = 'rgba(122,162,247,0.4)'
                      e.currentTarget.style.transform = 'translateX(4px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,28,48,0.8), rgba(16,28,48,0.6))'
                      e.currentTarget.style.borderColor = 'rgba(52,86,123,0.3)'
                      e.currentTarget.style.transform = 'translateX(0)'
                    }}
                  >
                    <span style={{ color: '#C5D4E8', fontSize: 13.5, fontWeight: 500 }}>{s.desc}</span>
                    <kbd style={{
                      background: 'linear-gradient(135deg, rgba(122,162,247,0.2), rgba(122,162,247,0.1))',
                      border: '1.5px solid rgba(122,162,247,0.4)',
                      borderRadius: 8, padding: '5px 12px',
                      color: '#7aa2f7', fontSize: 11.5, fontWeight: 700, fontFamily: 'monospace',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 8px rgba(122,162,247,0.15)',
                      letterSpacing: '0.05em',
                    }}>
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

function StatusBar({
  vaults,
  vaultStats,
  syncStatus,
}: {
  vaults: Vault[]
  vaultStats: Record<string, {files?: number; commits?: number; size?: string}>
  syncStatus: Record<string, 'syncing'|'success'|'error'>
}) {
  const totalFiles = vaults.reduce((sum, v) => sum + (vaultStats[v.id]?.files || 0), 0)
  const syncing = Object.values(syncStatus).filter(s => s === 'syncing').length
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
      background: 'linear-gradient(to top, rgba(10,16,35,.9), rgba(10,16,35,.4))',
      borderTop: '1px solid rgba(122,162,247,.2)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', fontSize: 11.5, color: '#c9d6f3', zIndex: 20000,
    }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', minWidth: 0 }}>
        <div style={{width:6, height:6, borderRadius:9999, background:'#7aa2f7', boxShadow:'0 0 8px rgba(122,162,247,.5)'}} />
        <span style={{ fontWeight: 600, letterSpacing: '.02em' }}>{vaults.length} vault{vaults.length !== 1 ? 's' : ''}</span>
        <span style={{ opacity: 0.35 }}>•</span>
        <span>{totalFiles} files</span>
        {syncing > 0 && (
          <>
            <span style={{ opacity: 0.35 }}>•</span>
            <span style={{ color: '#7aa2f7', fontWeight: 600 }}>
              {syncing} syncing…
            </span>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 10.5, color: '#9fb5db', fontWeight: 600 }}>
        <span>⌘S Sync</span><span>•</span><span>⌘N New</span><span>•</span><span>? Help</span>
      </div>
    </div>
  )
}

function Toast({ showToast }: { showToast: { message: string; type: 'success'|'error'|'info' } | null }) {
  if (!showToast) return null
  return createPortal(
    <div style={{
      position: 'fixed', bottom: 60, right: 24, zIndex: 50000,
      background: 'rgba(10,18,35,0.95)',
      border: '1px solid rgba(122,162,247,0.4)',
      borderRadius: 14,
      padding: '14px 18px',
      minWidth: 300,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 300ms ease',
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: showToast.type === 'success' ? '#34d399' : showToast.type === 'error' ? '#ff6b6b' : '#7aa2f7',
        boxShadow: `0 0 16px ${showToast.type === 'success' ? 'rgba(52,211,153,0.7)' : showToast.type === 'error' ? 'rgba(255,107,107,0.7)' : 'rgba(122,162,247,0.7)'}`
      }} />
      <div style={{ color: '#E8F0FF', fontSize: 13.5, flex: 1, fontWeight: 500 }}>{showToast.message}</div>
    </div>,
    document.body
  )
}

export default function App(){
  const [vaults, setVaults] = useState<Vault[]>([])
  const [sel, setSel] = useState<string|null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all'|'active'|'error'>('all')
  const [selectedVaults, setSelectedVaults] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false)
  const [notifFilter, setNotifFilter] = useState<'all'|'unread'|'read'>('all')

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyVaultId, setHistoryVaultId] = useState<string|null>(null)
  const [historySearch, setHistorySearch] = useState('')

  const [syncStatus, setSyncStatus] = useState<Record<string, 'syncing'|'success'|'error'>>({})
  const [vaultStats, setVaultStats] = useState<Record<string, {files?: number; commits?: number; size?: string}>>({})

  const [showToast, setShowToast] = useState<{message: string; type: 'success'|'error'|'info'} | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const [gitHistory, setGitHistory] = useState<GitHistoryMap>({})

  const selected = useMemo(()=> vaults.find(v=>v.id===sel) || null, [sel, vaults])

  const filteredVaults = useMemo(()=> {
    let result = vaults
    if (searchQuery) {
      result = result.filter(v =>
        (v.name||'').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.path||'').toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    if (filterStatus !== 'all') {
      result = result.filter(v => {
        if (filterStatus === 'active') return !!v.path
        if (filterStatus === 'error') return syncStatus[v.id] === 'error'
        return true
      })
    }
    return result
  }, [vaults, searchQuery, filterStatus, syncStatus])

  const unreadCount = notifications.filter(n => !n.read).length

  function reviveNotifications(raw: any[]): Notification[] {
    return (raw || []).map(n => ({
      ...n,
      timestamp: n.timestamp ? new Date(n.timestamp) : new Date(),
    })).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime())
  }
  async function saveNotifications(next: Notification[]) {
    const ordered = [...next].sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime())
    setNotifications(ordered)
    await window.electronAPI?.storeSet('notifications', ordered)
  }

  function setVaultHistory(vaultId: string, lines: string[]) {
    setGitHistory(prev => ({ ...prev, [vaultId]: lines }))
  }
  async function refreshGitHistory(vaultId: string, limit = 500) {
    const lines = await window.electronAPI?.gitGetLog?.(vaultId, limit)
    if (Array.isArray(lines)) setVaultHistory(vaultId, lines)
  }

  useEffect(()=>{ (async()=> {
    const loadedVaults = await window.electronAPI?.storeGet('vaults') || []
    setVaults(loadedVaults)
    loadedVaults.forEach((v: Vault) => {
      loadVaultStats(v.id)
      refreshGitHistory(v.id, 200)
    })
    const saved = await window.electronAPI?.storeGet('notifications')
    if (saved) setNotifications(reviveNotifications(saved))
  })() },[])

  async function reloadVaultsFromStore() {
    const stored = await window.electronAPI?.storeGet('vaults')
    if (Array.isArray(stored)) setVaults(stored)
  }

  async function loadVaultStats(vaultId: string) {
    try {
      const stats = await window.electronAPI?.getVaultStats?.(vaultId)
      if (stats) setVaultStats(prev => ({ ...prev, [vaultId]: stats }))
    } catch {}
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey

      if (e.key === 'Escape') {
        if (shortcutsOpen) { e.preventDefault(); setShortcutsOpen(false); return }
        if (historyOpen) { e.preventDefault(); setHistoryOpen(false); setHistoryVaultId(null); setHistorySearch(''); return }
        if (notifDrawerOpen) { e.preventDefault(); setNotifDrawerOpen(false); return }
      }

      if (e.key === '?' && !historyOpen && !notifDrawerOpen && !shortcutsOpen) {
        e.preventDefault(); setShortcutsOpen(true); return
      }

      if (isMod && e.key === '/') { e.preventDefault(); setShortcutsOpen(true); return }
      if (isMod && e.key === 's') { e.preventDefault(); if (selected) syncNow(selected) }
      if (isMod && e.key === 'f') { e.preventDefault(); (document.getElementById('search-input') as HTMLInputElement | null)?.focus() }
      if (isMod && e.key === 'n') { e.preventDefault(); addVault() }
      if (isMod && e.key === 'h') { e.preventDefault(); setNotifDrawerOpen(s=>!s) }

      if (isMod && e.shiftKey && e.key.toLowerCase() === 'r' && historyOpen && historyVaultId) {
        e.preventDefault()
        setVaultHistory(historyVaultId, [])
        showToastMessage('History cleared (local only)', 'info')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected, historyOpen, historyVaultId, notifDrawerOpen, shortcutsOpen])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onActivity) return

    const timers: Record<string, number> = {}

    const onActivity = (payload: any) => {
      const id = payload?.id
      if (!id) return

      if (timers[id]) window.clearTimeout(timers[id])
      timers[id] = window.setTimeout(() => {
        loadVaultStats(id)
        delete timers[id]
      }, 300)

      if (payload.type === 'sync-complete' || payload.event === 'sync') {
        const isoNow = new Date().toISOString()
        setSyncStatus(prev => ({...prev, [id]: 'success'}))
        setVaults(prev => prev.map(v => v.id === id ? { ...v, lastSync: isoNow } : v))
        reloadVaultsFromStore()
        refreshGitHistory(id, 200)
        setTimeout(() => {
          setSyncStatus(prev => { const n = {...prev}; delete n[id]; return n })
        }, 1600)
      }
    }
    api.onActivity(onActivity)

    const offGit = api.onGitEntry?.(({ id, line }: { id: string, line: string }) => {
      if (!id || !line) return
      setGitHistory(prev => {
        const cur = prev[id] || []
        if (cur[0] === line) return prev
        return { ...prev, [id]: [line, ...cur].slice(0, 1000) }
      })
    })

    return () => {
      try { api?.off?.('vault:activity', onActivity) } catch {}
      if (offGit) try { offGit() } catch {}
      Object.values(timers).forEach(t => window.clearTimeout(t))
    }
  }, [])

  useEffect(() => {
    if (notifDrawerOpen) {
      setTimeout(() => {
        saveNotifications((notifications || []).map(n => ({ ...n, read: true })))
      }, 300)
    }
  }, [notifDrawerOpen])

  function addNotification(type: Notification['type'], message: string, vaultId?: string) {
    const notif: Notification = {
      id: Math.random().toString(36).slice(2),
      type, message, timestamp: new Date(), vaultId, read: false
    }
    saveNotifications([notif, ...notifications].slice(0, 200))
    if (type !== 'success') showToastMessage(message, type)
  }

  function showToastMessage(message: string, type: 'success'|'error'|'info') {
    setShowToast({ message, type })
    setTimeout(() => setShowToast(null), 3000)
  }

  async function saveVaults(n:Vault[]){
    setVaults(n)
    await window.electronAPI?.storeSet?.('vaults', n)
  }

  function addVault(){
    const id=Math.random().toString(36).slice(2)
    const pal=['#7aa2f7','#f472b6','#f59e0b','#34d399','#60a5fa','#a78bfa','#f87171','#22d3ee']
    const color=pal[(vaults.length)%pal.length]
    const v:Vault={id,name:'New Vault',path:'',color,intervalSec:600,overlayAlpha:0.55,overlayScale:0.92,notifyOverlay:true,onlyIfChanges:true,branch:'main',commitTemplate:'ObsiSync: {count} files — {date}'}
    saveVaults([...(vaults||[]),v])
    setSel(id)
    addNotification('info', 'New vault created')
  }

  async function pickFolder(v:Vault){
    const p = await window.electronAPI?.pickFolder?.()
    if(!p) return
    const n=vaults.map(x=>x.id===v.id?{...x,path:p,name:x.name==='New Vault'?p.split(/[\\/]/).pop()!:x.name}:x)
    saveVaults(n)
    loadVaultStats(v.id)
    refreshGitHistory(v.id, 200)
  }

  async function syncNow(v:Vault){
    setSyncStatus(prev => ({...prev, [v.id]: 'syncing'}))
    try {
      const result = await window.electronAPI?.vaultSync?.(v.id)
      if (result?.error) {
        setSyncStatus(prev => ({...prev, [v.id]: 'error'}))
        addNotification('error', `Failed to sync ${v.name}: ${result.error}`, v.id)
      }
    } catch {
      setSyncStatus(prev => ({...prev, [v.id]: 'error'}))
      addNotification('error', `Failed to sync ${v.name}`, v.id)
    } finally {
      setTimeout(() => setSyncStatus(prev => { const n = {...prev}; delete n[v.id]; return n }), 1500)
    }
  }

  function removeVault(id: string) {
    const n = vaults.filter(v => v.id !== id)
    saveVaults(n)
    if (sel === id) setSel(n[0]?.id ?? null)
    addNotification('info', 'Vault removed')
  }

  function renameVault(id: string) { setSel(id) }

  function toggleBulkSelect(id: string) {
    setSelectedVaults(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function bulkSync() {
    for (const id of selectedVaults) {
      const v = vaults.find(x => x.id === id)
      if (v) await syncNow(v)
    }
  }

  function bulkRemove() {
    const n = vaults.filter(v => !selectedVaults.has(v.id))
    saveVaults(n)
    setSelectedVaults(new Set())
    addNotification('info', `${selectedVaults.size} vaults removed`)
  }

  return (
    <>
      <div className="titlebar">
        <div className="tb-left">
          <div style={{width:8, height:8, borderRadius:9999, background:'#7aa2f7', boxShadow:'0 0 10px rgba(122,162,247,.55)'}} />
          <div className="tb-title">ObsiSync</div>
        </div>
        <div className="tb-right">
          <button className="tb-btn" title="Keyboard Shortcuts (⌘/)" onClick={() => setShortcutsOpen(true)}>
            <svg className="tb-icon" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
            </svg>
          </button>
          <button className="tb-btn" title="Minimize" onClick={()=>window.electronAPI?.minimizeWindow?.()}>
            <svg className="tb-icon" viewBox="0 0 24 24" fill="none"><path d="M6 12h12" /></svg>
          </button>
          <button className="tb-btn" title="Close" onClick={()=>window.electronAPI?.closeWindow?.()}>
            <svg className="tb-icon" viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" /></svg>
          </button>
        </div>
      </div>

      <div className="withTitlebar h-full grid sidebarShell" style={{ gridTemplateColumns: '360px 1fr', paddingBottom: 40 }}>
        <aside className="border rounded-xl m-3 mr-2 p-3 flex flex-col h-[calc(100%-2.5rem)] min-h-0" style={{
          backgroundColor: 'rgba(6, 22, 42, 0.5)', borderColor: 'rgba(52, 86, 123, 0.5)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          backgroundImage:
            'radial-gradient(circle at 0.5px 0.5px, rgba(255,255,255,0.1) 0.2px, transparent 1px), ' +
            'radial-gradient(circle at 1.5px 1.5px, rgba(0,0,0,0.1) 0.2px, transparent 1px), ' +
            'radial-gradient(circle at 0 0, rgba(255,255,255,0.1) 1px, transparent 1.2px)',
          backgroundSize: '2px 2px, 2px 2px, 6px 6px',
          backgroundBlendMode: 'overlay, overlay, overlay',
          filter: 'contrast(110%) brightness(102.5%)',
          overflow: 'hidden',
        }}>
          <div style={{ marginBottom: 14 }}>
            <div className="flex items-center justify-between mb-3">
              <div style={{ color: '#7AA2F7', fontSize: 13, fontWeight: 600, letterSpacing: '0.03em' }}>VAULT MANAGER</div>
              <div className="flex items-center gap-1">
                <IconButton icon={<Bell className="w-4 h-4" style={{color:'#9DB8D9'}} />} onClick={() => setNotifDrawerOpen(true)} tooltip="Notifications" badge={unreadCount} />
                <IconButton icon={<History className="w-4 h-4" style={{color:'#9DB8D9'}} />} onClick={() => { setHistoryOpen(true); setHistoryVaultId(sel) }} tooltip="History" />
                <IconButton icon={<Download className="w-4 h-4" style={{color:'#9DB8D9'}} />} onClick={() => {}} tooltip="Export" />
                <IconButton icon={<Upload className="w-4 h-4" style={{color:'#9DB8D9'}} />} onClick={() => {}} tooltip="Import" />
                <IconButton icon={<Plus className="w-4 h-4" style={{color:'#7aa2f7'}} />} onClick={addVault} tooltip="Add vault" />
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                id="search-input" type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search vaults..."
                className="search-input"
              />
              <Search className="w-4 h-4" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7aa2f7' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <CustomSelect value={filterStatus} onChange={setFilterStatus} options={[
                  { value: 'all', label: 'All Vaults' },
                  { value: 'active', label: 'Active' },
                  { value: 'error', label: 'Errors' },
                ]} />
              </div>
              <button 
                onClick={() => { setBulkMode(!bulkMode); setSelectedVaults(new Set()) }} 
                style={{
                  background: bulkMode 
                    ? 'linear-gradient(135deg, rgba(122,162,247,0.25), rgba(122,162,247,0.15))'
                    : 'rgba(16,28,48,0.7)',
                  border: '1.5px solid',
                  borderColor: bulkMode ? 'rgba(122,162,247,0.6)' : 'rgba(52,86,123,0.4)',
                  borderRadius: 12,
                  padding: '7px 16px',
                  color: bulkMode ? '#7aa2f7' : '#9DB8D9',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.02em',
                  boxShadow: bulkMode 
                    ? 'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 3px rgba(122,162,247,0.12)'
                    : 'none',
                  transform: bulkMode ? 'scale(1.02)' : 'scale(1)',
                }}
                onMouseEnter={e => {
                  if (!bulkMode) {
                    e.currentTarget.style.background = 'rgba(122,162,247,0.12)'
                    e.currentTarget.style.borderColor = 'rgba(122,162,247,0.5)'
                    e.currentTarget.style.transform = 'scale(1.02)'
                  }
                }}
                onMouseLeave={e => {
                  if (!bulkMode) {
                    e.currentTarget.style.background = 'rgba(16,28,48,0.7)'
                    e.currentTarget.style.borderColor = 'rgba(52,86,123,0.4)'
                    e.currentTarget.style.transform = 'scale(1)'
                  }
                }}
              >
                {bulkMode ? '✓ Bulk Mode' : 'Bulk Actions'}
              </button>
            </div>
          </div>

          {bulkMode && (
            <div style={{
              marginBottom: 12,
              padding: 12,
              background: 'rgba(16,28,48,0.8)',
              border: '1px solid rgba(122,162,247,0.35)',
              borderRadius: 12,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}>
              <div style={{ fontSize: 11, color: '#9DB8D9', fontWeight: 700, marginBottom: 10, letterSpacing: '0.02em' }}>
                BULK ACTIONS • {selectedVaults.size} SELECTED
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setSelectedVaults(new Set(filteredVaults.map(v => v.id)))}
                  disabled={selectedVaults.size === filteredVaults.length}
                  style={{
                    flex: 1,
                    background: 'rgba(16,28,48,0.7)',
                    border: '1px solid rgba(52,86,123,0.4)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    color: '#9DB8D9',
                    fontSize: 10.5,
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                    fontWeight: 600,
                    opacity: selectedVaults.size === filteredVaults.length ? 0.4 : 1,
                  }}
                >
                  Select All
                </button>

                <button
                  onClick={() => setSelectedVaults(new Set())}
                  disabled={selectedVaults.size === 0}
                  style={{
                    flex: 1,
                    background: 'rgba(16,28,48,0.7)',
                    border: '1px solid rgba(52,86,123,0.4)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    color: '#9DB8D9',
                    fontSize: 10.5,
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                    fontWeight: 600,
                    opacity: selectedVaults.size === 0 ? 0.4 : 1,
                  }}
                >
                  Deselect
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button
                  onClick={bulkSync}
                  disabled={selectedVaults.size === 0}
                  style={{
                    flex: 1,
                    background: 'rgba(52,211,153,0.15)',
                    border: '1px solid rgba(52,211,153,0.4)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    color: '#34d399',
                    fontSize: 10.5,
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                    fontWeight: 600,
                    opacity: selectedVaults.size === 0 ? 0.4 : 1,
                  }}
                >
                  Sync
                </button>

                <button
                  onClick={bulkRemove}
                  disabled={selectedVaults.size === 0}
                  style={{
                    flex: 1,
                    background: 'rgba(255,107,107,0.15)',
                    border: '1px solid rgba(255,107,107,0.4)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    color: '#ff6b6b',
                    fontSize: 10.5,
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                    fontWeight: 600,
                    opacity: selectedVaults.size === 0 ? 0.4 : 1,
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          <div className="mt-2 flex-1 min-h-0 scrollerClip">
            <div className="custom-scroll pr-1">
              <VaultList
                items={filteredVaults} selectedId={sel} onSelect={setSel}
                onOpenPath={(id:any) => window.electronAPI?.openPath?.(id)}
                onRemove={removeVault} onRename={renameVault}
                bulkMode={bulkMode} selectedVaults={selectedVaults}
                onToggleBulkSelect={toggleBulkSelect} syncStatus={syncStatus}
                vaultStats={vaultStats}
              />
            </div>
          </div>

          <div className="text-[10px] pt-2" style={{ color: '#6B8099' }}>Press ⌘S to sync • ? for shortcuts</div>
        </aside>

        <main className="h-[calc(100%-2.5rem)] m-3 ml-2 p-4 border rounded-xl panel" style={{
          backgroundColor: 'rgba(6, 22, 42, 0.65)', borderColor: 'rgba(52, 86, 123, 0.5)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(6px)', overflow: 'hidden',
          backgroundImage:
            'radial-gradient(circle at 0.5px 0.5px, rgba(255,255,255,0.1) 0.2px, transparent 1px), ' +
            'radial-gradient(circle at 1.5px 1.5px, rgba(0,0,0,0.1) 0.2px, transparent 1px), ' +
            'radial-gradient(circle at 0 0, rgba(255,255,255,0.1) 1px, transparent 1.2px)',
          backgroundSize: '2px 2px, 2px 2px, 6px 6px',
          backgroundBlendMode: 'overlay, overlay, overlay',
          filter: 'contrast(110%) brightness(102.5%)',
        }}>
          <div className="h-full">
            {selected ? (
              <VaultSettings
                key={selected.id} value={selected}
                onChange={(nv: any) => saveVaults(vaults.map(v => v.id === nv.id ? nv : v))}
                onPick={() => pickFolder(selected)} onSync={() => syncNow(selected)}
                onShowHistory={() => { setHistoryVaultId(selected.id); setHistoryOpen(true) }}
                stats={vaultStats[selected.id]}
                vaultColor={selected.color}
                onOpenGitHub={() => {
                  if (!selected.repoUrl) return
                  let url = selected.repoUrl.trim()
                  if (url.startsWith('git@github.com:')) {
                    url = url.replace('git@github.com:', 'https://github.com/')
                  }
                  if (url.startsWith('ssh://git@github.com/')) {
                    url = url.replace('ssh://git@github.com/', 'https://github.com/')
                  }
                  url = url.replace(/\.git$/, '')
                  if (!/^https?:\/\//.test(url)) {
                    url = `https://github.com/${url}`
                  }
                  const branch = (selected.branch || 'main').trim()
                  const fullUrl = `${url}/tree/${encodeURIComponent(branch)}`
                  window.electronAPI?.openExternal?.(fullUrl)
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center" style={{ color: '#6B8099' }}>
                <div style={{ textAlign: 'center' }}>
                  <Plus style={{ width: 56, height: 56, opacity: 0.2, margin: '0 auto 16px' }} />
                  <div>Select a vault or press ⌘N to add one.</div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <StatusBar vaults={vaults} vaultStats={vaultStats} syncStatus={syncStatus} />
      <NotificationDrawer
        open={notifDrawerOpen}
        notifications={notifications}
        notifFilter={notifFilter}
        unreadCount={unreadCount}
        onFilterChange={setNotifFilter}
        onToggleRead={(id) => {
          const next = notifications.map(notif => notif.id === id ? { ...notif, read: !notif.read } : notif)
          saveNotifications(next)
        }}
        onClearAll={() => saveNotifications([])}
        onClose={() => setNotifDrawerOpen(false)}
      />
      <HistoryModal
        open={historyOpen}
        vault={vaults.find(v => v.id === historyVaultId) || null}
        rawLines={(historyVaultId && gitHistory[historyVaultId]) ? gitHistory[historyVaultId] : []}
        search={historySearch}
        onSearch={setHistorySearch}
        onClose={() => { setHistoryOpen(false); setHistoryVaultId(null); setHistorySearch('') }}
        onExport={() => {
          const vault = vaults.find(v => v.id === historyVaultId)
          const lines = (historyVaultId && gitHistory[historyVaultId]) ? gitHistory[historyVaultId] : []
          if (!vault || lines.length === 0) return
          const items = lines.map(line => {
            const parts = line.split('|')
            const [hash='', iso='', authorName='', authorEmail='', subject='', ...rest] = parts
            const body = rest.join('|')
            return { hash, iso, authorName, authorEmail, subject, body }
          })
          const esc = (s: string) => {
            const v = s ?? ''
            if (v.includes('"') || v.includes(',') || v.includes('\n')) {
              return `"${v.replace(/"/g, '""')}"`
            }
            return v
          }
          const header = 'hash,iso,authorName,authorEmail,subject,body'
          const rows = items.map(i => [i.hash, i.iso, i.authorName, i.authorEmail, i.subject, i.body].map(esc).join(',')).join('\n')
          const csv = header + '\n' + rows
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `git-history-${vault.name || vault.id}-${new Date().toISOString().slice(0,10)}.csv`
          a.click()
          URL.revokeObjectURL(url)
          setShowToast({ message: 'Git history exported to CSV', type: 'success' })
          setTimeout(() => setShowToast(null), 3000)
        }}
      />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Toast showToast={showToast} />

      <style>{`
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDownFade { 
          from { opacity: 0; transform: translateY(-12px) scaleY(0.95); } 
          to { opacity: 1; transform: translateY(0) scaleY(1); } 
        }
        @keyframes barGrow {
          from { transform: scaleY(0); opacity: 0; }
          to { transform: scaleY(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        
        .titlebar{
          position: absolute; top: 0; left: 0; right: 0; height: 40px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 10px 0 14px;
          background: linear-gradient(to bottom, rgba(10,16,35,.85), rgba(10,16,35,.35));
          border-bottom: 1.5px solid rgba(80,120,180,.28);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          z-index: 20000; -webkit-app-region: drag;
        }
        .tb-left{ display:flex; align-items:center; gap:10px; min-width:0; }
        .tb-title{ font-size:13px; letter-spacing:.04em; color:#c9d6f3; opacity:.9; }
        .tb-right{ display:flex; align-items:center; gap:6px; -webkit-app-region: no-drag; }
        .tb-btn{ appearance:none; border:0; background:transparent; width:30px; height:30px; border-radius:9px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; transition: transform 140ms ease, background 140ms ease, opacity 140ms ease; opacity:.9; }
        .tb-btn:hover{ background: rgba(255,255,255,.06); transform: scale(1.03); opacity:1; }
        .tb-btn:active{ transform: scale(.98); }
        .tb-icon{ width:13.5px; height:13.5px; opacity:.9; }
        .tb-icon path, .tb-icon circle{ stroke:#cfe0ff; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }

        .withTitlebar{ padding-top: 40px; }
        .scrollerClip{ position: relative; overflow: hidden; height: 100%; padding-right: 8px; }

        .custom-scroll{ height: 100%; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; margin-right: -10px; padding-right: 10px; }
        @supports not selector(::-webkit-scrollbar) { .custom-scroll{ scrollbar-width: thin; scrollbar-color: rgba(128,191,255,0.3) transparent; } }
        .custom-scroll::-webkit-scrollbar{ width: 6px; background: transparent; }
        .custom-scroll::-webkit-scrollbar-track{ background: rgba(10,10,10,0.35); border-radius: 999px; border: 1px solid rgba(255,255,255,0.075); }
        .custom-scroll::-webkit-scrollbar-thumb{ background: linear-gradient(to bottom, rgba(128,191,255,0.4), rgba(128,191,255,0.25)); border-radius: 999px; }

        .search-input{
          width: 100%; background: rgba(16,28,48,0.7); border: 1.5px solid rgba(52,86,123,0.4);
          border-radius: 11px; padding: 8px 12px 8px 36px; color: #C5D4E8; font-size: 12.5px;
          outline: none; transition: all 200ms ease; font-weight: 500;
        }
        .search-input::placeholder{ color: #6B8099; }
      `}</style>
    </>
  )
}