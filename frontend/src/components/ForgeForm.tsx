import { useState } from 'react';
import { SecretCapsule } from '../utils/cryptoEngine';
import { encrypt, generateKey, exportKey, generateShareableUrl } from '../utils/otsCrypto';
import { useMorphWidth } from '../utils/useMorphWidth';
import { createSecret } from '../utils/otsApi';
import { soundEngine } from '../utils/soundEngine';

interface ForgeFormProps {
  onSeal: (capsule: SecretCapsule, shareUrl: string) => void;
  onCancel: () => void;
}

const EXPIRY_OPTIONS = [
  { value: 900, label: '15 MIN' },
  { value: 3600, label: '1 HOUR' },
  { value: 21600, label: '6 HOURS' },
  { value: 86400, label: '24 HOURS' },
  { value: 172800, label: '48 HOURS' },
];

// Persistent inline form — not a modal. Nothing to misclick away,
// typed text never cleared except by an explicit successful seal.
export function ForgeForm({ onSeal, onCancel }: ForgeFormProps) {
  const [value, setValue] = useState('');
  const [expiry, setExpiry] = useState(3600);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sealMorph = useMorphWidth<HTMLButtonElement>(busy);

  const sealReal = async () => {
    const clean = value.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    try {
      // 1. client-side AES-256-GCM — key never leaves browser
      const key = await generateKey();
      const { ciphertext, iv } = await encrypt(clean, key);
      const keyB64 = await exportKey(key);
      // 2. store ciphertext only
      const { id } = await createSecret({
        ciphertext,
        iv,
        expires_in: expiry,
        burn_after_read: true,
      });
      const url = generateShareableUrl(id, keyB64);
      soundEngine.playCapsuleForged();
      // Display capsule for the just-sealed secret (plaintext in memory only)
      const { forgeSecretCapsule } = await import('../utils/cryptoEngine');
      const caps = forgeSecretCapsule({
        title: 'SEALED PAYLOAD',
        secretType: 'PASSWORD',
        plaintext: clean,
        ttlSeconds: 25,
        vaultExpiryLabel: EXPIRY_OPTIONS.find((o) => o.value === expiry)?.label || '1 HOUR',
        readQuota: '1_READ_BURN',
      });
      caps.id = `OTS-${id.slice(0, 6).toUpperCase()}-${id.slice(-3).toUpperCase()}`;
      onSeal(caps, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seal failed — is the backend running?');
      setBusy(false);
    }
    // Success path deliberately leaves busy=true: the form stays grayed
    // through the exit transition into the sealed screen. Unmount on close
    // discards the state, so the next open starts fresh.
  };

  return (
    <div className={`w-[min(680px,90vw)] space-y-8 hud-fade transition-opacity ${busy ? 'opacity-70' : ''}`} aria-busy={busy}>
      <p className="text-center font-mono-tabular text-[10px] tracking-[0.34em] text-[#777C88] uppercase">
        forge capsule — zero-knowledge
      </p>

      <div className="space-y-3">
        <textarea
          autoFocus
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sealReal();
          }}
          placeholder="paste or type the secret — as long as you need"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          rows={7}
          maxLength={32768}
          className="w-full min-h-[180px] max-h-[40vh] overflow-y-auto resize-none bg-black/40 rounded-xl border border-[#2E323B] focus:border-[#FF4D15] outline-none px-5 py-4 text-left font-mono-tabular text-[15px] leading-relaxed text-[#EDEAE4] placeholder-[#2E323B] transition-colors whitespace-pre-wrap break-words smooth-scroll disabled:opacity-50 disabled:cursor-wait"
        />
        <div className="flex items-center justify-between font-mono-tabular text-[9px] tracking-[0.24em] uppercase">
          <span className="text-[#3E424D]">length</span>
          <span className={value ? 'text-[#10E88A]' : 'text-[#3E424D]'}>
            {value ? `${value.length} chars` : 'awaiting payload'}
          </span>
        </div>
        <p className="font-mono-tabular text-[8px] tracking-[0.24em] text-[#3E424D] uppercase text-center">
          ctrl + enter to seal
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        {EXPIRY_OPTIONS.map((o) => (
          <button
            key={o.value}
            data-hot
            onClick={() => setExpiry(o.value)}
            disabled={busy}
            className={`px-3 py-1.5 rounded-full border font-mono-tabular text-[9px] tracking-[0.2em] uppercase transition-colors disabled:opacity-40 ${expiry === o.value ? 'border-[#FF4D15] text-[#EDEAE4]' : 'border-[#2E323B] text-[#777C88] hover:text-[#EDEAE4]'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-center font-mono-tabular text-[10px] tracking-[0.2em] text-[#F43F5E] uppercase">{error}</p>
      )}

      <div className="flex items-center justify-center gap-3">
        <button
          data-hot
          ref={sealMorph}
          onClick={sealReal}
          disabled={!value.trim() || busy}
          className="px-10 py-3 rounded-full bg-[#FF4D15] text-[#0A0A0B] font-mono-tabular text-[11px] font-bold tracking-[0.26em] uppercase disabled:opacity-60 hover:bg-[#ff6230] transition-colors flex items-center justify-center gap-2.5 whitespace-nowrap"
        >
          {busy && (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-[#0A0A0B]/30 border-t-[#0A0A0B] animate-spin" />
          )}
          {busy ? 'sealing…' : 'seal it ↵'}
        </button>
        <button
          data-hot
          onClick={onCancel}
          disabled={busy}
          className="px-8 py-3 rounded-full border border-[#2E323B] text-[#777C88] hover:text-[#EDEAE4] font-mono-tabular text-[11px] tracking-[0.26em] uppercase transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
