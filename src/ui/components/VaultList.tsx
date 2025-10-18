import React from "react";
import { createPortal } from "react-dom";

type Vault = { id:string; name:string; path:string; color:string; lastSync?:string };

export default function VaultList({
  items, selectedId, onSelect, onOpenPath, onRemove, onRename, bulkMode, selectedVaults, onToggleBulkSelect, syncStatus, vaultStats
}:{
  items: Vault[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenPath: (id: string) => void;
  onRemove?: (id: string) => void;
  onRename?: (id: string) => void;
  bulkMode?: boolean;
  selectedVaults?: Set<string>;
  onToggleBulkSelect?: (id: string) => void;
  syncStatus?: Record<string, 'syncing'|'success'|'error'>;
  vaultStats?: Record<string, {files?: number; commits?: number; size?: string}>;
}) {
  const [activeIds, setActiveIds] = React.useState<Set<string>>(new Set());
  const [syncedIds, setSyncedIds] = React.useState<Set<string>>(new Set());
  const timersRef = React.useRef<Record<string, number>>({});
  const syncTimersRef = React.useRef<Record<string, number>>({});

  React.useEffect(() => {
    const api: any = (window as any).electronAPI;

    const handler = (evtOrPayload: any, maybePayload?: any) => {
      const p = maybePayload ?? evtOrPayload;
      const id = p?.id;
      if (!id) return;

      // Activity indicator
      setActiveIds(prev => {
        const n = new Set(prev);
        n.add(id);
        return n;
      });

      if (timersRef.current[id]) window.clearTimeout(timersRef.current[id]);
      timersRef.current[id] = window.setTimeout(() => {
        setActiveIds(prev => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
        delete timersRef.current[id];
      }, 5000);

      // Check if this is a sync completion event
      if (p.event === 'sync' || p.type === 'sync-complete') {
        setSyncedIds(prev => {
          const n = new Set(prev);
          n.add(id);
          return n;
        });

        if (syncTimersRef.current[id]) window.clearTimeout(syncTimersRef.current[id]);
        syncTimersRef.current[id] = window.setTimeout(() => {
          setSyncedIds(prev => {
            const n = new Set(prev);
            n.delete(id);
            return n;
          });
          delete syncTimersRef.current[id];
        }, 4000);
      }
    };

    let off: any;
    try {
      if (api?.onVaultActivity) off = api.onVaultActivity(handler);
      else if (api?.on) off = api.on("vault:activity", handler);
    } catch {}

    return () => {
      if (off && typeof off === "function") off();
      Object.values(timersRef.current).forEach(t => window.clearTimeout(t));
      Object.values(syncTimersRef.current).forEach(t => window.clearTimeout(t));
      timersRef.current = {};
      syncTimersRef.current = {};
    };
  }, []);

  return (
    <div className="listRoot" style={{ display:"grid", gap:12, minWidth:0, overflowX:"hidden" }}>
      <style>{`
        @keyframes glint {
          0% { transform: translateX(-120%); opacity: 0; }
          35% { opacity: .35; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        @keyframes syncPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes syncBadgeFadeIn {
          0% { opacity: 0; transform: translateX(8px) scale(0.9); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes syncBadgeFadeOut {
          0% { opacity: 1; transform: translateX(0) scale(1); }
          100% { opacity: 0; transform: translateX(8px) scale(0.9); }
        }

        .vaultCard{
          position:relative; width:100%; min-width:0; box-sizing:border-box;
          border-radius:14px; border:1px solid rgba(52,86,123,.55);
          background:rgba(6,22,42,.55);
          backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
          overflow:visible;
          will-change: transform, box-shadow;
          transition: transform 160ms cubic-bezier(.2,.8,.2,1),
                      box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease;
          --hoverShift: 1.5px;
        }
        .listRoot > .vaultCard:last-child { --hoverShift: -1.5px; }

        .vaultCard:not(.isSelected):hover{
          transform: translateY(var(--hoverShift));
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
          border-color:rgba(98,140,190,.75);
          background:rgba(6,22,42,.65);
        }

        .vaultCard.isSelected{
          border-color:var(--accentBorder, rgba(128,191,255,.82));
          box-shadow: inset 0 0 0 2px var(--accentRing, rgba(128,191,255,.45));
        }
        .vaultCard.isSelected:hover{
          transform: translateY(var(--hoverShift));
          border-color:var(--accentBorder, rgba(128,191,255,.82));
          box-shadow: inset 0 0 0 2px var(--accentRing, rgba(128,191,255,.45)),
                      inset 0 0 0 1px rgba(255,255,255,.06);
          background:rgba(6,22,42,.65);
        }

        .accentBar{ position:absolute; left:10px; top:12px; bottom:12px; width:6px; border-radius:999px; opacity:.95; }
        .glint{
          position:absolute; top:0; bottom:0; width:45%;
          background:linear-gradient(105deg, transparent 0%, rgba(255,255,255,.08) 40%, rgba(255,255,255,.2) 50%, rgba(255,255,255,.08) 60%, transparent 100%);
          transform:translateX(-120%); filter:blur(1px); opacity:0; pointer-events:none;
        }
        .vaultCard:hover .glint{ animation: glint 1200ms ease forwards; }

        .row{ display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0; }
        .titleWrap{ display:flex; align-items:center; gap:8px; min-width:0; }
        .title{ color:#E8F0FF; font-weight:600; letter-spacing:.02em; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .path{ color:#9DB8D9; font-size:12px; opacity:.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .meta{ color:#8AA5C3; font-size:11px; letter-spacing:.02em; min-width:0; }
        .chip{ display:inline-flex; align-items:center; gap:6px; background:rgba(26,45,69,0.6); border:1px solid rgba(52,86,123,0.4); border-radius:999px; padding:3px 9px; font-size:10px; color:#B8CBDF; white-space:nowrap; }

        .actions{ display:flex; align-items:center; gap:6px; }
        .ghostIcon{ appearance:none; border:0; background:transparent; border-radius:10px; width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; transition: background-color 140ms ease, transform 140ms ease; cursor:pointer; position:relative; overflow:visible; }
        .ghostIcon:hover{ background:rgba(122,162,247,.12); }
        .ghostIcon:active{ transform:translateY(0.5px) scale(.98); }

        .menu{
          position:fixed; min-width:180px; border-radius:12px; border:1px solid rgba(52,86,123,.6);
          background:rgba(6,22,42,.95); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
          padding:6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.05), 0 8px 24px rgba(0,0,0,0.4);
          color:#E8F0FF; z-index:10000;
          transform-origin: top;
        }
        .menu.above{ transform-origin: bottom; }

        .menuItem{ display:flex; align-items:center; gap:10px; border-radius:10px; padding:8px 10px; font-size:13px; cursor:pointer; white-space:nowrap; color:#C5D4E8; }
        .menuItem:hover{ background:rgba(122,162,247,.15); }
        .menuItem.disabled{ opacity:.45; pointer-events:none; cursor:not-allowed; }
        .menuItem svg{ width:14px; height:14px; stroke: currentColor; }
        .menuItem.danger{ color:#ff6b6b; }

        /* Custom checkbox */
        .custom-checkbox {
          appearance: none;
          width: 20px;
          height: 20px;
          border: 2px solid rgba(122,162,247,0.4);
          border-radius: 6px;
          background: rgba(6,22,42,0.6);
          cursor: pointer;
          transition: all 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
          position: relative;
          flex-shrink: 0;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .custom-checkbox:hover {
          border-color: #7aa2f7;
          background: rgba(6,22,42,0.8);
          transform: scale(1.08);
          box-shadow: 0 0 0 4px rgba(122,162,247,0.1);
        }
        .custom-checkbox:checked {
          background: linear-gradient(135deg, #7aa2f7 0%, #5a82d7 100%);
          border-color: #7aa2f7;
          box-shadow: 0 0 0 4px rgba(122,162,247,0.15), inset 0 1px 3px rgba(0,0,0,0.2);
        }
        .custom-checkbox:checked::after {
          content: '';
          position: absolute;
          left: 6px;
          top: 2px;
          width: 5px;
          height: 10px;
          border: solid white;
          border-width: 0 2.5px 2.5px 0;
          transform: rotate(45deg);
        }
        .custom-checkbox:checked:hover {
          transform: scale(1.08);
          box-shadow: 0 0 0 4px rgba(122,162,247,0.25), inset 0 1px 3px rgba(0,0,0,0.2);
        }
        
        /* ========= Improved Sync Indicator ========= */
        .syncWrap{
          position: relative;
          width: 14px; height: 14px; min-width: 14px;
          display:inline-flex; align-items:center; justify-content:center;
        }
        .syncIcon{
          width: 12px; height: 12px;
          opacity: 0.75;
          filter: drop-shadow(0 0 3px rgba(122,162,247,0.3));
        }
        .syncIcon.active {
          animation: syncPulse 1.5s ease-in-out infinite;
        }
        .syncIcon path{
          stroke: #7aa2f7;
          stroke-width: 2.2;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: none;
        }

        /* Success badge */
        .syncedBadge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: linear-gradient(135deg, rgba(52,211,153,0.2), rgba(52,211,153,0.1));
          border: 1px solid rgba(52,211,153,0.4);
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 10px;
          color: #34d399;
          font-weight: 600;
          letter-spacing: 0.02em;
          animation: syncBadgeFadeIn 280ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          box-shadow: 0 0 12px rgba(52,211,153,0.15);
        }
        .syncedBadge.fadeOut {
          animation: syncBadgeFadeOut 280ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        .syncedBadge svg {
          width: 12px;
          height: 12px;
        }
      `}</style>

      {items.map(v => (
        <VaultRow
          key={v.id}
          vault={v}
          selected={selectedId === v.id}
          onSelect={() => onSelect(v.id)}
          onOpen={() => onOpenPath(v.id)}
          onRemove={() => onRemove?.(v.id)}
          onRename={() => onRename?.(v.id)}
          showSpinner={!!v.path}
          haloActive={activeIds.has(v.id)}
          justSynced={syncedIds.has(v.id)}
          bulkMode={bulkMode}
          bulkSelected={selectedVaults?.has(v.id)}
          onToggleBulkSelect={() => onToggleBulkSelect?.(v.id)}
          syncStatus={syncStatus?.[v.id]}
          stats={vaultStats?.[v.id]}
        />
      ))}
    </div>
  );
}

function usePresence(show: boolean, duration = 160) {
  const [mounted, setMounted] = React.useState(show);
  const [visible, setVisible] = React.useState(show);
  React.useEffect(() => {
    if (show) { setMounted(true); requestAnimationFrame(()=>setVisible(true)); }
    else { setVisible(false); const t=setTimeout(()=>setMounted(false), duration); return ()=>clearTimeout(t) }
  }, [show, duration]);
  return { mounted, visible };
}

function PortalTooltip({ anchorRef, show, children, offsetY=8 }:{
  anchorRef: React.RefObject<HTMLElement>; show:boolean; children:React.ReactNode; offsetY?:number;
}){
  const { mounted, visible } = usePresence(show, 160);
  const [pos, setPos] = React.useState({ top:-9999, left:-9999 });
  React.useEffect(()=>{ const u=()=>{ const el=anchorRef.current; if(!el) return; const r=el.getBoundingClientRect(); setPos({top:r.bottom+offsetY,left:Math.round(r.left+r.width/2)}); }; u(); window.addEventListener('scroll',u,true); window.addEventListener('resize',u); const id=setInterval(u,120); return ()=>{window.removeEventListener('scroll',u,true); window.removeEventListener('resize',u); clearInterval(id);} },[anchorRef,offsetY,mounted]);
  if(!mounted) return null;
  return createPortal(
    <div style={{ position:'fixed', top:pos.top, left:pos.left, transform:`translate(-50%, ${visible?0:4}px) scale(${visible?1:.98})`, opacity:visible?1:0, transition:'opacity 160ms ease, transform 160ms cubic-bezier(.2,.8,.2,1)', background:'rgba(0,0,0,.8)', color:'#fff', fontSize:12, padding:'6px 10px', borderRadius:8, pointerEvents:'none', zIndex:10000, boxShadow:'0 4px 12px rgba(0,0,0,0.3)' }}>
      {children}
    </div>,
    document.body
  )
}

const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none"><path d="M4 7.5h6l2 2h8.5v8a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 17.5v-10z" stroke="#7aa2f7" strokeWidth="1.5" /></svg>
);
const IconEdit = () => (
  <svg viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="#34d399" strokeWidth="1.5"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" stroke="#34d399" strokeWidth="1.5"/></svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M10 10v8m4-8v8M9 4h6l1 2H8l1-2zM6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" stroke="#ff6b6b" strokeWidth="1.5"/></svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function VaultRow({
  vault, selected, onSelect, onOpen, onRemove, onRename, showSpinner, haloActive, justSynced,
  bulkMode, bulkSelected, onToggleBulkSelect, syncStatus, stats
}:{
  vault: Vault; selected: boolean; onSelect:()=>void; onOpen:()=>void; onRemove?:()=>void; onRename?:()=>void;
  showSpinner?: boolean; haloActive?: boolean; justSynced?: boolean;
  bulkMode?: boolean; bulkSelected?: boolean; onToggleBulkSelect?: ()=>void;
  syncStatus?: 'syncing'|'success'|'error';
  stats?: {files?: number; commits?: number; size?: string};
}){
  const [moreHover, setMoreHover] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const moreBtnRef = React.useRef<HTMLButtonElement>(null);
  const menuPresence = usePresence(menuOpen, 140);

  // Real-time last sync display
  const [, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  function getTimeAgo(dateStr?: string) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  React.useEffect(()=>{ if(!menuOpen) return; function onDoc(e:MouseEvent){ const btn=moreBtnRef.current; if(!btn || !btn.contains(e.target as Node)) setMenuOpen(false) } document.addEventListener('mousedown',onDoc,true); return()=>document.removeEventListener('mousedown',onDoc,true) },[menuOpen]);

  const grad = makeGradient(vault.color);
  const { r, g, b } = hexToRgb(vault.color || "#7aa2f7");
  const accentBorder = `rgba(${r},${g},${b},.85)`;
  const accentRing   = `rgba(${r},${g},${b},.45)`;

  const canRename = !!vault.path;

  const rbtn = moreBtnRef.current?.getBoundingClientRect();
  const gap = 2;
  const menuWidth = 200;
  const menuHeight = 128;
  const pad = 8;

  const centerX = rbtn ? (rbtn.left + rbtn.width/2) : 0;
  const rawLeft = centerX - (menuWidth / 2);
  const clampedLeft = Math.max(pad, Math.min(rawLeft, window.innerWidth - menuWidth - pad));

  const needFlipAbove = !!rbtn && (window.innerHeight - rbtn.bottom) < (menuHeight + pad);
  const top = rbtn ? (needFlipAbove ? (rbtn.top - gap - menuHeight) : (rbtn.bottom + gap)) : -9999;
  const menuPos = { top, left: Math.round(clampedLeft), above: !!needFlipAbove };

  return (
    <div
      className={`vaultCard ${selected ? 'isSelected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      style={{
        padding: 12, cursor: "pointer",
        backgroundImage: `
          radial-gradient(100% 80% at 0% 0%, rgba(255,255,255,.06), transparent 60%),
          ${grad.bg},
          radial-gradient(circle at 0.5px 0.5px, rgba(255,255,255,0.08) 0.3px, transparent 1px),
          radial-gradient(circle at 1.5px 1.5px, rgba(0,0,0,0.14) 0.3px, transparent 1px)
        `,
        backgroundBlendMode: "soft-light, normal, overlay, overlay",
        backgroundSize: `auto, auto, 2px 2px, 2px 2px`,
        ['--accentBorder' as any]: accentBorder,
        ['--accentRing' as any]: accentRing,
      }}
    >
      <span className="accentBar" style={{ background: grad.accent, boxShadow: `0 0 12px ${accentRing}` }} />
      <div className="glint" />

      <div className="row" style={{ paddingLeft: 22 }}>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          {bulkMode && (
            <input
              type="checkbox"
              className="custom-checkbox"
              checked={bulkSelected}
              onChange={(e) => { e.stopPropagation(); onToggleBulkSelect?.() }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="titleWrap">
              <div className="title">{vault.name || "Untitled vault"}</div>
              {syncStatus === 'syncing' && (
                <span style={{ fontSize: 10, color: '#7aa2f7', fontWeight: 600, letterSpacing: '0.03em' }}>SYNCING...</span>
              )}
              {syncStatus === 'error' && (
                <span style={{ fontSize: 10, color: '#ff6b6b', fontWeight: 600, letterSpacing: '0.03em' }}>ERROR</span>
              )}
              {showSpinner && !syncStatus && (
                <span className="syncWrap" title="Auto-sync active">
                  <svg className={`syncIcon ${haloActive ? 'active' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21.5 2v6m0 0h-6m6 0l-5-5a9.5 9.5 0 1 0 1.9 9.5" />
                  </svg>
                </span>
              )}
              {justSynced && (
                <span className="syncedBadge">
                  <CheckIcon />
                  <span>SYNCED</span>
                </span>
              )}
            </div>
            <div className="path" title={vault.path}>{vault.path || "Pick a folder…"}</div>
          </div>
        </div>

        <div className="actions" onClick={(e)=>e.stopPropagation()}>
          <button
            ref={moreBtnRef}
            className="ghostIcon"
            onMouseEnter={()=>setMoreHover(true)}
            onMouseLeave={()=>setMoreHover(false)}
            onClick={()=>setMenuOpen(s=>!s)}
            aria-label="More"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="6" cy="12" r="1.8" fill="#9DB8D9" opacity=".85" />
              <circle cx="12" cy="12" r="1.8" fill="#9DB8D9" opacity=".85" />
              <circle cx="18" cy="12" r="1.8" fill="#9DB8D9" opacity=".85" />
            </svg>
          </button>
          <PortalTooltip anchorRef={moreBtnRef} show={moreHover}>More</PortalTooltip>
        </div>
      </div>

      <div className="row" style={{ paddingLeft: 22, marginTop: 8, gap: 10 }}>
        <div className="meta" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Last sync:&nbsp;{getTimeAgo(vault.lastSync)}
        </div>
        <div style={{ flex: 1 }} />
        <div className="chip" title="Files in vault">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
            <path d="M4 6h10l2 2h4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" stroke="currentColor" strokeWidth="1.2" opacity=".8" />
          </svg>
          {stats?.files != null ? `${stats.files} files` : '—'}
        </div>
      </div>

      {menuPresence.mounted && createPortal(
        <div
          className={`menu ${menuPos.above ? 'above' : ''}`}
          style={{
            top: menuPos.top,
            left: menuPos.left,
            transform: menuPresence.visible
              ? 'translateY(0) scale(1)'
              : (menuPos.above ? 'translateY(4px) scale(.98)' : 'translateY(-4px) scale(.98)'),
            opacity: menuPresence.visible ? 1 : 0,
            transition: "opacity 140ms ease, transform 140ms cubic-bezier(.2,.8,.2,1)",
          }}
        >
          <div className="menuItem" onClick={()=>{ setMenuOpen(false); onOpen(); }}>
            <IconFolder /> <span>Open folder</span>
          </div>
          <div
            className={`menuItem ${!canRename ? 'disabled' : ''}`}
            onClick={()=>{ if(!canRename) return; setMenuOpen(false); onRename?.(); onSelect(); }}
          >
            <IconEdit /> <span>Rename</span>
          </div>
          <div className="menuItem danger" onClick={()=>{ setMenuOpen(false); onRemove?.(); }}>
            <IconTrash /> <span>Remove</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function hexToRgb(hex: string) {
  const s = hex.replace("#", "");
  const n = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const v = parseInt(n, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
function makeGradient(hex: string) {
  let { r, g, b } = hexToRgb(hex || "#7aa2f7");
  const accent = `linear-gradient(180deg, rgba(${r},${g},${b},.95) 0%, rgba(${r},${g},${b},.55) 100%)`;
  const bg = `linear-gradient(135deg, rgba(${r},${g},${b},.18) 0%, rgba(0,60,120,.12) 50%, rgba(10,18,40,.08) 100%)`;
  return { accent, bg };
}