// @ts-nocheck
'use client';
import { useApp } from '@/context/AppContext';
import { THEMES } from '@/lib/i18n';

// Reusable branded loading indicator — uses the ACTUAL uploaded umbrella
// icon image (background stripped to transparent), with a CSS hue-rotate
// filter shifting its colors to match the tenant's selected theme. This
// preserves the exact design (not a hand-redrawn approximation, which
// missed the mark twice before) while still responding to theme changes —
// verified by simulating the rotation on the real image and visually
// comparing several themes before finalizing.
const BASE_HUE = 39.45; // hue (degrees) of the icon's own brown/gold accent color, measured directly from the source image

function hexToHue(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

export default function LoadingSpinner({ size = 48, label = '', className = '' }) {
  const { appearance } = useApp();
  const themeObj = THEMES.find(th => th.id === (appearance?.theme || 'navy')) || THEMES[0];
  const targetHue = hexToHue(themeObj.accent);
  const rotation = (targetHue - BASE_HUE + 360) % 360;

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <img
        src="/umbrella-loading-icon.png"
        alt="Loading"
        className="animate-spin"
        style={{
          width: size,
          height: size,
          animationDuration: '1.2s',
          filter: `hue-rotate(${rotation}deg) saturate(1.6)`,
        }}
      />
      {label && <p className="text-sm text-gray-400 font-medium">{label}</p>}
    </div>
  );
}
