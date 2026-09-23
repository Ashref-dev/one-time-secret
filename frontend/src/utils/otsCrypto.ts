/* Real zero-knowledge crypto — AES-256-GCM via WebCrypto.
 * Plaintext never leaves the browser unencrypted. Key lives in URL fragment.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

export interface EncryptedData {
  ciphertext: string; // base64
  iv: string; // base64
  salt?: string; // base64
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGORITHM, length: KEY_LENGTH }, true, ['encrypt', 'decrypt']);
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufToB64(raw);
}

export async function importKey(keyData: string): Promise<CryptoKey> {
  const buf = b64ToBuf(keyData);
  return crypto.subtle.importKey('raw', buf, ALGORITHM, true, ['decrypt']);
}

export async function encrypt(plaintext: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const data = new TextEncoder().encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data);
  return { ciphertext: bufToB64(enc), iv: bufToB64(iv.buffer as ArrayBuffer) };
}

export async function decrypt(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const encBuf = b64ToBuf(ciphertext);
  const ivBuf = b64ToBuf(iv);
  const dec = await crypto.subtle.decrypt({ name: ALGORITHM, iv: new Uint8Array(ivBuf) }, key, encBuf);
  return new TextDecoder().decode(dec);
}

export function generateShareableUrl(secretId: string, key: string): string {
  return `${window.location.origin}/s/${secretId}#${key}`;
}

export function parseKeyFromUrl(): string | null {
  const hash = window.location.hash.slice(1);
  return hash || null;
}

export function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
