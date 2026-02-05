/*
 * WebCrypto-based encryption module
 * Implements AES-256-GCM with 256-bit keys
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

export interface EncryptedData {
  ciphertext: string;  // base64
  iv: string;          // base64
  salt?: string;       // base64 (optional, for passphrase-based encryption)
}

/**
 * Generate a random encryption key
 * Used for automatic encryption (no passphrase)
 */
export async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive a key from a passphrase using PBKDF2
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const encoder = new TextEncoder();
  const passphraseData = encoder.encode(passphrase);
  
  // Import passphrase as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passphraseData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive the actual encryption key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
  
  return { key, salt };
}

/**
 * Export a key to base64 string
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

/**
 * Import a key from base64 string
 */
export async function importKey(keyData: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyData);
  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    ALGORITHM,
    true,
    ['decrypt']
  );
}

/**
 * Encrypt plaintext using AES-256-GCM
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    data
  );
  
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 */
export async function decrypt(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const encryptedData = base64ToArrayBuffer(ciphertext);
  const ivData = base64ToArrayBuffer(iv);
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: new Uint8Array(ivData),
    },
    key,
    encryptedData
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Encrypt with passphrase
 */
export async function encryptWithPassphrase(
  plaintext: string,
  passphrase: string
): Promise<EncryptedData> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { key } = await deriveKeyFromPassphrase(passphrase, salt);
  
  const { ciphertext, iv } = await encrypt(plaintext, key);
  
  return {
    ciphertext,
    iv,
    salt: arrayBufferToBase64(salt),
  };
}

/**
 * Decrypt with passphrase
 */
export async function decryptWithPassphrase(
  data: EncryptedData,
  passphrase: string
): Promise<string> {
  if (!data.salt) {
    throw new Error('Salt required for passphrase decryption');
  }
  
  const salt = base64ToArrayBuffer(data.salt);
  const { key } = await deriveKeyFromPassphrase(passphrase, new Uint8Array(salt));
  
  return await decrypt(data.ciphertext, data.iv, key);
}

/**
 * Generate a shareable URL with the key in the fragment
 */
export function generateShareableUrl(secretId: string, key: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/s/${secretId}#${key}`;
}

/**
 * Parse key from URL fragment
 */
export function parseKeyFromUrl(): string | null {
  const hash = window.location.hash.slice(1); // Remove #
  return hash || null;
}

// Helper functions
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}