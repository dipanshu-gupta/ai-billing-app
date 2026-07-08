// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { THEMES, LANGUAGES } from '@/lib/i18n';

const FONT_OPTIONS = [
  { id:'geist',     name:'Geist (Default)',     sample:'Aa Bb Cc' },
  { id:'inter',     name:'Inter',               sample:'Aa Bb Cc' },
  { id:'roboto',    name:'Roboto',              sample:'Aa Bb Cc' },
  { id:'poppins',   name:'Poppins',             sample:'Aa Bb Cc' },
  { id:'nunito',    name:'Nunito',              sample:'Aa Bb Cc' },
];

export default function AppearancePanel() {
  const { appearance, saveAppearance, currentUser } = useApp();

  const [logoUrl,       setLogoUrl]       = useState(appearance?.company_logo_url || '');
  const [companyName,   setCompanyName]   = useState(appearance?.company_name     || 'Umbrella Suite');
  const [theme,         setTheme]         = useState(appearance?.theme            || 'navy');
  const [language,      setLanguage]      = useState(appearance?.language         || 'en');
  const [font,          setFont]          = useState(appearance?.font             || 'geist');
  const [uploading,     setUploading]     = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [previewLogo,   setPreviewLogo]   = useState(appearance?.company_logo_url || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (appearance) {
      setLogoUrl(appearance.company_logo_url || '');
      setPreviewLogo(appearance.company_logo_url || '');
      setCompanyName(appearance.company_name || 'Umbrella Suite');
      setTheme(appearance.theme || 'navy');
      setLanguage(appearance.language || 'en');
      setFont(appearance.font || 'geist');
    }
  }, [JSON.stringify(appearance)]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewLogo(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      // Use Supabase Storage
      const { supabase } = await import('@/lib/supabase');
      if (!supabase) { alert('Supabase not configured'); return; }

      const ext  = file.name.split('.').pop();
      const path = `logos/company-logo.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) { alert('Upload failed: ' + upErr.message); return; }

      const { data } = supabase.storage.from('company-assets').getPublicUrl(path);
      const url = data.publicUrl + '?t=' + Date.now(); // cache-bust
      setLogoUrl(url);
      setPreviewLogo(url);
    } catch(e: any) {
      alert('Upload error: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await saveAppearance({ company_logo_url: logoUrl, company_name: companyName, theme, language, font });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const selectedTheme = THEMES.find(t => t.id === theme) || THEMES[0];
  const selectedLang  = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-blue-900 rounded-[24px] p-6 text-white flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">🎨 Appearance</h2>
          <p className="text-blue-200 text-sm mt-1">Brand identity, themes, language — affects all users</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="bg-white text-[#0F172A] px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 disabled:opacity-50 shadow-md flex items-center gap-2">
          {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save All'}
        </button>
      </div>

      {/* Company Identity */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100">
          <h3 className="font-bold text-[#0F172A] text-lg">🏢 Company Identity</h3>
          <p className="text-sm text-gray-500 mt-0.5">Your logo and company name shown in the header for all users</p>
        </div>
        <div className="p-6 flex flex-col md:flex-row gap-8 items-start">
          {/* Logo upload */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-40 h-24 rounded-2xl border-2 border-dashed border-blue-200 bg-gradient-to-br from-blue-50 to-slate-50 flex items-center justify-center overflow-hidden">
              {previewLogo
                ? <img src={previewLogo} alt="Company logo" className="w-full h-full object-contain p-2"/>
                : <div className="text-center">
                    <div className="text-3xl mb-1">🏢</div>
                    <div className="text-xs text-gray-400">No logo</div>
                  </div>
              }
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-md">
              {uploading ? '⏳ Uploading...' : '📤 Upload Logo'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload}/>
            <p className="text-xs text-gray-400 text-center">PNG, JPG, SVG · Max 2MB<br/>Recommended: 200×60px</p>
            {logoUrl && (
              <button onClick={() => { setLogoUrl(''); setPreviewLogo(''); }}
                className="text-xs text-red-400 hover:text-red-600 underline">
                Remove logo
              </button>
            )}
          </div>

          {/* Company name */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Company Name</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                className="w-full border border-blue-200 rounded-xl px-4 py-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg font-semibold"
                placeholder="Your Company Name"/>
              <p className="text-xs text-gray-400 mt-1.5">Shown in the header when no logo is uploaded</p>
            </div>

            {/* Header preview */}
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Header Preview</label>
              <div className="rounded-2xl overflow-hidden border border-blue-100 shadow-sm">
                <div className="h-14 flex items-center px-5 gap-3"
                  style={{background:`linear-gradient(135deg, ${selectedTheme.sidebar}, ${selectedTheme.accent})`}}>
                  <div className="flex items-center gap-2.5">
                    {previewLogo
                      ? <img src={previewLogo} alt="logo" className="h-8 object-contain rounded-lg bg-white/10 p-1"/>
                      : <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center font-black text-sm"
                          style={{color: selectedTheme.sidebar}}>
                          {companyName.slice(0,2).toUpperCase()}
                        </div>
                    }
                    <div className="text-white font-bold text-sm">{companyName}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="bg-white/20 text-white text-xs px-3 py-1 rounded-lg">🤖 AI Advisor</div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                      {currentUser?.first_name?.charAt(0)}{currentUser?.last_name?.charAt(0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Selection */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100">
          <h3 className="font-bold text-[#0F172A] text-lg">🎨 Application Theme</h3>
          <p className="text-sm text-gray-500 mt-0.5">Color scheme applied globally for all users</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {THEMES.map(th => (
              <button key={th.id} onClick={() => setTheme(th.id)}
                className={`relative rounded-2xl overflow-hidden border-2 transition-all ${theme === th.id ? 'border-blue-500 shadow-lg scale-105' : 'border-gray-200 hover:border-blue-300'}`}>
                {/* Theme preview */}
                <div className="h-20 flex">
                  <div className="w-10 flex-shrink-0" style={{background: th.colors[0]}}/>
                  <div className="flex-1 flex flex-col">
                    <div className="h-6" style={{background: `linear-gradient(135deg, ${th.colors[0]}, ${th.colors[1]})`}}/>
                    <div className="flex-1 bg-gray-50 p-1">
                      <div className="w-full h-1.5 rounded-full mb-1" style={{background: th.colors[2]}}/>
                      <div className="w-3/4 h-1.5 rounded-full bg-gray-200"/>
                    </div>
                  </div>
                </div>
                <div className="px-2 py-1.5 text-center">
                  <div className="text-xs font-semibold text-[#0F172A]">{th.name}</div>
                </div>
                {theme === th.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100">
          <h3 className="font-bold text-[#0F172A] text-lg">🌍 Application Language</h3>
          <p className="text-sm text-gray-500 mt-0.5">Translates UI elements (navigation, buttons, labels) — not data records</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {LANGUAGES.map(lang => (
              <button key={lang.code} onClick={() => setLanguage(lang.code)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border-2 text-sm font-medium transition-all ${language === lang.code ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' : 'border-gray-200 hover:border-blue-300 text-gray-700'}`}>
                <span className="text-xl flex-shrink-0">{lang.flag}</span>
                <span className="text-left leading-tight">{lang.label.split(' ')[0]}</span>
                {language === lang.code && <span className="ml-auto text-blue-500">✓</span>}
              </button>
            ))}
          </div>
          {language !== 'en' && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <span className="text-xl flex-shrink-0">ℹ️</span>
              <div>
                <div className="text-sm font-semibold text-amber-800">Translation Applied</div>
                <div className="text-xs text-amber-600 mt-0.5">
                  UI navigation, buttons and labels will appear in {selectedLang.label}. 
                  {LANGUAGES.find(l=>l.code===language)?.dir==='rtl' && ' Right-to-left layout will be applied.'}
                  {' '}Customer data and record names remain in their original language.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Typography */}
      <div className="bg-white rounded-[24px] border border-blue-100 shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100">
          <h3 className="font-bold text-[#0F172A] text-lg">✍️ Typography</h3>
          <p className="text-sm text-gray-500 mt-0.5">Application-wide font family</p>
        </div>
        <div className="p-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {FONT_OPTIONS.map(fo => (
            <button key={fo.id} onClick={() => setFont(fo.id)}
              className={`flex flex-col items-center gap-1.5 px-3 py-4 rounded-2xl border-2 transition-all ${font===fo.id?'border-blue-500 bg-blue-50 shadow-md':'border-gray-200 hover:border-blue-300'}`}>
              <span className="text-2xl font-bold text-[#0F172A]">{fo.sample}</span>
              <span className="text-xs text-gray-500 text-center">{fo.name}</span>
              {font===fo.id && <span className="text-blue-500 text-xs">✓ Active</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-8 py-3 rounded-2xl font-bold hover:opacity-90 disabled:opacity-50 shadow-xl text-sm">
          {saving ? '⏳ Saving all changes...' : saved ? '✅ All changes saved!' : '💾 Save Appearance Settings'}
        </button>
      </div>
    </div>
  );
}
