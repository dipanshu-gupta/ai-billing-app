// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { t, THEMES } from '@/lib/i18n';
import { useObjectLabels } from '@/lib/useObjectLabels';
import { SALES_GROUP, RETAIL_GROUP, BOTTOM_ITEMS, DASHBOARD_ITEM, makeCanSee, buildCustomObjectNavItems } from '@/lib/navPermissions';
import { NavIcon } from '@/lib/icons';
import { ObjectIcon } from '@/lib/lineIcons';
import { Plus } from 'lucide-react';

// Enterprise "textured surface" background, matching the Oracle Fusion
// reference's look: a soft dot/circle texture plus a large, blurred
// abstract organic shape - both colored entirely from the tenant's own
// theme, not a fixed hue. A small seeded PRNG keeps the dot placement
// stable across renders rather than reshuffling on every reload.
function generateSurfacePattern(themeObj) {
  let seed = 7;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const dots = [];
  for (let i = 0; i < 70; i++) {
    dots.push({ cx: rand() * 900, cy: rand() * 420, r: 3 + rand() * 14, opacity: 0.04 + rand() * 0.08, outline: false });
  }
  for (let i = 0; i < 30; i++) {
    dots.push({ cx: rand() * 900, cy: rand() * 420, r: 8 + rand() * 20, opacity: 0.08 + rand() * 0.1, outline: true });
  }
  return dots;
}

export default function SpringboardPage({ onNavigate }) {
  const { currentUser, currentUserPermissions, permissionsLoaded, appPreferences, appearance, setPendingRecord, customObjects } = useApp();
  const [activeTabState, setActiveTabState] = useState(null);

  const isAdmin = currentUserPermissions.includes('__admin__') || currentUser?.is_admin === true;
  const b2cMode = appPreferences?.b2c_mode === true;
  const lang = appearance?.language || 'en';
  const { getObjectLabel } = useObjectLabels();
  const themeObj = THEMES.find(th => th.id === (appearance?.theme || 'navy')) || THEMES[0];
  const surfaceDots = useMemo(() => generateSurfacePattern(themeObj), [themeObj]);
  const canSee = makeCanSee({ isAdmin, b2cMode, appPreferences, currentUserPermissions, permissionsLoaded });

  // Quick Actions — jumps straight to a page with its create form already
  // open, using the same pendingRecord.openCreate mechanism the rest of the
  // app already relies on for cross-page create flows (e.g. "Create
  // Booking" from an Activity), rather than a new, separate mechanism.
  const startCreate = (page) => { setPendingRecord({ page, openCreate: true }); onNavigate?.(page); };
  const QUICK_ACTIONS = useMemo(() => {
    const list = b2cMode
      ? [
          { label: `Create ${getObjectLabel('retailCustomers', 'Customer', 'singular')}`,  icon: '👤', page: 'retailCustomers' },
          { label: `Create ${getObjectLabel('retailOrders', 'Order', 'singular')}`,     icon: '🛍️', page: 'retailOrders' },
          { label: `Create ${getObjectLabel('retailInvoices', 'Invoice', 'singular')}`,   icon: '🧾', page: 'retailInvoices' },
          { label: `Create ${getObjectLabel('retailActivities', 'Activity', 'singular')}`,  icon: '📋', page: 'retailActivities' },
        ]
      : [
          { label: `Create ${getObjectLabel('contacts', 'Contact', 'singular')}`,      icon: '👤', page: 'contacts' },
          { label: `Create ${getObjectLabel('leads', 'Lead', 'singular')}`,         icon: '🎯', page: 'leads' },
          { label: `Create ${getObjectLabel('opportunities', 'Opportunity', 'singular')}`,  icon: '💼', page: 'opportunities' },
          { label: `Create ${getObjectLabel('activities', 'Activity', 'singular')}`,     icon: '📋', page: 'activities' },
        ];
    return list.filter(a => canSee({ key: a.page, permission: null }));
  }, [b2cMode, canSee, getObjectLabel]);

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
      { id:'customObjects',  label:'Custom Objects',  icon:'🧩', items: buildCustomObjectNavItems(customObjects) },
      { id:'reports',        label:'Reports',         icon:'⚡', items: reportsTile },
      { id:'salesDashboard', label:'Sales Dashboard', icon:'📊', items: [DASHBOARD_ITEM] },
      { id:'adminTool',      label:'Admin Tool',      icon:'🔧', items: adminItems },
    ];
  }, [b2cMode, customObjects]);

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
    <div className="relative min-h-screen -m-6">
      {/* Continuous textured surface — gradient wash from the tenant's own
          theme colors, a soft dot texture, and a large blurred organic
          shape for depth. Everything (greeting, tabs, quick actions, apps)
          sits on this one surface, matching the reference's single-plane
          composition rather than a white card floating on a colored page. */}
      <div className="relative overflow-hidden min-h-screen" style={{ background: `linear-gradient(160deg, ${themeObj.colors[0]}, ${themeObj.colors[1]})` }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 900 420" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMaxYMax slice">
            {/* Soft abstract organic shape, off to one side — depth without
                literal imagery that would need explaining */}
            <ellipse cx="700" cy="120" rx="260" ry="220" fill={themeObj.accent} opacity="0.12"/>
            <ellipse cx="780" cy="260" rx="180" ry="160" fill={themeObj.colors[2] || themeObj.accent} opacity="0.10"/>
            {/* Dot texture */}
            {surfaceDots.map((d, i) => (
              d.outline
                ? <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity={d.opacity}/>
                : <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="#FFFFFF" opacity={d.opacity}/>
            ))}
          </svg>
        </div>

        <div className="relative px-6 pt-8 pb-10">
          <div>
            <h1 className="text-4xl text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{greeting()}, {currentUser?.first_name || 'there'}</h1>
            <p className="text-white/60 text-sm mt-1.5">Jump straight to what you need.</p>
          </div>

          {/* Tab bar — white/translucent text on the colored surface, active
              tab gets a solid white underline */}
          <div className="flex gap-7 border-b border-white/15 overflow-x-auto mt-7">
            {visibleTabs.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabState(tab.id)}
                  className={`flex items-center gap-2 pb-3 pt-1 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors duration-200 ${
                    active ? 'text-white border-white' : 'border-transparent text-white/50 hover:text-white/80'
                  }`}
                >
                  <NavIcon iconKey={tab.id} className="w-4 h-4"/>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Actions + Apps grid, side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10 mt-8">
            {QUICK_ACTIONS.length > 0 && (
              <div>
                <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-4">Quick Actions</h3>
                <div className="space-y-1">
                  {QUICK_ACTIONS.map(a => (
                    <button key={a.page} onClick={() => startCreate(a.page)}
                      className="w-full flex items-center gap-3 text-left text-white/85 hover:text-white text-sm py-2 group">
                      <span className="w-6 h-6 rounded-full border border-white/30 flex items-center justify-center group-hover:border-white/60 group-hover:bg-white/10 transition-all flex-shrink-0">
                        <Plus className="w-3.5 h-3.5" strokeWidth={2}/>
                      </span>
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-4">Apps</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {currentTab?.items.map((item, idx) => (
                  <button
                    key={item.key}
                    onClick={() => item.key === '_profile' ? window.dispatchEvent(new CustomEvent('open-profile')) : onNavigate?.(item.key)}
                    className="group relative aspect-square rounded-2xl text-white bg-white/10 hover:bg-white/[0.16] border border-white/15 hover:border-white/30 backdrop-blur-sm shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col items-center justify-center gap-3 p-4"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      {item.isCustomObject ? <ObjectIcon icon={item.icon} className="w-6 h-6 text-white"/> : <NavIcon iconKey={item.key} className="w-6 h-6 text-white"/>}
                    </div>
                    <span className="text-sm font-semibold text-center leading-tight text-white/90">{getObjectLabel(item.key, t(lang, item.label))}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
