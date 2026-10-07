// @ts-nocheck
import {
  Users, Contact, Target, Briefcase, FileText, Calendar, Tag,
  ShoppingBag, ShoppingCart, Receipt, BarChart3, Settings, LayoutDashboard,
  User, Wallet, CheckCircle2, MessageCircle, Package, CalendarCheck,
  ClipboardList, Home, Ruler, CreditCard, RefreshCw, Undo2, UserPlus,
  AlertTriangle, DollarSign, TrendingUp, Shapes, Gauge, Zap,
} from 'lucide-react';

// Keyed by the same object/tab keys navPermissions.ts already uses. This is
// the ONE place icon choices live for app navigation - Sidebar.tsx,
// SpringboardPage.tsx, and anything else representing these same modules
// should all import from here rather than keeping their own copy, so an
// icon can't quietly drift out of sync between where it's shown.
export const ICON_MAP = {
  // CRM (B2B)
  customers: Users, contacts: Contact, leads: Target, opportunities: Briefcase,
  activities: Calendar, products: Package, quotations: FileText,
  orders: ShoppingCart, invoices: Receipt, approvals: CheckCircle2,
  // Retail (B2C)
  retailCustomers: Users, retailActivities: Calendar, retailProducts: Tag,
  retailOrders: ShoppingBag, retailInvoices: Receipt, manageBookings: CalendarCheck,
  // Shared / platform
  dashboard: LayoutDashboard, expressDashboard: Gauge, reports: BarChart3, adminTools: Settings,
  whatsappInbox: MessageCircle, home: Home,
  // Springboard tab ids (distinct from the object keys above)
  customObjects: Shapes, me: User, sales: Wallet, operations: Settings,
  salesDashboard: LayoutDashboard, adminTool: Settings,
  // Misc
  _profile: User,
  // Dashboard KPI stat cards (a different category from navigation, but
  // sharing the same lookup map/component rather than a second parallel one)
  avgDealSize: Ruler, invoiceCollection: CreditCard, leadConversion: RefreshCw,
  openActivities: Calendar, activeContacts: Contact,
  invoicesIssued: Receipt, refunds: Undo2, totalCustomers: Users,
  newCustomers: UserPlus, activeProducts: Tag, lowStock: AlertTriangle,
  totalValue: DollarSign, avgValue: TrendingUp, uniqueOwners: User,
  totalRecords: ClipboardList,
};

// Renders the icon for a given key, falling back to a generic list icon for
// anything not yet mapped (e.g. a newly added module) rather than rendering
// nothing at all.
export function NavIcon({ iconKey, className }: { iconKey: string; className?: string }) {
  const Cmp = ICON_MAP[iconKey] || ClipboardList;
  return <Cmp className={className} strokeWidth={1.75} />;
}
