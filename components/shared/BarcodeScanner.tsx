// @ts-nocheck
'use client';
/**
 * Camera barcode scanner (phone, tablet or laptop camera).
 *
 * - Continuous mode (line items): stays open, every new barcode is handed to onDetected, which answers
 *   { ok, message }; the result flashes green/red with a beep, and a running list shows what was added.
 * - Single mode (product form): closes after the first code.
 * - Decoding uses the browser's built-in BarcodeDetector where available (Chrome/Edge on Android, macOS, ChromeOS),
 *   otherwise the ZXing library (iPhone/iPad Safari, Firefox, Windows) loaded only when the scanner opens.
 * - The same code is ignored for 1.5 s so a barcode held in front of the camera is not added repeatedly.
 * - Torch and camera switching when the device supports them; a "type the code" box is always available
 *   (no camera, permission denied, or a damaged label).
 */
import { useEffect, useRef, useState } from 'react';
import { normalizeBarcode, scanFeedback } from '@/lib/barcode';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code', 'data_matrix'];
const REPEAT_MS = 1500;

export default function BarcodeScanner({ open, onClose, onDetected, mode = 'continuous', title = 'Scan barcode' }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const busyRef = useRef(false);
  const lastRef = useRef({ code: '', at: 0 });
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState<null | { ok: boolean; message: string }>(null);
  const [log, setLog] = useState<{ ok: boolean; message: string; at: number }[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [manual, setManual] = useState('');

  const stopAll = () => {
    try { stopRef.current?.(); } catch {}
    stopRef.current = () => {};
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setTorchOn(false);
  };

  const handle = async (raw: string) => {
    const code = normalizeBarcode(raw);
    if (!code || busyRef.current) return;
    const now = Date.now();
    if (lastRef.current.code === code && now - lastRef.current.at < REPEAT_MS) return;
    lastRef.current = { code, at: now };
    busyRef.current = true;
    try {
      const res = (await onDetected(code)) || { ok: true, message: code };
      scanFeedback(!!res.ok);
      setFlash({ ok: !!res.ok, message: res.message || code });
      setLog(l => [{ ok: !!res.ok, message: res.message || code, at: now }, ...l].slice(0, 30));
      if (mode === 'single' && res.ok) { stopAll(); onClose?.(); }
    } finally {
      busyRef.current = false;
      lastRef.current = { code, at: Date.now() };
    }
  };

  // Camera callbacks are created once per camera start; they always call the latest handler through this ref.
  const handleRef = useRef(handle); handleRef.current = handle;

  useEffect(() => {
    if (!open) { stopAll(); return; }
    let cancelled = false;
    setStatus('starting'); setError(''); setFlash(null);
    (async () => {
      try {
        if (typeof window !== 'undefined' && !window.isSecureContext) throw Object.assign(new Error('insecure'), { name: 'Insecure' });
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('nocam'), { name: 'NotFoundError' });
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        try { setTorchOk(!!track?.getCapabilities?.()?.torch); } catch { setTorchOk(false); }
        try { const all = await navigator.mediaDevices.enumerateDevices(); setDevices(all.filter(d => d.kind === 'videoinput')); } catch {}
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true'); video.muted = true;
        await video.play().catch(() => {});

        // Built-in detector first.
        const BD = (window as any).BarcodeDetector;
        let supported: string[] = [];
        if (BD?.getSupportedFormats) { try { supported = await BD.getSupportedFormats(); } catch {} }
        const formats = FORMATS.filter(f => supported.includes(f));
        if (BD && formats.length) {
          const detector = new BD({ formats });
          let alive = true;
          const tick = async () => {
            if (!alive || cancelled) return;
            if (video.readyState >= 2 && !busyRef.current) {
              try { const found = await detector.detect(video); if (found?.[0]?.rawValue) await handleRef.current(found[0].rawValue); } catch {}
            }
            setTimeout(tick, 120);
          };
          stopRef.current = () => { alive = false; };
          tick();
        } else {
          // ZXing fallback (loaded on demand).
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (cancelled) return;
          const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 300 });
          const controls = await reader.decodeFromStream(stream, video, (result) => { if (result) handleRef.current(result.getText()); });
          stopRef.current = () => controls?.stop();
        }
        if (!cancelled) setStatus('scanning');
      } catch (e: any) {
        if (cancelled) return;
        stopAll();
        const n = e?.name;
        setError(
          n === 'NotAllowedError' || n === 'SecurityError' ? 'Camera access was blocked. Allow the camera for this site in your browser settings, or type the code below.'
          : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'No camera was found on this device. Type the code below or use a handheld scanner.'
          : n === 'NotReadableError' ? 'The camera is being used by another app. Close it and try again, or type the code below.'
          : n === 'Insecure' ? 'The camera only works on a secure (https) connection. Type the code below instead.'
          : 'The camera could not be started. Type the code below or use a handheld scanner.'
        );
        setStatus('error');
      }
    })();
    const onHide = () => { if (document.hidden) stopAll(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onHide); stopAll(); };
  }, [open, deviceId]);

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 1800); return () => clearTimeout(t); }, [flash]);
  useEffect(() => { if (!open) { setLog([]); setManual(''); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torchOn }] }); setTorchOn(!torchOn); } catch {}
  };
  const nextCamera = () => {
    if (devices.length < 2) return;
    const cur = streamRef.current?.getVideoTracks()[0]?.getSettings?.()?.deviceId || deviceId;
    const i = devices.findIndex(d => d.deviceId === cur);
    setDeviceId(devices[(i + 1) % devices.length].deviceId);
  };
  const submitManual = async (e) => {
    e.preventDefault();
    const c = manual.trim();
    if (!c) return;
    lastRef.current = { code: '', at: 0 }; // typed codes are never treated as a repeat
    await handle(c);
    setManual('');
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-lg bg-[#0F172A] rounded-[24px] overflow-hidden shadow-2xl flex flex-col max-h-[96vh]">
        <div className="flex items-center justify-between px-5 py-3 text-white">
          <div>
            <h3 className="font-bold">{title}</h3>
            <p className="text-xs text-blue-200">{mode === 'continuous' ? 'Keep scanning — each item is added to the lines. Press Done when finished.' : 'Point the camera at the barcode.'}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20" aria-label="Close scanner">✕</button>
        </div>

        <div className="relative bg-black aspect-[4/3] w-full">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          {status === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-[78%] h-[38%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                <div className="absolute left-2 right-2 h-0.5 bg-red-500/90 animate-[scanline_1.8s_ease-in-out_infinite]" style={{ top: '50%' }} />
              </div>
            </div>
          )}
          {status === 'starting' && <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">Starting camera…</div>}
          {status === 'error' && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white text-sm leading-relaxed">📷<br />{error}</div>}
          {flash && (
            <div className={`absolute left-3 right-3 bottom-3 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg ${flash.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`} role="status" aria-live="assertive">
              {flash.ok ? '✓ ' : '✗ '}{flash.message}
            </div>
          )}
          <div className="absolute top-3 right-3 flex gap-2">
            {torchOk && <button onClick={toggleTorch} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${torchOn ? 'bg-yellow-400 text-black' : 'bg-black/50 text-white'}`}>🔦 {torchOn ? 'On' : 'Torch'}</button>}
            {devices.length > 1 && <button onClick={nextCamera} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-black/50 text-white">🔄 Camera</button>}
          </div>
        </div>

        <form onSubmit={submitManual} className="flex gap-2 px-4 py-3 bg-[#111C33]" data-barcode-input>
          <input value={manual} onChange={e => setManual(e.target.value)} inputMode="text" autoComplete="off"
            placeholder="Or type / scan the code here" className="flex-1 rounded-xl px-3 py-2.5 text-sm bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <button type="submit" disabled={!manual.trim()} className="px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold disabled:opacity-40">Add</button>
        </form>

        {mode === 'continuous' && (
          <div className="bg-white flex-1 min-h-0 overflow-y-auto">
            {log.length === 0
              ? <p className="text-xs text-gray-400 text-center py-4">Scanned items will appear here.</p>
              : <ul className="divide-y divide-gray-100">
                  {log.map((l, i) => (
                    <li key={l.at + '-' + i} className={`px-4 py-2 text-sm flex items-center gap-2 ${l.ok ? 'text-[#0F172A]' : 'text-red-600'}`}>
                      <span>{l.ok ? '✓' : '✗'}</span><span className="truncate">{l.message}</span>
                    </li>
                  ))}
                </ul>}
          </div>
        )}
        <div className="px-4 py-3 bg-white border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-bold">Done</button>
        </div>
      </div>
      <style>{`@keyframes scanline{0%,100%{transform:translateY(-38px)}50%{transform:translateY(38px)}}`}</style>
    </div>
  );
}
