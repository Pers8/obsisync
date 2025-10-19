import { createPortal } from 'react-dom';
import React from 'react'
import { RefreshCw } from '../icons'

type Vault = {
  id:string; name:string; path:string; color:string;
  repoUrl?:string; branch?:string; intervalMin?:number; intervalSec?:number;
  lastSync?:string; onlyIfChanges?:boolean; include?:string; exclude?:string;
  notifyOS?:boolean; notifyOverlay?:boolean; overlayAlpha?:number; overlayScale?:number;
  commitTemplate?:string
}

function toGitHubUrl(repoUrl?: string, branch?: string): string | null {
  if (!repoUrl) return null
  let url = repoUrl.trim()
  if (!url) return null

  // ssh -> https
  if (url.startsWith('git@github.com:')) {
    url = url.replace('git@github.com:', 'https://github.com/')
  }
  if (url.startsWith('ssh://git@github.com/')) {
    url = url.replace('ssh://git@github.com/', 'https://github.com/')
  }

  // remove trailing .git
  url = url.replace(/\.git$/, '')

  // support "github.com/user/repo" or "user/repo"
  if (!/^https?:\/\//.test(url)) {
    url = url.replace(/^github\.com\//, '')
    url = `https://github.com/${url}`
  }

  const br = (branch || 'main').trim()
  return `${url}/tree/${encodeURIComponent(br)}`
}

export default function VaultSettings({
  value, onChange, onPick, onSync, onShowHistory, stats, vaultColor, onOpenGitHub
}:{
  value:Vault
  onChange:(v:Vault)=>void
  onPick:()=>void
  onSync:()=>void
  onShowHistory?:()=>void
  stats?: {files?: number; commits?: number; size?: string}
  vaultColor?: string
  onOpenGitHub?: () => void
}){
  function set(p:Partial<Vault>){ onChange({ ...value, ...p }) }
  const interval = value.intervalSec ?? (value.intervalMin ? value.intervalMin * 60 : 600)
  const alpha = value.overlayAlpha ?? 0.55
  const scale = value.overlayScale ?? 0.92

  const getSectionTitleColor = () => {
    const hex = vaultColor || '#7aa2f7'
    const s = hex.replace("#", "")
    const n = s.length === 3 ? s.split("").map((c) => c + c).join("") : s
    const v = parseInt(n, 16)
    const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255
    return `linear-gradient(90deg, rgba(${r},${g},${b},0.9), rgba(${r},${g},${b},0.6))`
  }

  // Enter-once gate for section “pop-in” without re-triggering on rerenders.
  const [entered, setEntered] = React.useState(false)
  React.useEffect(() => { const t = requestAnimationFrame(() => setEntered(true)); return () => cancelAnimationFrame(t) }, [])

  function InputWithFocus(props: React.InputHTMLAttributes<HTMLInputElement>) {
    const [focused, setFocused] = React.useState(false)
    return (
      <div className="relative" style={{ display: 'inline-block', width: '100%', overflow: 'visible' }}>
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: 0, borderRadius: '0.75rem',
            boxShadow: focused ? 'inset 0 0 0 3px rgba(128,191,255,0.35)' : 'none',
            transition: 'box-shadow 180ms ease', pointerEvents: 'none', zIndex: 0,
          }}
        />
        <input
          {...props}
          onFocus={(e)=>{ setFocused(true); props.onFocus?.(e) }}
          onBlur={(e)=>{ setFocused(false); props.onBlur?.(e) }}
          className={(props.className||'') + ' w-full bg-transparent border rounded-xl px-3 py-2 outline-none'}
          style={{
            ...(props.style || {}),
            borderColor: focused ? '#80BFFF' : '#34567B',
            color: '#E8F0FF',
            transition: 'border-color 180ms ease',
            position: 'relative', zIndex: 1,
          }}
        />
      </div>
    )
  }

  function usePresence(show: boolean, duration = 180) {
    const [mounted, setMounted] = React.useState(show);
    const [visible, setVisible] = React.useState(show);
    React.useEffect(() => {
      if (show) { setMounted(true); requestAnimationFrame(() => setVisible(true)); }
      else { setVisible(false); const t = setTimeout(() => setMounted(false), duration); return () => clearTimeout(t) }
    }, [show, duration]);
    return { mounted, visible };
  }

  function PortalTooltip({ anchorRef, show, children, offsetY = 8 }: {
    anchorRef: React.RefObject<HTMLElement>; show: boolean; children: React.ReactNode; offsetY?: number;
  }) {
    const { mounted, visible } = usePresence(show, 180);
    const [pos, setPos] = React.useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
    React.useEffect(() => {
      function update() {
        const el = anchorRef.current; if (!el) return;
        const r = el.getBoundingClientRect();
        setPos({ top: r.bottom + offsetY, left: Math.round(r.left + r.width / 2) });
      }
      update();
      window.addEventListener('scroll', update, true);
      window.addEventListener('resize', update);
      const id = setInterval(update, 120);
      return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); clearInterval(id); };
    }, [anchorRef, offsetY, mounted]);
    if (!mounted) return null;
    return createPortal(
      <div style={{
        position: 'fixed', top: pos.top, left: pos.left,
        transform: `translate(-50%, ${visible ? '0' : '4px'}) scale(${visible ? 1 : 0.98})`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 180ms ease, transform 180ms cubic-bezier(.2,.8,.2,1)',
        background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: 12,
        padding: '6px 10px', borderRadius: 8, whiteSpace: 'nowrap', zIndex: 10000,
        pointerEvents: 'none', willChange: 'opacity, transform',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>{children}</div>,
      document.body
    );
  }

  function EditableTitle({ value, onCommit, placeholder = 'Untitled vault' }: {
    value: string; onCommit: (name: string) => void; placeholder?: string;
  }) {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value);
    const presence = usePresence(editing, 180);
    React.useEffect(() => { if (editing) setDraft(value); }, [editing, value]);
    function commit() {
      const next = (draft || '').trim() || placeholder;
      setEditing(false);
      if (next !== value) onCommit(next);
    }
    function cancel() { setEditing(false); setDraft(value); }
    return (
      <div style={{ position:'relative', minHeight:36, display:'flex', alignItems:'center' }}>
        {!editing && (
          <button className="titleBtn" onClick={() => setEditing(true)} title="Click to rename">
            {value || placeholder}
            <span className="titleGhostHint">edit</span>
          </button>
        )}
        {presence.mounted && (
          <input
            autoFocus value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            style={{
              background: 'transparent', color: '#E8F0FF', fontSize: 20, fontWeight: 600,
              letterSpacing: '.02em', padding: '6px 10px', borderRadius: 12,
              border: '1px solid #34567B', outline: 'none',
              boxShadow: presence.visible ? '0 0 0 3px rgba(128,191,255,0.28), inset 0 0 0 1px rgba(255,255,255,0.06)' : 'none',
              transform: `translateY(${presence.visible ? 0 : 4}px) scale(${presence.visible ? 1 : 0.98})`,
              opacity: presence.visible ? 1 : 0,
              transition: 'opacity 180ms ease, transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms ease',
            }}
          />
        )}
      </div>
    );
  }

  function SliderWithPortal({ value, min = 0, max = 1, step = 0.01, className, onChange, format = (v:number)=>v.toFixed(2) }: {
    value: number; min?: number; max?: number; step?: number; className?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; format?: (v:number)=>string;
  }) {
    const ref = React.useRef<HTMLInputElement>(null);
    const [hover, setHover] = React.useState(false);
    const [thumbPos, setThumbPos] = React.useState<{top:number; left:number}>({ top: -9999, left: -9999 });
    function updatePos() {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const pct = (Number(value) - Number(min)) / (Number(max) - Number(min));
      const x = r.left + pct * r.width;
      setThumbPos({ top: r.top - 28, left: x });
    }
    React.useEffect(() => { updatePos(); }, [value, min, max]);
    React.useEffect(() => {
      function onScrollOrResize() { updatePos(); }
      window.addEventListener('scroll', onScrollOrResize, true);
      window.addEventListener('resize', onScrollOrResize);
      const id = setInterval(onScrollOrResize, 100);
      return () => { window.removeEventListener('scroll', onScrollOrResize, true); window.removeEventListener('resize', onScrollOrResize); clearInterval(id); };
    }, []);
    return (
      <>
        <input
          ref={ref} type="range" value={value} min={min} max={max} step={step}
          className={`custom-slider w-full ${className || ''}`}
          onChange={(e) => { onChange?.(e); updatePos(); }}
          onMouseEnter={() => { setHover(true); updatePos(); }}
          onMouseLeave={() => setHover(false)}
          onMouseMove={updatePos}
        />
        {hover && createPortal(
          <div style={{
            position: 'fixed', top: thumbPos.top, left: thumbPos.left,
            transform: `translate(-50%, 0)`, opacity: 1,
            background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: 12,
            padding: '4px 8px', borderRadius: 8, zIndex: 10000, pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>{format(Number(value))}</div>,
          document.body
        )}
      </>
    );
  }

  function BrowseIcon({ onClick }:{ onClick:()=>void }) {
    const [hovered, setHovered] = React.useState(false);
    const btnRef = React.useRef<HTMLButtonElement>(null);
    return (
      <>
        <button
          ref={btnRef} aria-label="Browse vault" onClick={onClick}
          onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
          style={{
            backgroundColor: hovered ? 'rgba(122,162,247,0.15)' : 'transparent',
            border: '1px solid', borderColor: hovered ? '#7aa2f7' : '#34567B',
            borderRadius: 10, width: 40, height: 40,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 180ms ease', overflow: 'visible',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 8h7l2 2h7v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8z"
                  stroke="#7aa2f7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <PortalTooltip anchorRef={btnRef} show={hovered}>Browse folder</PortalTooltip>
      </>
    );
  }

  function SyncIcon({ onClick }:{ onClick:()=>void }) {
    const [hovered, setHovered] = React.useState(false);
    const btnRef = React.useRef<HTMLButtonElement>(null);
    return (
      <>
        <button
          ref={btnRef} aria-label="Sync now" onClick={onClick}
          onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
          style={{
            backgroundColor: hovered ? 'rgba(52,211,153,0.15)' : 'transparent',
            border: '1px solid', borderColor: hovered ? '#34d399' : '#34567B',
            borderRadius: 10, width: 40, height: 40,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 180ms ease', overflow: 'visible',
          }}
        >
          <RefreshCw className="w-[18px] h-[18px]" style={{ color: '#34d399', strokeWidth: 2 }} />
        </button>
        <PortalTooltip anchorRef={btnRef} show={hovered}>Sync now</PortalTooltip>
      </>
    );
  }

  function HistoryIcon({ onClick }:{ onClick:()=>void }) {
    const [hovered, setHovered] = React.useState(false);
    const btnRef = React.useRef<HTMLButtonElement>(null);
    return (
      <>
        <button
          ref={btnRef} aria-label="View history" onClick={onClick}
          onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
          style={{
            backgroundColor: hovered ? 'rgba(122,162,247,0.15)' : 'transparent',
            border: '1px solid', borderColor: hovered ? '#7aa2f7' : '#34567B',
            borderRadius: 10, width: 40, height: 40,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 180ms ease', overflow: 'visible',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="#7aa2f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <PortalTooltip anchorRef={btnRef} show={hovered}>Git history</PortalTooltip>
      </>
    );
  }

  function GitHubIcon({ onClick, disabled, tooltipWhenDisabled = 'Set a repository URL first' }:{
    onClick:()=>void; disabled?: boolean; tooltipWhenDisabled?: string
  }) {
    const [hovered, setHovered] = React.useState(false)
    const btnRef = React.useRef<HTMLButtonElement>(null)
    const stroke = disabled ? '#4a5a70' : '#7aa2f7'
    const border = disabled ? '#2a4060' : '#34567B'

    return (
      <>
        <button
          ref={btnRef}
          aria-label="Open GitHub"
          aria-disabled={disabled}
          disabled={disabled}
          onClick={() => { if (!disabled) onClick() }}
          onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
          style={{
            backgroundColor: disabled ? 'transparent' : (hovered ? 'rgba(122,162,247,0.15)' : 'transparent'),
            border: '1px solid', borderColor: hovered && !disabled ? '#7aa2f7' : border,
            borderRadius: 10, width: 40, height: 40,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 180ms ease', overflow: 'visible',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.85 9.7.5.1.68-.22.68-.49 0-.24-.01-.86-.01-1.68-2.78.62-3.37-1.36-3.37-1.36-.45-1.18-1.1-1.49-1.1-1.49-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.33 1.11 2.9.85.09-.67.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.09 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.76 1.05A9.36 9.36 0 0 1 12 7.06c.85 0 1.71.12 2.51.35 1.92-1.32 2.76-1.05 2.76-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.64 1.03 2.76 0 3.96-2.35 4.83-4.58 5.09.36.32.68.93.68 1.88 0 1.36-.01 2.45-.01 2.78 0 .27.18.59.69.49A10.05 10.05 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"
                  stroke={stroke} strokeWidth="1.4" fill="none"/>
          </svg>
        </button>
        <PortalTooltip anchorRef={btnRef} show={hovered}>
          {disabled ? tooltipWhenDisabled : 'Open on GitHub'}
        </PortalTooltip>
      </>
    )
  }

  function StatCard({ label, value, color = '#7aa2f7', icon, index = 0 }: {
    label: string; value: string | number; color?: string; icon?: React.ReactNode; index?: number;
  }) {
    const [hovered, setHovered] = React.useState(false)
    return (
      <div
        style={{
          background: hovered ? `linear-gradient(135deg, rgba(16,28,48,0.5), rgba(10,18,35,0))`
                              : `linear-gradient(135deg, rgba(16,28,48,0.35), rgba(10,18,35,0))`,
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid', borderColor: hovered ? `${color}66` : 'rgba(52,86,123,0.35)',
          borderRadius: 14, padding: 16, textAlign: 'center',
          transition: 'all 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: hovered ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
          cursor: 'pointer', position: 'relative', overflow: 'hidden',
          opacity: entered ? 1 : 0,
          transformOrigin: 'bottom',
          ...(entered ? {} : { transform: 'translateY(10px) scale(0.98)' }),
          transitionDelay: `${index * 80}ms`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at center, ${color}22 0%, transparent 70%)`,
          opacity: hovered ? 1 : 0, transition: 'opacity 400ms ease', pointerEvents: 'none',
        }} />
        {icon && (
          <div style={{
            marginBottom: 10, opacity: hovered ? 1 : 0.6,
            transform: hovered ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)',
            transition: 'all 280ms cubic-bezier(0.2, 0.8, 0.2, 1)', position: 'relative', zIndex: 1,
          }}>
            {icon}
          </div>
        )}
        <div style={{
          fontSize: 28, fontWeight: 800, color, marginBottom: 8, letterSpacing: '-0.03em',
          transform: hovered ? 'scale(1.05)' : 'scale(1)', transition: 'all 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          textShadow: hovered ? `0 0 20px ${color}88` : 'none', position: 'relative', zIndex: 1,
        }}>
          {value}
        </div>
        <div style={{
          fontSize: 11, color: hovered ? '#B8CBDF' : '#6B8099', textTransform: 'uppercase',
          letterSpacing: '0.1em', fontWeight: 700, transition: 'color 280ms ease', position: 'relative', zIndex: 1,
        }}>
          {label}
        </div>
      </div>
    );
  }

  const githubUrl = React.useMemo(() => toGitHubUrl(value.repoUrl, value.branch), [value.repoUrl, value.branch])

  return (
    <div className="max-w-4xl mx-auto h-full" style={{ overflow: 'visible', ['--section-gradient' as any]: getSectionTitleColor() }}>
      <style>{`
        .settings-group { background: rgba(6,22,42,0.35); border: 1px solid rgba(52,86,123,0.4); border-radius: 14px; padding: 16px; margin-bottom: 12px;
          opacity: ${entered ? 1 : 0}; transform: ${entered ? 'translateY(0)' : 'translateY(10px)'}; transition: opacity 300ms ease, transform 300ms ease; }
        .settings-group[data-delay="1"] { transition-delay: 80ms; }
        .settings-group[data-delay="2"] { transition-delay: 160ms; }
        .settings-group[data-delay="3"] { transition-delay: 240ms; }
        .settings-group[data-delay="4"] { transition-delay: 320ms; }
        .settings-group[data-delay="5"] { transition-delay: 400ms; }

        .custom-slider { -webkit-appearance: none; appearance: none; background: transparent; height: 28px; }
        .custom-slider:focus { outline: none; }
        .custom-slider::-webkit-slider-runnable-track { height: 6px; background: #1a2d45; border: 1px solid #2a4060; border-radius: 999px; }
        .custom-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; background: linear-gradient(135deg, #7aa2f7 0%, #5a82d7 100%); border-radius: 50%; margin-top: -6px; cursor: grab; box-shadow: 0 2px 8px rgba(122,162,247,0.4); transition: transform 140ms ease, box-shadow 140ms ease; }
        .custom-slider::-webkit-slider-thumb:hover { transform: scale(1.1); box-shadow: 0 3px 12px rgba(122,162,247,0.6); }
        .custom-slider::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(0.95); }
        .custom-slider::-moz-range-track { height: 6px; background: #1a2d45; border: 1px solid #2a4060; border-radius: 999px; }
        .custom-slider::-moz-range-thumb { width: 18px; height: 18px; background: linear-gradient(135deg, #7aa2f7 0%, #5a82d7 100%); border: none; border-radius: 50%; transform: translateY(-6px); cursor: grab; box-shadow: 0 2px 8px rgba(122,162,247,0.4); transition: transform 140ms ease, box-shadow 140ms ease; }
        .custom-slider::-moz-range-thumb:hover { transform: translateY(-6px) scale(1.1); box-shadow: 0 3px 12px rgba(122,162,247,0.6); }
        .custom-slider::-moz-range-thumb:active { cursor: grabbing; }

        .titleBtn { appearance: none; background: transparent; border: 0; color: #E8F0FF; font-size: 20px; font-weight: 600; letter-spacing: .02em; padding: 6px 10px; border-radius: 12px; transition: background-color 160ms ease, box-shadow 160ms ease, transform 160ms ease; cursor: text; }
        .titleBtn:hover { background: rgba(122,162,247,0.08); box-shadow: inset 0 0 0 1px rgba(122,162,247,0.2); }
        .titleBtn:active { transform: translateY(0.5px) scale(.997); }
        .titleGhostHint { margin-left: 8px; font-size: 11px; opacity: .35; transition: opacity 160ms ease; }
        .titleBtn:hover .titleGhostHint { opacity: .65; }

        .section-title { color: #9DB8D9; font-size: 13px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .section-title::before { content: ''; width: 3px; height: 14px; background: var(--section-gradient); border-radius: 999px; }

        .switch { appearance: none; width: 40px; height: 22px; background: #1a2d45; border: 1px solid #2a4060; border-radius: 999px; position: relative; cursor: pointer; transition: all 200ms cubic-bezier(0.2, 0.8, 0.2, 1); }
        .switch:hover { background: #223854; transform: scale(1.02); }
        .switch::before { content: ''; position: absolute; width: 16px; height: 16px; background: #4a5a70; border-radius: 999px; top: 2px; left: 2px; transition: all 200ms cubic-bezier(0.2, 0.8, 0.2, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .switch:checked { background: #7aa2f7; border-color: #7aa2f7; }
        .switch:checked::before { background: white; transform: translateX(18px); box-shadow: 0 2px 8px rgba(122,162,247,0.5); }

        .settingsScroll { overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; padding-right: 8px; }
        @supports not selector(::-webkit-scrollbar) { .settingsScroll { scrollbar-width: thin; scrollbar-color: rgba(128,191,255, 0.25) transparent; } }
        .settingsScroll::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
        .settingsScroll::-webkit-scrollbar-corner { background: transparent; }
        .settingsScroll::-webkit-scrollbar-track { background: rgba(10,10,10,0.35); border-radius: 999px; border: 1px solid transparent; border-color: rgba(255,255,255,0.075); }
        .settingsScroll::-webkit-scrollbar-thumb { background-image: linear-gradient(to bottom, rgba(128,191,255,0.35), rgba(128,191,255,0.25)); border-radius: 999px; background-clip: padding-box; border: 0px solid transparent; }
      `}</style>

      <div className="mb-4 flex items-center justify-between">
        <EditableTitle value={value.name} onCommit={(name) => set({ name })} />
        <div className="flex items-center gap-2">
          <BrowseIcon onClick={onPick} />
          {onShowHistory && <HistoryIcon onClick={onShowHistory} />}

          <GitHubIcon
            disabled={!githubUrl}
            onClick={() => {
              if (!githubUrl) return
              // prefer provided handler if the parent still wants to intercept
              if (onOpenGitHub) { onOpenGitHub(); return }
              window.electronAPI?.openExternal?.(githubUrl)
            }}
          />

          <SyncIcon onClick={onSync} />
        </div>
      </div>

      <div className="settingsScroll" style={{ height: 'calc(100% - 60px)' }}>
        {/* Statistics Dashboard */}
        <div className="settings-group" data-delay="0">
          <div className="section-title">Vault Statistics</div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Files"
              value={stats?.files ?? '—'}
              color="#7aa2f7"
              index={0}
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block' }}>
                  <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z" stroke="#7aa2f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13 2v7h7" stroke="#7aa2f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            />
            <StatCard
              label="Commits"
              value={stats?.commits ?? '—'}
              color="#34d399"
              index={1}
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block' }}>
                  <circle cx="12" cy="12" r="3" stroke="#34d399" strokeWidth="2"/>
                  <path d="M3 12h6m6 0h6" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              }
            />
            <StatCard
              label="Storage"
              value={stats?.size ?? '—'}
              color="#f59e0b"
              index={2}
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block' }}>
                  <path d="M5 7c0-1.66 3.13-3 7-3s7 1.34 7 3-3.13 3-7 3-7-1.34-7-3Z"stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 7v5c0 1.66 3.13 3 7 3s7-1.34 7-3V7" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 12v5c0 1.66 3.13 3 7 3s7-1.34 7-3v-5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            />
          </div>
          {!value.path && (
            <div className="text-xs mt-3" style={{ color: '#6B8099', textAlign: 'center' }}>
              Pick a folder to see statistics
            </div>
          )}
        </div>

        {/* Git Configuration */}
        <div className="settings-group" data-delay="1">
          <div className="section-title">Git Configuration</div>
          <div className="space-y-3">
            <div>
              <label className="text-sm" style={{ color: '#9DB8D9', display: 'block', marginBottom: 6 }}>
                Repository URL
              </label>
              <InputWithFocus
                value={value.repoUrl||''}
                onChange={e=>set({repoUrl:e.target.value})}
                placeholder="git@github.com:user/repo.git or https://github.com/user/repo.git"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm" style={{ color: '#9DB8D9', display: 'block', marginBottom: 6 }}>
                  Branch
                </label>
                <InputWithFocus
                  value={value.branch||'main'}
                  onChange={e=>set({branch:e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm" style={{ color: '#9DB8D9', display: 'block', marginBottom: 6 }}>
                  Interval (seconds)
                </label>
                <InputWithFocus
                  type="number" min={30} step={5} value={interval}
                  onChange={e=>set({intervalSec: Math.max(30, Number(e.target.value)||30)})}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Vault Path */}
        <div className="settings-group" data-delay="2">
          <div className="section-title">Vault Location</div>
          <div>
            <InputWithFocus
              value={value.path||''}
              onChange={e=>set({path:e.target.value})}
              placeholder="Pick your Obsidian vault folder"
            />
            <div className="text-xs mt-2" style={{ color: '#6B8099' }}>
              Last sync: {value.lastSync ? new Date(value.lastSync).toLocaleString() : 'Never'}
            </div>
          </div>
        </div>

        {/* Commit Settings */}
        <div className="settings-group" data-delay="3">
          <div className="section-title">Commit Settings</div>
          <div>
            <label className="text-sm" style={{ color: '#9DB8D9', display: 'block', marginBottom: 6 }}>
              Commit message template
            </label>
            <InputWithFocus
              value={value.commitTemplate||''}
              onChange={e=>set({commitTemplate:e.target.value})}
              placeholder="Use {count} and {date} placeholders"
            />
            <div className="text-xs mt-2" style={{ color: '#6B8099' }}>
              Available: {'{count}'} for file count, {'{date}'} for timestamp
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-group" data-delay="4">
          <div className="section-title">Notifications</div>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-sm" style={{ color: '#C5D4E8' }}>
              <span>Only commit when changes detected</span>
              <input type="checkbox" className="switch" checked={!!value.onlyIfChanges}
                onChange={e=>set({onlyIfChanges:e.target.checked})}/>
            </label>
            <label className="flex items-center justify-between text-sm" style={{ color: '#C5D4E8' }}>
              <span>Screen overlay notifications</span>
              <input type="checkbox" className="switch" checked={value.notifyOverlay !== false}
                onChange={e=>set({notifyOverlay:e.target.checked})}/>
            </label>
            <label className="flex items-center justify-between text-sm" style={{ color: '#C5D4E8' }}>
              <span>System notifications</span>
              <input type="checkbox" className="switch" checked={!!value.notifyOS}
                onChange={e=>set({notifyOS:e.target.checked})}/>
            </label>
          </div>
        </div>

        {/* Overlay Appearance */}
        <div className="settings-group" data-delay="5">
          <div className="section-title">Overlay Appearance</div>
          <div className="space-y-4">
            <div>
              <label className="text-sm" style={{ color: '#9DB8D9', display: 'block', marginBottom: 8 }}>
                Opacity
              </label>
              <SliderWithPortal
                value={alpha} min={0.3} max={1} step={0.05}
                onChange={(e)=>set({ overlayAlpha: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-sm" style={{ color: '#9DB8D9', display: 'block', marginBottom: 8 }}>
                Scale
              </label>
              <SliderWithPortal
                value={scale} min={0.8} max={1.3} step={0.05}
                onChange={(e)=>set({ overlayScale: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* File Filters */}
        <div className="settings-group" style={{ marginBottom: 0 }} data-delay="5">
          <div className="section-title">File Filters (Optional)</div>
          <div className="space-y-3">
            <InputWithFocus
              value={value.include||''}
              onChange={e=>set({include:e.target.value})}
              placeholder="Include pattern (e.g., **/*.md)"
              style={{ color: '#7A92AB' }}
            />
            <InputWithFocus
              value={value.exclude||''}
              onChange={e=>set({exclude:e.target.value})}
              placeholder="Exclude pattern (e.g., .obsidian/**)"
              style={{ color: '#7A92AB' }}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
