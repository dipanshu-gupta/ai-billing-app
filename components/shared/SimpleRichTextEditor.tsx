// @ts-nocheck
'use client';
import { useRef, useEffect } from 'react';

/**
 * SimpleRichTextEditor — a minimal contentEditable-based rich text editor
 * for short, formatted blocks of text like Terms & Conditions. Supports
 * bold, italic, and bulleted/numbered lists — deliberately not a full
 * word-processor feature set, since terms & conditions text needs basic
 * formatting, not tables or embedded images. Stores and emits raw HTML,
 * matching how the print engine already renders template content.
 */
export default function SimpleRichTextEditor({ value, onChange, placeholder = 'Enter text...', minHeight = 120 }) {
  const editorRef = useRef(null);
  const isInternalUpdate = useRef(false);

  // Sync external value changes into the editor, but only when they didn't
  // originate from this editor's own onInput - otherwise every keystroke
  // would fight the cursor position by resetting innerHTML underneath it.
  useEffect(() => {
    if (isInternalUpdate.current) { isInternalUpdate.current = false; return; }
    if (editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (command, arg = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    handleInput();
  };

  const handleInput = () => {
    isInternalUpdate.current = true;
    onChange(editorRef.current?.innerHTML || '');
  };

  const isEmpty = !value || value === '<br>' || value.trim() === '';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-blue-400">
      <div className="flex items-center gap-1 bg-gray-50 border-b border-gray-200 px-2 py-1.5">
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>exec('bold')}
          className="w-7 h-7 rounded-lg hover:bg-gray-200 font-bold text-sm text-gray-700" title="Bold">B</button>
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>exec('italic')}
          className="w-7 h-7 rounded-lg hover:bg-gray-200 italic text-sm text-gray-700" title="Italic">I</button>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>exec('insertUnorderedList')}
          className="w-7 h-7 rounded-lg hover:bg-gray-200 text-sm text-gray-700" title="Bullet list">• ≡</button>
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>exec('insertOrderedList')}
          className="w-7 h-7 rounded-lg hover:bg-gray-200 text-sm text-gray-700" title="Numbered list">1. ≡</button>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>exec('removeFormat')}
          className="px-2 h-7 rounded-lg hover:bg-gray-200 text-xs text-gray-500" title="Clear formatting">Clear</button>
      </div>
      <div className="relative">
        {isEmpty && (
          <div className="absolute top-3 left-3 text-gray-300 text-sm pointer-events-none">{placeholder}</div>
        )}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          className="p-3 text-sm text-[#0F172A] focus:outline-none prose-sm"
          style={{ minHeight }}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}
