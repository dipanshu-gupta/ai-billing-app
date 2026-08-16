// @ts-nocheck
'use client';
import { useState, useEffect, useRef } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useApp } from '@/context/AppContext';
import { tenantScope } from '@/lib/utils';
import { useAlert } from '@/components/shared/AlertProvider';

// Shared multi-image gallery for product detail pages (B2B products & Retail retailProducts).
// Stores each upload as a row in record_attachments (record_type='products'|'retailProducts'),
// and writes the chosen "primary" image's public URL onto the product record's image_url
// column immediately (not just on save), so print/quote/invoice engines can read it right away.
//
// Props:
//   recordType   - 'products' | 'retailProducts' (matches record_attachments.record_type)
//   recordId     - the product's display id (record.id, e.g. 'RPROD-00012')
//   productTable - actual DB table to write image_url onto: 'products' | 'retail_products'
//   productUuid  - the product's real DB uuid (record._uuid) — used for the image_url update
//   imageUrl     - current primary image url (controlled by parent)
//   onImageUrlChange - callback(newUrl) so the parent form reflects the change immediately
export default function ProductImages({ recordType, recordId, productTable, productUuid, imageUrl, onImageUrlChange }) {
  const { supabase } = useTenant();
  const { showAlert, showConfirm } = useAlert();
  const { currentUser } = useApp();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const fileInputRef = useRef(null);

  const fetchImages = async () => {
    if (!supabase || !recordId) return;
    setLoading(true);
    const { data } = await tenantScope(supabase.from('record_attachments').select('*'))
      .eq('record_type', recordType).eq('record_id', recordId)
      .like('file_type', 'image/%')
      .order('uploaded_at', { ascending: false });
    setImages(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchImages(); }, [recordId, recordType]);

  const upload = async (files) => {
    if (!supabase || !currentUser || !files?.length || !recordId) return;
    setUploading(true);
    let firstUploaded = null;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const path = `${recordType}/${recordId}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage.from('product-images').upload(path, file, { upsert: false, contentType: file.type });
      if (storageError) { showAlert(`Upload failed: ${storageError.message}`, { variant:'danger', title:'Upload Failed' }); continue; }
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
      const publicUrl = pub?.publicUrl || '';
      const { data: inserted } = await supabase.from('record_attachments').insert([{
        record_type: recordType, record_id: recordId,
        file_name: file.name, file_size: file.size, file_type: file.type,
        storage_path: path, public_url: publicUrl,
        is_primary: false,
        uploaded_by: currentUser.email, uploaded_at: new Date().toISOString(),
        organization_id: currentUser.organization_id, business_unit_id: currentUser.business_unit_id,
      }]).select().single();
      if (!firstUploaded) firstUploaded = inserted;
    }
    await fetchImages();
    // If the product has no primary image yet, auto-mark the first upload as primary.
    if (firstUploaded && !imageUrl) {
      await setPrimary(firstUploaded);
    }
    setUploading(false);
  };

  const setPrimary = async (img) => {
    if (!supabase || !recordId) return;
    setBusyId(img.id);
    try {
      await supabase.from('record_attachments').update({ is_primary: true }).eq('id', img.id);
      await supabase.from('record_attachments').update({ is_primary: false })
        .eq('record_type', recordType).eq('record_id', recordId).neq('id', img.id);
      // Write the primary image URL onto the product record immediately, not just on save.
      if (productUuid && productTable) {
        await supabase.from(productTable).update({ image_url: img.public_url }).eq('id', productUuid);
      }
      onImageUrlChange?.(img.public_url);
      await fetchImages();
    } finally {
      setBusyId(null);
    }
  };

  const deleteImage = async (img) => {
    if (!supabase) return;
    if (!(await showConfirm('Delete this image?', { variant:'danger', confirmLabel:'Delete' }))) return;
    setBusyId(img.id);
    try {
      await supabase.storage.from('product-images').remove([img.storage_path]);
      await supabase.from('record_attachments').delete().eq('id', img.id);
      if (img.is_primary) {
        if (productUuid && productTable) {
          await supabase.from(productTable).update({ image_url: null }).eq('id', productUuid);
        }
        onImageUrlChange?.(null);
      }
      await fetchImages();
    } finally {
      setBusyId(null);
    }
  };

  if (!recordId) return null;

  return (
    <div className="bg-white rounded-[20px] border border-blue-100 shadow-sm">
      <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🖼️</span>
          <span className="font-bold text-[#0F172A] text-sm">Product Images ({images.length})</span>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => upload(e.target.files)} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full px-3 py-1.5 transition-all disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : '+ Add Images'}
          </button>
        </div>
      </div>

      <div className="p-5">
        <div
          className="border-2 border-dashed border-blue-200 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all mb-4"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}
        >
          <div className="text-3xl mb-1">📷</div>
          <p className="text-gray-400 text-xs">Drag & drop images here or click to upload</p>
        </div>

        {loading ? (
          <div className="text-center py-4 text-gray-400 text-sm">Loading images...</div>
        ) : images.length === 0 ? (
          <div className="text-center py-4 text-gray-300 text-sm">No images yet</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map(img => (
              <div key={img.id} className={`relative group rounded-2xl overflow-hidden border-2 ${img.is_primary ? 'border-amber-400' : 'border-blue-100'}`}>
                <img src={img.public_url} alt={img.file_name} className="w-full h-28 object-cover bg-gray-50" />
                {img.is_primary && (
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-amber-400 text-[#0F172A] px-2 py-0.5 rounded-full shadow">★ Primary</span>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                  {!img.is_primary && (
                    <button
                      onClick={() => setPrimary(img)}
                      disabled={busyId === img.id}
                      title="Set as primary"
                      className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-amber-500 text-sm flex items-center justify-center disabled:opacity-50"
                    >★</button>
                  )}
                  <button
                    onClick={() => deleteImage(img)}
                    disabled={busyId === img.id}
                    title="Delete"
                    className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-red-600 text-sm flex items-center justify-center disabled:opacity-50"
                  >🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
