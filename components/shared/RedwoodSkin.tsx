// @ts-nocheck
'use client';
/** Redwood-style skin for record pages (detail panels, create modals, list pages).
 *  Presentation only — scoped to `.rw-panel` / `.rw-list`. Shipped as a component (not globals.css)
 *  so it always travels with the page it styles. Uses String.raw so CSS escapes survive.
 *  Overrides use !important because the app's own Tailwind gradient utilities would otherwise win. */
const CSS = String.raw`
.rw-panel, .rw-list {
  --rw-bg: #F6F4F1; --rw-card: #FFFFFF; --rw-border: #E3DFD9; --rw-line: #EEEBE6;
  --rw-ink: #1B1A18; --rw-muted: #6F6A62; --rw-faint: #9A958C;
  --rw-accent: #7A4E9B; --rw-accent-soft: #F1EAF6; --rw-teal: #2F8F83; --rw-gold: #E1A93B;
  --rw-serif: Georgia, "Times New Roman", serif;
}
.rw-panel { background: var(--rw-bg) !important; color: var(--rw-ink); border-radius: 14px; }
.rw-panel [class*="from-white"][class*="to-blue-50"] { background: var(--rw-bg) !important; background-image: none !important; }

/* ── Header band (record detail + create modals) ── */
.rw-panel .rw-header {
  position: relative; background: #fff !important; background-image: none !important; color: var(--rw-ink) !important;
  border-bottom: 1px solid var(--rw-border); padding: 18px 32px 18px;
}
.rw-panel .rw-header::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 5px; background: linear-gradient(90deg, var(--rw-accent) 0 38%, var(--rw-teal) 38% 62%, var(--rw-gold) 62% 78%, #C9BFD6 78% 100%); }
.rw-panel .rw-header h1, .rw-panel .rw-header h2, .rw-panel .rw-header h3 { color: var(--rw-ink) !important; font-family: var(--rw-serif); font-weight: 400 !important; letter-spacing: -0.01em; }
.rw-panel .rw-header h2 { font-size: 26px; line-height: 1.2; }
.rw-panel .rw-header [class*="text-white"], .rw-panel .rw-header [class*="text-blue-"], .rw-panel .rw-header [class*="text-slate-"] { color: var(--rw-muted) !important; }
.rw-panel .rw-header :is(h1, h2, h3)[class], .rw-panel .rw-header :is(h1, h2, h3) [class*="text-white"] { color: var(--rw-ink) !important; }
.rw-panel .rw-header svg { color: var(--rw-ink); }
.rw-panel .rw-header .bg-blue-600, .rw-panel .rw-header .bg-blue-500 {
  background: var(--rw-accent-soft) !important; color: var(--rw-accent) !important; border: 1px solid #DCCBE8; box-shadow: none; font-weight: 700;
}
.rw-panel .rw-header [class*="bg-white/"] {
  background: #fff !important; color: var(--rw-ink) !important; border: 1px solid #D6D1CA; box-shadow: 0 1px 0 rgba(27,26,24,.03);
}
.rw-panel .rw-header button[class*="bg-white/"]:hover { background: #F3F1EE !important; }
.rw-panel .rw-header button.bg-white { background: var(--rw-ink) !important; color: #fff !important; border: 1px solid var(--rw-ink); }
.rw-panel .rw-header [class*="bg-teal-500/"], .rw-panel .rw-header [class*="bg-green-"], .rw-panel .rw-header [class*="bg-emerald-"] { color: #25615B !important; }
.rw-panel .rw-header [class*="bg-teal-500/"] { background: #E5F1EF !important; border-color: #BFDCD7 !important; }

/* ── Tabs ── */
.rw-panel .rw-tabs { background: var(--rw-card) !important; border-bottom: 1px solid var(--rw-border); padding: 0 32px; gap: 4px; }
.rw-panel .rw-tabs button { background: transparent !important; border: 0; border-bottom: 2px solid transparent; border-radius: 0; box-shadow: none; margin-bottom: -1px; padding: 13px 16px; color: var(--rw-muted) !important; font-weight: 600; font-size: 14px; }
.rw-panel .rw-tabs button:hover { color: var(--rw-ink) !important; }
.rw-panel .rw-tabs button[class*="bg-white"], .rw-panel .rw-tabs button[class*="border-blue-400"], .rw-panel .rw-tabs button[class*="text-[#0F172A]"] { color: var(--rw-ink) !important; border-bottom-color: var(--rw-accent); }

/* ── Cards ── */
.rw-panel [class*="rounded-[20px]"], .rw-panel [class*="rounded-[24px]"], .rw-panel [class*="rounded-[18px]"] {
  border-radius: 12px; border-color: var(--rw-border); box-shadow: 0 1px 2px rgba(27,26,24,.04);
}
.rw-panel .rounded-2xl { border-radius: 12px; }
.rw-panel [class*="border-blue-100"] { border-color: var(--rw-border); }
.rw-panel [class*="border-blue-50"] { border-color: var(--rw-line); }

/* ── Section header bars ── */
.rw-panel [class*="from-slate-50"][class*="to-blue-50"], .rw-panel [class*="from-gray-50"][class*="to-slate-50"] {
  background: var(--rw-card) !important; background-image: none !important; border-bottom: 1px solid var(--rw-line);
  border-top-left-radius: 12px; border-top-right-radius: 12px;
}
.rw-panel [class*="from-slate-50"][class*="to-blue-50"] .font-bold, .rw-panel [class*="from-gray-50"][class*="to-slate-50"] .font-bold {
  color: var(--rw-ink) !important; font-weight: 400; font-family: var(--rw-serif); font-size: 17px;
}
.rw-panel [class*="from-slate-50"][class*="to-blue-50"] .font-bold::after { content: ""; display: block; width: 28px; height: 2px; background: var(--rw-accent); margin-top: 5px; }

/* ── Dark title bars inside the page (line items, related lists, 360, modals' sub-bars) → light ── */
.rw-panel .bg-gradient-to-r[class*="from-[#0F172A]"]:not(.rw-header):not([class*="to-blue-800"]) {
  background: #FBFAF8 !important; background-image: none !important; color: var(--rw-ink) !important; border-bottom: 1px solid var(--rw-border);
}
.rw-panel .bg-gradient-to-r[class*="from-[#0F172A]"]:not(.rw-header):not([class*="to-blue-800"]) :is([class*="text-white"], h2, h3, h4):not(button) { color: var(--rw-ink) !important; }
.rw-panel .bg-gradient-to-r[class*="from-[#0F172A]"]:not(.rw-header):not([class*="to-blue-800"]) :is(h3, h4) { font-family: var(--rw-serif); font-weight: 400; font-size: 16px; }
.rw-panel .bg-gradient-to-r[class*="from-[#0F172A]"]:not(.rw-header):not([class*="to-blue-800"]) [class*="text-blue-"] { color: var(--rw-muted) !important; }
.rw-panel .bg-gradient-to-r[class*="from-[#0F172A]"]:not(.rw-header):not([class*="to-blue-800"]) [class*="bg-white/"] { background: rgba(27,26,24,.07) !important; color: var(--rw-ink) !important; }
.rw-panel .bg-gradient-to-r[class*="from-[#0F172A]"]:not(.rw-header):not([class*="to-blue-800"]) button.bg-white { background: var(--rw-ink) !important; color: #fff !important; }
.rw-panel thead, .rw-panel thead[class*="from-[#0F172A]"] { background: #FBFAF8 !important; background-image: none !important; }
.rw-panel thead th { color: var(--rw-muted) !important; font-weight: 600; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; }

.rw-panel tfoot [class*="bg-[#0F172A]"], .rw-panel tfoot tr[class*="bg-[#0F172A]"] { background: #23211E !important; }
.rw-panel [class*="rounded-[20px]"] > .bg-gradient-to-r[class*="from-[#0F172A]"]:not(.rw-header) { border-radius: 12px 12px 0 0; }

/* ── Buttons ── */
.rw-panel [class*="from-[#0F172A]"][class*="to-blue-800"] { background-image: none !important; background-color: var(--rw-ink) !important; color: #fff !important; box-shadow: 0 1px 2px rgba(27,26,24,.18); }
.rw-panel [class*="from-[#0F172A]"][class*="to-blue-800"]:hover { background-color: #34312D !important; opacity: 1; }
.rw-panel button.rounded-xl { border-radius: 8px; }

/* ── Fields ── */
.rw-panel label[class*="uppercase"] { font-size: 11px; letter-spacing: .05em; color: var(--rw-muted); font-weight: 600; }
.rw-panel input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), .rw-panel select, .rw-panel textarea {
  border-radius: 8px; border-color: #D6D1CA; background-color: #fff; color: var(--rw-ink);
}
.rw-panel input:not([type="checkbox"]):not([type="radio"]):focus, .rw-panel select:focus, .rw-panel textarea:focus {
  outline: none; border-color: var(--rw-accent); box-shadow: 0 0 0 3px rgba(122,78,155,.14);
}
.rw-panel fieldset:disabled input, .rw-panel fieldset:disabled select, .rw-panel fieldset:disabled textarea { background-color: #F3F1EE; color: var(--rw-muted); cursor: not-allowed; }
.rw-panel [class*="bg-gradient-to-br"][class*="from-[#0F172A]"] { background-image: none !important; background-color: #23211E !important; }

/* ── Create modals ── */
.rw-panel.rw-modal { max-height: 92vh; }
.rw-panel.rw-modal .rw-header { padding: 16px 28px 18px; }
.rw-panel.rw-modal .rw-header h2 { font-size: 22px; }
.rw-panel.rw-modal [class*="bg-gray-50"][class*="border-t"] { background: #fff !important; border-top: 1px solid var(--rw-border); }

/* ── List pages ── */
.rw-list { background: transparent; color: var(--rw-ink); }
.rw-list h1 { font-family: var(--rw-serif); font-weight: 400 !important; font-size: 30px !important; letter-spacing: -0.01em; color: var(--rw-ink) !important; }
.rw-list h1 + p { color: var(--rw-muted) !important; }
.rw-list .rw-banner { background: #fff !important; background-image: none !important; color: var(--rw-ink) !important; border: 1px solid var(--rw-border); border-radius: 14px; position: relative; overflow: hidden; }
.rw-list .rw-banner::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: linear-gradient(90deg, var(--rw-accent) 0 38%, var(--rw-teal) 38% 62%, var(--rw-gold) 62% 78%, #C9BFD6 78% 100%); }
.rw-list .rw-banner :is(h1, h2, h3) { color: var(--rw-ink) !important; font-family: var(--rw-serif); font-weight: 400 !important; }
.rw-list .rw-banner [class*="text-white"], .rw-list .rw-banner [class*="text-blue-"] { color: var(--rw-muted) !important; }
.rw-list .rw-banner button[class*="bg-white"] { background: var(--rw-ink) !important; color: #fff !important; }
.rw-list [class*="rounded-[24px]"], .rw-list [class*="rounded-[20px]"], .rw-list [class*="rounded-[28px]"]:not(.rw-banner) { border-radius: 12px; border-color: var(--rw-border); box-shadow: 0 1px 2px rgba(27,26,24,.04); }
.rw-list [class*="border-blue-100"] { border-color: var(--rw-border); }
.rw-list thead, .rw-list thead[class*="from-[#0F172A]"] { background: #FBFAF8 !important; background-image: none !important; color: var(--rw-muted) !important; border-bottom: 1px solid var(--rw-border); }
.rw-list thead th { color: var(--rw-muted) !important; font-weight: 600; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; }
.rw-list tbody tr { transition: background .12s; }
.rw-list tbody tr:hover { background: #FAF7FC !important; }
.rw-list tbody td { border-color: var(--rw-line); }
.rw-list [class*="from-[#0F172A]"][class*="to-blue-800"] { background-image: none !important; background-color: var(--rw-ink) !important; color: #fff !important; box-shadow: 0 1px 2px rgba(27,26,24,.18); }
.rw-list [class*="from-[#0F172A]"][class*="to-blue-800"]:hover { background-color: #34312D !important; }
.rw-list .rw-stat { background: #fff !important; background-image: none !important; color: var(--rw-ink) !important; border: 1px solid var(--rw-border); border-left: 3px solid var(--rw-accent); box-shadow: 0 1px 2px rgba(27,26,24,.04); }
.rw-list .rw-stat * { color: var(--rw-ink) !important; }
.rw-list .rw-stat [class*="opacity"], .rw-list .rw-stat [class*="text-xs"] { color: var(--rw-muted) !important; }
.rw-list input:not([type="checkbox"]):not([type="radio"]), .rw-list select { border-radius: 8px; border-color: #D6D1CA; }
.rw-list input:not([type="checkbox"]):not([type="radio"]):focus, .rw-list select:focus { outline: none; border-color: var(--rw-accent); box-shadow: 0 0 0 3px rgba(122,78,155,.14); }
`;
export default function RedwoodSkin() {
  return <style data-rw-skin dangerouslySetInnerHTML={{ __html: CSS }} />;
}
