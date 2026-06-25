// @ts-nocheck
'use client';
import { useState } from 'react';

const COUNTRY_CODES = [
  { code:'+91',  flag:'🇮🇳', name:'India',          digits:10 },
  { code:'+1',   flag:'🇺🇸', name:'USA/Canada',     digits:10 },
  { code:'+44',  flag:'🇬🇧', name:'UK',             digits:10 },
  { code:'+971', flag:'🇦🇪', name:'UAE',            digits:9  },
  { code:'+65',  flag:'🇸🇬', name:'Singapore',      digits:8  },
  { code:'+61',  flag:'🇦🇺', name:'Australia',      digits:9  },
  { code:'+49',  flag:'🇩🇪', name:'Germany',        digits:11 },
  { code:'+33',  flag:'🇫🇷', name:'France',         digits:9  },
  { code:'+81',  flag:'🇯🇵', name:'Japan',          digits:10 },
  { code:'+86',  flag:'🇨🇳', name:'China',          digits:11 },
  { code:'+55',  flag:'🇧🇷', name:'Brazil',         digits:11 },
  { code:'+27',  flag:'🇿🇦', name:'South Africa',   digits:9  },
  { code:'+60',  flag:'🇲🇾', name:'Malaysia',       digits:9  },
  { code:'+66',  flag:'🇹🇭', name:'Thailand',       digits:9  },
  { code:'+92',  flag:'🇵🇰', name:'Pakistan',       digits:10 },
  { code:'+880', flag:'🇧🇩', name:'Bangladesh',     digits:10 },
  { code:'+94',  flag:'🇱🇰', name:'Sri Lanka',      digits:9  },
  { code:'+977', flag:'🇳🇵', name:'Nepal',          digits:10 },
  { code:'+98',  flag:'🇮🇷', name:'Iran',           digits:10 },
  { code:'+20',  flag:'🇪🇬', name:'Egypt',          digits:10 },
];

// Combine countryCode + number into a single string for storage
export const parsePhone = (stored) => {
  if (!stored) return { countryCode:'+91', number:'' };
  const cc = COUNTRY_CODES.find(c => stored.startsWith(c.code));
  if (cc) return { countryCode: cc.code, number: stored.slice(cc.code.length).trim() };
  return { countryCode:'+91', number: stored.replace(/^\+\d+\s*/, '') };
};

export const formatPhone = (countryCode, number) =>
  number ? `${countryCode} ${number}` : '';

export default function PhoneInput({ value, onChange, placeholder = 'Phone number', className = '', disabled = false }) {
  const parsed = parsePhone(value);
  const [cc, setCc] = useState(parsed.countryCode || '+91');
  const [num, setNum] = useState(parsed.number || '');
  const [error, setError] = useState('');

  const ccDef = COUNTRY_CODES.find(c => c.code === cc) || COUNTRY_CODES[0];

  const handleChange = (newNum) => {
    // Strip non-numeric characters
    const clean = newNum.replace(/\D/g, '');
    setNum(clean);
    setError('');
    if (clean && clean.length !== ccDef.digits) {
      setError(`${ccDef.name} numbers are ${ccDef.digits} digits`);
    }
    onChange(formatPhone(cc, clean));
  };

  const handleCCChange = (newCc) => {
    setCc(newCc);
    setNum('');
    setError('');
    onChange('');
  };

  const iCls = `flex-1 border border-blue-200 rounded-r-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 ${className}`;

  return (
    <div>
      <div className={`flex ${disabled ? 'opacity-60' : ''}`}>
        <select value={cc} onChange={e=>handleCCChange(e.target.value)} disabled={disabled}
          className="border border-blue-200 border-r-0 rounded-l-xl px-2 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[90px]">
          {COUNTRY_CODES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
        </select>
        <input
          type="tel"
          value={num}
          onChange={e=>handleChange(e.target.value)}
          placeholder={placeholder || `${ccDef.digits} digits`}
          maxLength={ccDef.digits}
          disabled={disabled}
          className={`${iCls} ${error ? 'border-red-400' : ''}`}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
