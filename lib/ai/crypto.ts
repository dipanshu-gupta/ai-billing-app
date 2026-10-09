// Server-only. AES-256-GCM for tenant AI keys. Stored as base64(iv[12] + tag[16] + ciphertext).
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function key(): Buffer {
  const raw = process.env.AI_KEYS_SECRET || '';
  const buf = Buffer.from(raw, 'base64');
  if (buf.length < 32) throw new Error('AI_KEYS_SECRET_MISSING');
  return buf.subarray(0, 32);
}
export function aiCryptoConfigured(): boolean {
  try { key(); return true; } catch { return false; }
}
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
export function decryptSecret(blob: string): string {
  const b = Buffer.from(blob, 'base64');
  const d = createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}
