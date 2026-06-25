// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const FIELD_TYPES = [
  { v:'text',          l:'Text',          icon:'✏️' },
  { v:'number',        l:'Number',        icon:'🔢' },
  { v:'currency',      l:'Currency',      icon:'💰' },
  { v:'single_select', l:'Single Select', icon:'🔘' },
  { v:'multi_select',  l:'Multi Select',  icon:'☑️' },
];

const iCls = 'w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';
const sCls = 'w-full border border-blue-200 rounded-xl px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400';
const emptyQ = () => ({ _key:Date.now(), question_text:'', field_type:'text', options:[], condition_question_id:null, condition_operator:'equals', condition_value:'', is_active:true });

export default function ProductConfigurator({ product }) {
  const [questions,   setQuestions]   = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [saved,       setSaved]       = useState(false);
  const [optionInput, setOptionInput] = useState({});

  // ── Get the product's DB id (stored as text in product_config_questions) ────
  // products.id may be integer or UUID depending on how the table was created
  // We use _uuid (which is set to p.id in fetchProducts) as the authoritative value
  async function resolveProductId() {
    if (!supabase || !product) return null;
    // _uuid is set to the raw p.id from supabase in fetchProducts mapping
    const candidate = product?._uuid;
    if (candidate !== undefined && candidate !== null) return String(candidate);
    // Fallback: query by name
    const { data } = await supabase
      .from('products').select('id').eq('name', product.name).maybeSingle();
    return data ? String(data.id) : null;
  }

  useEffect(() => { load(); }, [product?._uuid, product?.id]);

  async function load() {
    if (!supabase || !product) return;
    setLoading(true);
    const pid = await resolveProductId();
    if (!pid) { setLoading(false); return; }
    const { data } = await supabase
      .from('product_config_questions')
      .select('*')
      .eq('product_id', pid)
      .order('sort_order');
    setQuestions((data || []).map((q, i) => ({
      ...q,
      _key: q.id || String(i),
      options: q.options || [],
      // Reconstruct condition_question_id as the _key of the source question (by sort_order)
      condition_question_id: q.condition_question_id !== null && q.condition_question_id !== undefined
        ? String(q.condition_question_id)  // will be matched to sort_order in UI
        : null,
    })));
    setLoading(false);
  }

  const upd = (idx, field, val) => setQuestions(p => p.map((q,i) => i===idx ? {...q,[field]:val} : q));
  const addOption = (idx) => {
    const v = (optionInput[idx]||'').trim();
    if (!v) return;
    upd(idx, 'options', [...(questions[idx].options||[]), v]);
    setOptionInput(p => ({...p,[idx]:''}));
  };
  const removeOption = (idx, oi) => upd(idx, 'options', questions[idx].options.filter((_,i) => i!==oi));
  const move = (idx, dir) => {
    const arr = [...questions];
    const to = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    setQuestions(arr);
  };

  async function save() {
    if (!supabase || !product) return;
    setSaving(true);
    const pid  = await resolveProductId();
    const pnum = String(product?.id || product?.product_number || '');
    if (!pid) {
      alert('Could not resolve product UUID. Please reload and try again.');
      setSaving(false);
      return;
    }
    await supabase.from('product_config_questions').delete().eq('product_id', pid);
    const rows = questions
      .filter(q => q.question_text?.trim())
      .map((q, i) => ({
        product_id:            pid,
        product_number:        pnum,
        sort_order:            i,
        question_text:         q.question_text.trim(),
        field_type:            q.field_type,
        options:               q.options || [],
        // Store the sort_order (0-based index) of the condition source question
        // condition_question_id is now integer, not uuid
        condition_question_id: (() => {
          if (!q.condition_question_id) return null;
          const src = questions.find(x => (x._key||x.id) === q.condition_question_id);
          return src ? questions.indexOf(src) : null;
        })(),
        condition_operator:    q.condition_operator || 'equals',
        condition_value:       q.condition_value || null,
        is_active:             true,
      }));
    if (rows.length) {
      const { error } = await supabase.from('product_config_questions').insert(rows);
      if (error) { alert('Save failed: ' + error.message); setSaving(false); return; }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await load();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#0F172A]">Product Configuration</h3>
          <p className="text-xs text-gray-400 mt-0.5">Define questions users must answer when adding this product to a line item.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-green-600 text-sm font-semibold">✓ Saved</span>}
          <button onClick={save} disabled={saving}
            className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl text-sm font-bold disabled:opacity-50 shadow hover:opacity-90">
            {saving ? 'Saving…' : '💾 Save Configuration'}
          </button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-14 border-2 border-dashed border-blue-200 rounded-[24px] bg-blue-50/30">
          <div className="text-5xl mb-3">⚙️</div>
          <h4 className="font-bold text-[#0F172A] mb-1">No configuration questions yet</h4>
          <p className="text-sm text-gray-400 mb-5">Add questions to guide users when configuring this product on any line item.</p>
          <button onClick={() => setQuestions([emptyQ()])}
            className="bg-gradient-to-r from-[#0F172A] to-blue-800 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow hover:opacity-90">
            + Add First Question
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q._key||idx} className={`bg-white rounded-[20px] border shadow-sm transition-all ${q.is_active ? 'border-blue-100' : 'border-gray-100 opacity-60'}`}>
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-0.5 mt-1 flex-shrink-0">
                    <button onClick={() => move(idx,-1)} disabled={idx===0} className="w-5 h-5 text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs">▲</button>
                    <span className="text-[11px] font-mono text-gray-400 w-5 text-center">{idx+1}</span>
                    <button onClick={() => move(idx,1)} disabled={idx===questions.length-1} className="w-5 h-5 text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs">▼</button>
                  </div>

                  <div className="flex-1 space-y-3 min-w-0">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">Question Label *</label>
                      <input value={q.question_text} onChange={e => upd(idx,'question_text',e.target.value)}
                        placeholder="e.g. Select colour, Specify dimensions..." className={iCls}/>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Answer Type</label>
                      <div className="grid grid-cols-5 gap-2">
                        {FIELD_TYPES.map(ft => (
                          <button key={ft.v} onClick={() => upd(idx,'field_type',ft.v)}
                            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${q.field_type===ft.v?'bg-[#0F172A] text-white border-transparent shadow':'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                            <span className="text-sm">{ft.icon}</span>{ft.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(q.field_type==='single_select'||q.field_type==='multi_select') && (
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">List of Values</label>
                        {(q.options||[]).length===0 && <p className="text-xs text-amber-600 mb-2">⚠ Add at least one option below.</p>}
                        <div className="space-y-1.5 mb-2">
                          {(q.options||[]).map((opt,oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold flex-shrink-0">{oi+1}</span>
                              <span className="flex-1 text-sm text-[#0F172A] bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">{opt}</span>
                              <button onClick={() => removeOption(idx,oi)} className="text-red-400 hover:text-red-600 text-xs w-5">✕</button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input value={optionInput[idx]||''} onChange={e => setOptionInput(p=>({...p,[idx]:e.target.value}))}
                            onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();addOption(idx);} }}
                            placeholder="Type value, press Enter or +" className={iCls}/>
                          <button onClick={() => addOption(idx)} className="bg-blue-600 text-white px-4 rounded-xl font-bold text-sm hover:bg-blue-700 flex-shrink-0">+</button>
                        </div>
                      </div>
                    )}

                    {idx > 0 && (
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Conditional Logic</label>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                          <p className="text-xs text-amber-700">Show this question only when a previous question's answer matches:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">If Question</label>
                              <select value={q.condition_question_id||''} onChange={e => upd(idx,'condition_question_id',e.target.value||null)} className={sCls}>
                                <option value="">Always show</option>
                                {questions.slice(0,idx).map((pq,pi) => (
                                  <option key={pq._key||pi} value={pq._key||pq.id||pi}>{pi+1}. {pq.question_text||'(untitled)'}</option>
                                ))}
                              </select>
                            </div>
                            {q.condition_question_id && <>
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Operator</label>
                                <select value={q.condition_operator||'equals'} onChange={e => upd(idx,'condition_operator',e.target.value)} className={sCls}>
                                  <option value="equals">Equals</option>
                                  <option value="not_equals">Not Equals</option>
                                  <option value="contains">Contains</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Expected Value</label>
                                {(() => {
                                  const pq = q.condition_question_id !== null ? questions[Number(q.condition_question_id)] : null;
                                  if (pq && (pq.field_type==='single_select'||pq.field_type==='multi_select') && pq.options?.length) {
                                    return <select value={q.condition_value||''} onChange={e => upd(idx,'condition_value',e.target.value)} className={sCls}>
                                      <option value="">Select...</option>
                                      {pq.options.map(o => <option key={o}>{o}</option>)}
                                    </select>;
                                  }
                                  return <input value={q.condition_value||''} onChange={e => upd(idx,'condition_value',e.target.value)} placeholder="e.g. Yes" className={iCls}/>;
                                })()}
                              </div>
                            </>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 ml-1 flex-shrink-0">
                    <button onClick={() => upd(idx,'is_active',!q.is_active)}
                      className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all ${q.is_active?'bg-green-100 text-green-600 hover:bg-green-200':'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                      {q.is_active ? '✓' : '○'}
                    </button>
                    <button onClick={() => setQuestions(p => p.filter((_,i) => i!==idx))}
                      className="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 text-xs font-bold flex items-center justify-center">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => setQuestions(p => [...p, emptyQ()])}
            className="w-full py-3 border-2 border-dashed border-blue-200 rounded-2xl text-sm font-semibold text-blue-500 hover:border-blue-400 hover:bg-blue-50 transition-all">
            + Add Question
          </button>
        </div>
      )}
    </div>
  );
}
