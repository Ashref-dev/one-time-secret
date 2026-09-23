export interface SecretCapsule {
  id: string;
  title: string;
  secretType: 'PASSWORD' | 'API_KEY' | 'SEED_PHRASE' | 'SSH_CERT';
  plaintext: string;
  ciphertextHex: string;
  ivHex: string;
  authTagHex: string;
  keyFragment: string;
  ttlSeconds: number; // Exposure burn duration once opened (e.g. 15s, 30s, 60s)
  vaultExpiryLabel: string; // e.g., "5 MIN", "1 HOUR", "24 HOURS"
  readQuota: '1_READ_BURN' | 'THERMAL_LOUPE_ONLY';
  passphrasePin: string; // Optional secondary PIN
  createdAt: string;
  entropyBits: number;
  shannonPerChar: number;
  sha256Fingerprint: string;
}

export interface SecretPreset {
  id: string;
  label: string;
  type: SecretCapsule['secretType'];
  title: string;
  payload: string;
  ttlSeconds: number;
  vaultExpiryLabel: string;
}

export const SECRET_PRESETS: SecretPreset[] = [
  {
    id: 'sudo-root',
    label: 'SUDO CREDENTIAL',
    type: 'PASSWORD',
    title: 'VALIDATOR / ROOT SUDO',
    payload: `Vlt!99#Kz_8841-QpLm@7xR2$`,
    ttlSeconds: 18,
    vaultExpiryLabel: '1 HOUR',
  },
  {
    id: 'aws-root',
    label: 'AWS ROOT KEY',
    type: 'API_KEY',
    title: 'PROD KMS MASTER KEY',
    payload: `AKIA9X7F4Q2M8ZT1V9LP/wJalrXUtnFEMI4Kx`,
    ttlSeconds: 22,
    vaultExpiryLabel: '1 HOUR',
  },
  {
    id: 'cold-wallet',
    label: 'VAULT SHARD 03/05',
    type: 'SEED_PHRASE',
    title: 'COLD VAULT SHARD #03',
    payload: `velvet-tungsten-reactor-cipher-krypton-09-zenith`,
    ttlSeconds: 26,
    vaultExpiryLabel: '5 MIN',
  },
];

// Calculate Shannon entropy in bits per character and total bits
export function calculateEntropy(text: string): { shannonPerChar: number; totalBits: number; grade: 'CRITICAL' | 'FORTIFIED' | 'MIL-SPEC QUANTUM' } {
  if (!text || text.length === 0) {
    return { shannonPerChar: 0, totalBits: 0, grade: 'CRITICAL' };
  }

  const freq: Record<string, number> = {};
  for (const ch of text) {
    freq[ch] = (freq[ch] || 0) + 1;
  }

  let entropy = 0;
  const len = text.length;
  for (const ch in freq) {
    const p = freq[ch] / len;
    entropy -= p * Math.log2(p);
  }

  const totalBits = Math.min(512, Math.round(entropy * len * 1.35));
  let grade: 'CRITICAL' | 'FORTIFIED' | 'MIL-SPEC QUANTUM' = 'CRITICAL';
  if (totalBits >= 220) {
    grade = 'MIL-SPEC QUANTUM';
  } else if (totalBits >= 96) {
    grade = 'FORTIFIED';
  }

  return {
    shannonPerChar: Number(entropy.toFixed(2)),
    totalBits,
    grade,
  };
}

// Generate deterministic-looking cryptographic hex strings & key fragments
export function generateHex(bytes: number, seedStr: string = ''): string {
  const chars = '0123456789ABCDEF';
  let result = '';
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let i = 0; i < bytes * 2; i++) {
    const r = ((Math.sin(hash + i * 13.37) * 10000) % 1 + 1) % 1;
    const randIndex = Math.floor((r * 0.6 + Math.random() * 0.4) * 16);
    result += chars[randIndex];
  }
  return result;
}

export function generateKeyFragment(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let out = 'k1_';
  for (let i = 0; i < 28; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function forgeSecretCapsule(params: {
  title: string;
  secretType: SecretCapsule['secretType'];
  plaintext: string;
  ttlSeconds: number;
  vaultExpiryLabel: string;
  readQuota: SecretCapsule['readQuota'];
  passphrasePin?: string;
}): SecretCapsule {
  const cleanText = params.plaintext.trim() || 'Vlt!99#Kz_8841-QpLm@7xR2$Thermite_ZeroKnowledge';
  const { shannonPerChar, totalBits } = calculateEntropy(cleanText);
  const id = `OTS-${generateHex(3, cleanText)}-${Math.floor(100 + Math.random() * 899)}`;
  const ivHex = generateHex(12, cleanText + 'IV');
  const authTagHex = generateHex(16, cleanText + 'TAG');
  const ciphertextHex = generateHex(Math.max(24, Math.min(64, cleanText.length)), cleanText);
  const sha256Fingerprint = generateHex(32, cleanText + id);

  return {
    id,
    title: params.title.trim() || 'CLASSIFIED ZERO-KNOWLEDGE PAYLOAD',
    secretType: params.secretType,
    plaintext: cleanText,
    ciphertextHex,
    ivHex,
    authTagHex,
    keyFragment: generateKeyFragment(),
    ttlSeconds: params.ttlSeconds,
    vaultExpiryLabel: params.vaultExpiryLabel,
    readQuota: params.readQuota,
    passphrasePin: params.passphrasePin || '',
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    entropyBits: totalBits,
    shannonPerChar,
    sha256Fingerprint,
  };
}

// Generate live scrambling ciphertext glyph equivalent for a given character
const CIPHER_GLYPHS = '0123456789ABCDEF#@%&*+=?><~^ΔΩΨΣΦ§±¤';

export function scrambleChar(original: string, tick: number, index: number): string {
  if (original === '\n' || original === ' ') return original;
  const code = (original.charCodeAt(0) * 31 + index * 17 + tick * 7) % CIPHER_GLYPHS.length;
  return CIPHER_GLYPHS[Math.abs(code)];
}
