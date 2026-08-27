// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { t, THEMES } from '@/lib/i18n';
import { SALES_GROUP, RETAIL_GROUP, BOTTOM_ITEMS, DASHBOARD_ITEM, makeCanSee } from '@/lib/navPermissions';

// Tile gradients are derived from the tenant's OWN selected theme (the same
// 3-color-plus-accent data the sidebar uses for its background), not a
// generic, unrelated rainbow — recombining those 4 colors into 5 distinct
// diagonal gradients gives bold, varied tiles that still visually belong to
// this specific tenant's chosen palette.
function getThemeTileGradients(themeObj) {
  const [c0, c1, c2] = themeObj.colors;
  const a = themeObj.accent;
  return [
    `linear-gradient(135deg, ${c0}, ${c1})`,
    `linear-gradient(135deg, ${c1}, ${a})`,
    `linear-gradient(140deg, ${c0}, ${a})`,
    `linear-gradient(130deg, ${c2}, ${a})`,
    `linear-gradient(150deg, ${c0}, ${c2})`,
  ];
}

// Low-poly faceted triangle mesh, matching the reference image's crystalline
// look — colored entirely from the tenant's own theme palette instead of a
// fixed blue, and faded from near-invisible (top-left, where the greeting
// text lives) to more visible (bottom-right, open canvas) so it can never
// interfere with readability. A small seeded PRNG keeps the jitter and
// per-facet shading stable across renders — not Math.random(), which would
// regenerate a different pattern (a visible "flicker") on every reload.
function generateLowPolyMesh(themeObj) {
  let seed = 42;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  const cols = 11, rows = 7;
  const W = 900, H = 520;
  const cellW = W / cols, cellH = H / rows;
  const points = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let c = 0; c <= cols; c++) {
      // Boundary points stay fixed exactly on the rectangle's edge — only
      // interior points get jittered. Jittering every point (including the
      // outer edge) made the mesh's own silhouette jagged rather than a
      // clean rectangle, which is what produced a "torn edge" look right
      // where the pattern should simply reach the container's boundary.
      const onEdge = r === 0 || r === rows || c === 0 || c === cols;
      row.push([
        c * cellW + (onEdge ? 0 : (rand() - 0.5) * cellW * 0.7),
        r * cellH + (onEdge ? 0 : (rand() - 0.5) * cellH * 0.7),
      ]);
    }
    points.push(row);
  }

  const palette = [themeObj.colors[0], themeObj.colors[1], themeObj.colors[2], themeObj.accent];
  const triangles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p1 = points[r][c], p2 = points[r][c + 1], p3 = points[r + 1][c], p4 = points[r + 1][c + 1];
      [[p1, p2, p3], [p2, p4, p3]].forEach(tri => {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        // Fade weight: 0 near top-left, up to 1 toward bottom-right —
        // mirrors the reference image's own light-to-saturated composition.
        const fade = Math.min(1, Math.max(0, (cx / W) * 0.55 + (cy / H) * 0.55));
        const facetShade = 0.65 + rand() * 0.35; // per-triangle brightness variance for the "facet catching light" look
        triangles.push({
          points: tri,
          color: palette[Math.floor(rand() * palette.length)],
          opacity: fade * 0.4 * facetShade,
        });
      });
    }
  }
  return triangles;
}

export default function SpringboardPage({ onNavigate }) {
  const { currentUser, currentUserPermissions, permissionsLoaded, appPreferences, appearance } = useApp();
  const [activeTabState, setActiveTabState] = useState(null);

  const isAdmin = currentUserPermissions.includes('__admin__') || currentUser?.is_admin === true;
  const b2cMode = appPreferences?.b2c_mode === true;
  const lang = appearance?.language || 'en';
  const themeObj = THEMES.find(th => th.id === (appearance?.theme || 'navy')) || THEMES[0];
  const tileGradients = useMemo(() => getThemeTileGradients(themeObj), [themeObj]);
  const lowPolyMesh = useMemo(() => generateLowPolyMesh(themeObj), [themeObj]);
  const canSee = makeCanSee({ isAdmin, b2cMode, appPreferences, currentUserPermissions, permissionsLoaded });

  // Tab -> items mapping. Swaps in the B2C (retail) or B2B (CRM) item set
  // per tab, pulled from the exact same shared arrays the sidebar uses —
  // never a separately-maintained list, so this can't quietly drift out of
  // sync with what the sidebar actually shows for this user.
  const TABS = useMemo(() => {
    const salesItems = b2cMode
      ? RETAIL_GROUP.filter(i => ['retailCustomers','retailOrders','retailInvoices','manageBookings'].includes(i.key))
      : SALES_GROUP.filter(i => ['customers','contacts','leads','opportunities','quotations'].includes(i.key));
    const meItems = b2cMode
      ? [...RETAIL_GROUP.filter(i => i.key === 'retailActivities'), { key:'_profile', label:'myProfile', icon:'👤', permission:null }]
      : [...SALES_GROUP.filter(i => i.key === 'activities'), ...BOTTOM_ITEMS.filter(i => i.key === 'approvals'), { key:'_profile', label:'myProfile', icon:'👤', permission:null }];
    const opsItems = b2cMode
      ? RETAIL_GROUP.filter(i => i.key === 'retailProducts')
      : [...SALES_GROUP.filter(i => i.key === 'products'), ...BOTTOM_ITEMS.filter(i => ['orders','invoices'].includes(i.key))];
    const reportsTile = BOTTOM_ITEMS.filter(i => i.key === 'reports');
    const adminItems = BOTTOM_ITEMS.filter(i => i.key === 'adminTools');

    return [
      { id:'me',             label:'Me',              icon:'🙋', items: meItems },
      { id:'sales',          label:'Sales',           icon:'💰', items: salesItems },
      { id:'operations',     label:'Operations',      icon:'⚙️', items: opsItems },
      { id:'reports',        label:'Reports',         icon:'⚡', items: reportsTile },
      { id:'salesDashboard', label:'Sales Dashboard', icon:'📊', items: [DASHBOARD_ITEM] },
      { id:'adminTool',      label:'Admin Tool',      icon:'🔧', items: adminItems },
    ];
  }, [b2cMode]);

  // Only tabs with at least one visible item ever show — e.g. Admin Tool
  // disappears entirely for non-admins, matching how the sidebar hides
  // individual items rather than showing an empty section.
  const visibleTabs = useMemo(
    () => TABS.map(tab => ({ ...tab, items: tab.items.filter(canSee) })).filter(tab => tab.items.length > 0),
    [TABS, canSee]
  );

  const activeTab = (activeTabState && visibleTabs.some(tb => tb.id === activeTabState))
    ? activeTabState
    : visibleTabs[0]?.id;
  const currentTab = visibleTabs.find(tb => tb.id === activeTab);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (!visibleTabs.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Nothing to show here yet — check back once you have access to at least one area.
      </div>
    );
  }

  return (
    <div className="relative min-h-screen -m-6 p-6">
      {/* Ambient background — a low-poly faceted triangle mesh, matching the
          reference image's crystalline look, colored from the tenant's own
          theme palette rather than fixed blue, and faded from near-invisible
          near the greeting text toward more visible in the open canvas.
          Deliberately no z-index here (relies on normal DOM paint order —
          this div is declared before the content below, so it naturally
          paints first/behind) since a negative z-index can slip an element
          behind an ANCESTOR's own background if that ancestor establishes
          its own stacking context, which is what made an earlier version of
          this invisible entirely. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <svg viewBox="0 0 900 520" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMaxYMax slice">
          {lowPolyMesh.map((tri, i) => (
            <polygon
              key={i}
              points={tri.points.map(p => p.join(',')).join(' ')}
              fill={tri.color}
              opacity={tri.opacity}
            />
          ))}
        </svg>
      </div>

      <div className="relative space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{greeting()}, {currentUser?.first_name || 'there'} 👋</h1>
          <p className="text-gray-500 text-sm mt-1">Jump straight to what you need.</p>
        </div>

        {/* Tab bar — plain clickable text, one shared line beneath the row,
            active tab gets a colored underline sitting on that same line */}
        <div className="flex gap-7 border-b border-gray-200 overflow-x-auto">
          {visibleTabs.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabState(tab.id)}
                className={`flex items-center gap-2 pb-3 pt-1 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors duration-200 ${
                  active ? '' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
                style={active ? { color: themeObj.accent, borderColor: themeObj.accent } : undefined}
              >
                <span className="text-base">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tile grid — bold tiles in gradients derived from the tenant's own
            selected theme, not a generic unrelated palette */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {currentTab?.items.map((item, idx) => (
            <button
              key={item.key}
              onClick={() => item.key === '_profile' ? window.dispatchEvent(new CustomEvent('open-profile')) : onNavigate?.(item.key)}
              className="group relative aspect-square rounded-[24px] text-white shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 flex flex-col items-center justify-center gap-3 p-4 overflow-hidden"
              style={{ background: tileGradients[idx % tileGradients.length] }}
            >
              {/* Subtle sheen for depth, rather than a flat gradient fill */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/10 pointer-events-none" />
              <div className="relative w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <span className="text-3xl drop-shadow-md">{item.icon}</span>
              </div>
              <span className="relative text-sm font-bold text-center leading-tight drop-shadow-sm">{t(lang, item.label)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
