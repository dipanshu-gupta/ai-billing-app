// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

// ─── Evaluate conditional logic ──────────────────────────────────────────────
const isVisible = (question, allQuestions, answers) => {
  if (!question.condition_question_id && question.condition_question_id !== 0) return true;
  const condIdx = Number(question.condition_question_id);
  const condQ   = allQuestions[condIdx];
  if (!condQ) return true;
  const answer   = answers[condQ.id] || '';
  const expected = question.condition_value || '';
  switch (question.condition_operator) {
    case 'equals':     return String(answer).toLowerCase() === String(expected).toLowerCase();
    case 'not_equals': return String(answer).toLowerCase() !== String(expected).toLowerCase();
    case 'contains':   return String(answer).toLowerCase().includes(String(expected).toLowerCase());
    default:           return true;
  }
};

function AnswerField({ question, value, onChange }) {
  switch (question.field_type) {
    case 'number':
      return <input type="number" value={value||''} onChange={e=>onChange(e.target.value)}
        style={{width:'100%',border:'1px solid #BFDBFE',borderRadius:12,padding:'10px 12px',fontSize:14,outline:'none'}}/>;
    case 'currency':
      return (
        <div style={{position:'relative'}}>
          <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF',fontSize:14}}>₹</span>
          <input type="number" value={value||''} onChange={e=>onChange(e.target.value)}
            style={{width:'100%',border:'1px solid #BFDBFE',borderRadius:12,padding:'10px 12px 10px 28px',fontSize:14,outline:'none'}}/>
        </div>
      );
    case 'single_select':
      return (
        <select value={value||''} onChange={e=>onChange(e.target.value)}
          style={{width:'100%',border:'1px solid #BFDBFE',borderRadius:12,padding:'10px 12px',fontSize:14,outline:'none',background:'#fff'}}>
          <option value="">Select...</option>
          {(question.options||[]).map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'multi_select': {
      const selected = value ? String(value).split('||') : [];
      return (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {(question.options||[]).map(o=>(
            <label key={o} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
              <input type="checkbox" checked={selected.includes(o)}
                onChange={e=>{
                  const next = e.target.checked ? [...selected,o] : selected.filter(x=>x!==o);
                  onChange(next.join('||'));
                }} style={{width:16,height:16,accentColor:'#2563EB'}}/>
              <span style={{fontSize:14,color:'#0F172A'}}>{o}</span>
            </label>
          ))}
        </div>
      );
    }
    default:
      return <input type="text" value={value||''} onChange={e=>onChange(e.target.value)}
        style={{width:'100%',border:'1px solid #BFDBFE',borderRadius:12,padding:'10px 12px',fontSize:14,outline:'none'}}/>;
  }
}

export default function ConfigureLineItemModal({
  open, onClose, productName, productId, productNumber, existingAnswers, onSave,
}) {
  const [questions, setQuestions] = useState([]);
  const [answers,   setAnswers]   = useState({});
  const [loading,   setLoading]   = useState(false);

  // Define loadQuestions BEFORE useEffect
  const loadQuestions = async () => {
    if (!supabase) return;
    setLoading(true);
    setQuestions([]);

    // Resolve product DB id by name
    let pid = null;
    if (productName) {
      const { data: prod } = await supabase
        .from('products').select('id').eq('name', productName).maybeSingle();
      if (prod?.id !== undefined && prod?.id !== null) pid = String(prod.id);
    }
    if (!pid && productId !== undefined && productId !== null) pid = String(productId);
    if (!pid) { setLoading(false); return; }

    // Query without is_active filter to debug
    const { data: allData, error: allErr } = await supabase
      .from('product_config_questions')
      .select('*')
      .limit(5);
    console.log('[ConfigModal] ALL questions in table (limit 5):', allData, allErr);

    const { data, error } = await supabase
      .from('product_config_questions')
      .select('*')
      .eq('product_id', pid)
      .order('sort_order');

    console.log('[ConfigModal] questions for pid='+pid+':', data, error);
    setQuestions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    setAnswers(existingAnswers || {});
    loadQuestions();
  }, [open, productId, productNumber, productName]);

  const setAnswer = (qId, val) => setAnswers(p => ({ ...p, [qId]: val }));

  const handleSave = () => { onSave(answers); onClose(); };

  if (!open || typeof document === 'undefined') return null;

  const visibleQuestions = questions.filter(q => isVisible(q, questions, answers));

  const modal = (
    <div style={{position:'fixed',inset:0,zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center',padding:16,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)'}}>
      <div style={{background:'#fff',borderRadius:28,boxShadow:'0 25px 60px rgba(0,0,0,0.25)',width:'100%',maxWidth:560,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>

        <div style={{background:'linear-gradient(135deg,#0F172A,#1e40af)',padding:'20px 24px',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>⚙️</div>
              <div>
                <div style={{color:'#fff',fontWeight:700,fontSize:16}}>Configure: {productName}</div>
                <div style={{color:'#93C5FD',fontSize:12,marginTop:2}}>
                  {loading ? 'Loading...' : `${visibleQuestions.length} question${visibleQuestions.length!==1?'s':''}`}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{color:'rgba(255,255,255,0.6)',fontSize:22,cursor:'pointer',background:'none',border:'none',lineHeight:1}}>✕</button>
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:24}}>
          {loading ? (
            <div style={{display:'flex',justifyContent:'center',padding:'40px 0'}}>
              <div style={{width:32,height:32,border:'4px solid #BFDBFE',borderTopColor:'#2563EB',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
            </div>
          ) : questions.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px 0',color:'#9CA3AF'}}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <div style={{fontWeight:600,color:'#374151',marginBottom:4}}>No configuration questions</div>
              <div style={{fontSize:13}}>Go to the product's Configuration tab to add questions.</div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
              {visibleQuestions.map((q,idx)=>(
                <div key={q.id} style={{background:'#F8FAFC',borderRadius:16,border:'1px solid #E2E8F0',padding:'16px 18px'}}>
                  <div style={{fontWeight:600,fontSize:14,color:'#0F172A',marginBottom:8}}>
                    <span style={{color:'#94A3B8',fontSize:11,fontFamily:'monospace',marginRight:6}}>Q{idx+1}</span>
                    {q.question_text}
                  </div>
                  <AnswerField question={q} value={answers[q.id]||''} onChange={val=>setAnswer(q.id,val)}/>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && questions.length > 0 && (
          <div style={{padding:'16px 24px',borderTop:'1px solid #E2E8F0',display:'flex',gap:12,flexShrink:0}}>
            <button onClick={onClose}
              style={{flex:1,border:'1px solid #E5E7EB',color:'#6B7280',padding:'10px 0',borderRadius:12,fontWeight:600,fontSize:14,cursor:'pointer',background:'#fff'}}>
              Cancel
            </button>
            <button onClick={handleSave}
              style={{flex:2,background:'linear-gradient(135deg,#0F172A,#1e40af)',color:'#fff',padding:'10px 0',borderRadius:12,fontWeight:700,fontSize:14,cursor:'pointer',border:'none'}}>
              ✓ Save Configuration
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return createPortal(modal, document.body);
}
