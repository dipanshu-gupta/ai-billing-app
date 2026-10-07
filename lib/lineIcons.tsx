// @ts-nocheck
/**
 * Line-art icon library for Custom Objects (and anything else that needs a
 * tenant-pickable icon). Icons are stored by NAME on custom_objects.icon, so
 * a tenant's choice survives library upgrades. Legacy emoji values (saved
 * before this library existed) still render, as plain text.
 *
 * Looked up by name from lucide-react so a name missing from the installed
 * version simply drops out of the picker instead of breaking the build.
 */
import * as Lucide from 'lucide-react';

export const LINE_ICON_NAMES = [
  // general / objects
  'Package','Box','Boxes','Layers','Shapes','Puzzle','Folder','FolderOpen','Clipboard','ClipboardList','File','FileText','Tag','Key','Lock','Shield','Flag','Star','Gem','Gift','Ticket',
  // business
  'Briefcase','Building2','Store','Factory','Warehouse','Landmark','Hotel','Truck','Handshake','Scale','Gavel','Calculator','Percent','Printer','Target','Award','Trophy','Medal',
  // money & analytics
  'Wallet','CreditCard','Banknote','Coins','Receipt','ShoppingCart','ShoppingBag','BarChart3','PieChart','TrendingUp',
  // people & health
  'User','Users','UserCheck','Baby','Heart','HeartPulse','Stethoscope','Pill','Syringe','Hospital','Dumbbell','Bed','Bath','PawPrint',
  // time & places
  'Calendar','CalendarCheck','Clock','Timer','MapPin','Map','Globe','Compass','Tent','Home','Sofa','Armchair',
  // transport
  'Car','Bike','Bus','Train','Plane','Ship','Anchor','Rocket',
  // education & creative
  'GraduationCap','BookOpen','Book','Library','Music','Video','Camera','Image','Palette','Paintbrush','Scissors','Shirt','Gamepad2','Dices',
  // tech & tools
  'Laptop','Monitor','Smartphone','Cpu','Database','Server','Cloud','Wifi','Phone','Mail','MessageSquare','Wrench','Hammer','Settings','Cog','Ruler','Zap','Lightbulb',
  // nature & food
  'Flame','Droplets','Leaf','TreePine','Sun','Utensils','Coffee','Wine','Microscope','FlaskConical',
].filter((n, i, a) => a.indexOf(n) === i);

export const AVAILABLE_LINE_ICONS = LINE_ICON_NAMES.filter(n => Lucide[n]);

export const isLineIcon = (name) => !!name && !!Lucide[name] && /^[A-Z]/.test(name);

/** Renders a custom object's icon: line art when it is a library name, else the legacy emoji. */
export function ObjectIcon({ icon, className = 'w-5 h-5', strokeWidth = 1.75 }) {
  if (isLineIcon(icon)) {
    const Cmp = Lucide[icon];
    return <Cmp className={className} strokeWidth={strokeWidth} />;
  }
  if (icon) return <span className="leading-none">{icon}</span>;
  const Fallback = Lucide.Package;
  return <Fallback className={className} strokeWidth={strokeWidth} />;
}
