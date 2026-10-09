// @ts-nocheck
'use client';
/** Redwood skin for app "chrome": notification dropdown + Notification Center, profile menu, About, My Profile.
 *  Same tokens as RedwoodSkin (warm paper, serif titles, purple accent, 4-colour stripe). Scoped to .rwc-* classes. */
const CSS = String.raw`
.rwc-pop, .rwc-overlay, .rwc-modal {
  --rw-bg: #F6F4F1; --rw-card: #FFFFFF; --rw-border: #E3DFD9; --rw-line: #EEEBE6;
  --rw-ink: #1B1A18; --rw-muted: #6F6A62; --rw-faint: #9A958C;
  --rw-accent: #7A4E9B; --rw-accent-soft: #F1EAF6; --rw-teal: #2F8F83; --rw-gold: #E1A93B;
  --rw-serif: Georgia, "Times New Roman", serif; color: var(--rw-ink); text-align: left;
}
.rwc-stripe { height: 5px; flex-shrink: 0; background: linear-gradient(90deg, var(--rw-accent) 0 38%, var(--rw-teal) 38% 62%, var(--rw-gold) 62% 78%, #C9BFE0 78% 100%); }
.rwc-pop { position: absolute; right: 0; top: 100%; margin-top: 8px; background: var(--rw-card); border: 1px solid var(--rw-border); border-radius: 14px; box-shadow: 0 14px 36px rgba(27,26,24,.22); overflow: hidden; z-index: 50; }
.rwc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; background: #fff; border-bottom: 1px solid var(--rw-border); }
.rwc-title { font-family: var(--rw-serif); font-weight: 400; font-size: 20px; letter-spacing: -.01em; margin: 0; color: var(--rw-ink); }
.rwc-subtitle { font-size: 12px; color: var(--rw-muted); margin: 2px 0 0; }
.rwc-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--rw-accent-soft); color: var(--rw-accent); border: 1px solid #DCCBE8; }
.rwc-link { background: none; border: 0; padding: 0; font-size: 12px; font-weight: 700; color: var(--rw-accent); cursor: pointer; }
.rwc-link:hover { text-decoration: underline; }
.rwc-list { overflow-y: auto; background: var(--rw-card); }
.rwc-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--rw-line); border-left: 3px solid transparent; cursor: default; transition: background .12s; }
.rwc-item.nav { cursor: pointer; }
.rwc-item.nav:hover { background: #FAF8F5; }
.rwc-item.unread { background: #FBF8FD; border-left-color: var(--rw-accent); }
.rwc-ico { position: relative; flex: 0 0 auto; width: 34px; height: 34px; border-radius: 999px; background: var(--rw-bg); border: 1px solid var(--rw-border); display: flex; align-items: center; justify-content: center; color: var(--rw-accent); }
.rwc-dot { position: absolute; top: -1px; right: -1px; width: 9px; height: 9px; background: var(--rw-accent); border: 2px solid #fff; border-radius: 999px; }
.rwc-item-title { font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--rw-ink); margin: 0; }
.rwc-item:not(.unread) .rwc-item-title { font-weight: 500; color: #3B3833; }
.rwc-item-body { font-size: 12.5px; color: var(--rw-muted); margin: 3px 0 0; line-height: 1.4; }
.rwc-time { font-size: 11px; color: var(--rw-faint); white-space: nowrap; margin-top: 2px; }
.rwc-open { font-size: 11px; font-weight: 700; color: var(--rw-accent); margin: 5px 0 0; }
.rwc-empty { padding: 44px 20px; text-align: center; color: var(--rw-faint); font-size: 13px; }
.rwc-foot { display: flex; align-items: center; justify-content: space-between; padding: 10px 18px; background: var(--rw-bg); border-top: 1px solid var(--rw-border); font-size: 12px; color: var(--rw-muted); }
.rwc-seg { display: inline-flex; gap: 4px; padding: 4px; background: var(--rw-bg); border: 1px solid var(--rw-border); border-radius: 10px; }
.rwc-seg button { border: 1px solid transparent; background: transparent; padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; color: var(--rw-muted); cursor: pointer; }
.rwc-seg button[aria-selected="true"] { background: var(--rw-accent); color: #fff; box-shadow: 0 1px 4px rgba(122,78,155,.35); }
.rwc-x { width: 34px; height: 34px; border-radius: 999px; border: 1px solid #D6D1CA; background: #fff; color: var(--rw-ink); font-size: 18px; line-height: 1; cursor: pointer; }
.rwc-x:hover { background: #F3F1EE; }
.rwc-overlay { position: fixed; inset: 0; background: rgba(27,26,24,.45); display: flex; z-index: 300; }
.rwc-overlay.right { justify-content: flex-end; align-items: stretch; }
.rwc-overlay.center { justify-content: center; align-items: center; padding: 16px; }
.rwc-drawer { width: 100%; max-width: 440px; height: 100%; background: var(--rw-bg); display: flex; flex-direction: column; box-shadow: -12px 0 36px rgba(27,26,24,.25); }
.rwc-drawer .rwc-list { flex: 1; }
.rwc-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; background: var(--rw-card); border-bottom: 1px solid var(--rw-border); }
.rwc-btn { padding: 9px 16px; border-radius: 9px; border: 1px solid #D6D1CA; background: #fff; color: var(--rw-ink); font-size: 13px; font-weight: 700; cursor: pointer; }
.rwc-btn:hover { background: #F3F1EE; }
.rwc-btn.primary { background: var(--rw-ink); border-color: var(--rw-ink); color: #fff; }
.rwc-btn.primary:hover { background: #333; }
.rwc-btn.accent { background: var(--rw-accent); border-color: var(--rw-accent); color: #fff; }
.rwc-btn:disabled { opacity: .5; cursor: not-allowed; }
.rwc-menu-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 18px; background: #fff; border: 0; border-bottom: 1px solid var(--rw-line); font-size: 14px; color: var(--rw-ink); cursor: pointer; text-align: left; }
.rwc-menu-item:hover { background: #FAF8F5; }
.rwc-menu-item.danger { color: #B3261E; }
.rwc-menu-item svg { color: var(--rw-accent); }
.rwc-menu-item.danger svg { color: #B3261E; }
.rwc-avatar { width: 44px; height: 44px; border-radius: 999px; background: var(--rw-accent-soft); color: var(--rw-accent); border: 1px solid #DCCBE8; display: flex; align-items: center; justify-content: center; font-weight: 700; overflow: hidden; flex: 0 0 auto; }
.rwc-avatar img { width: 100%; height: 100%; object-fit: cover; }
.rwc-modal { width: 100%; max-height: 94vh; background: var(--rw-bg); border-radius: 14px; box-shadow: 0 24px 60px rgba(27,26,24,.35); display: flex; flex-direction: column; overflow: hidden; }
.rwc-modal-body { overflow-y: auto; padding: 22px 28px; display: flex; flex-direction: column; gap: 16px; }
.rwc-modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 28px; background: #fff; border-top: 1px solid var(--rw-border); }
.rwc-card { background: var(--rw-card); border: 1px solid var(--rw-border); border-radius: 12px; padding: 18px 20px; }
.rwc-card h4 { font-family: var(--rw-serif); font-weight: 400; font-size: 17px; margin: 0 0 12px; }
.rwc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 560px) { .rwc-grid { grid-template-columns: 1fr; } .rwc-modal-body { padding: 16px; } }
.rwc-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--rw-muted); margin-bottom: 5px; }
.rwc-input { width: 100%; border: 1px solid #D6D1CA; background: #fff; border-radius: 8px; padding: 10px 12px; font-size: 14px; color: var(--rw-ink); }
.rwc-input:focus { outline: 2px solid var(--rw-accent); outline-offset: 0; border-color: var(--rw-accent); }
.rwc-kv { display: grid; grid-template-columns: 130px 1fr; gap: 6px 12px; font-size: 14px; }
.rwc-kv dt { color: var(--rw-muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; padding-top: 2px; }
.rwc-kv dd { margin: 0; font-weight: 600; word-break: break-word; }
.rwc-hint { font-size: 12px; color: var(--rw-muted); margin: 0 0 10px; }
`;
export default function RedwoodChromeSkin() { return <style dangerouslySetInnerHTML={{ __html: CSS }} />; }
