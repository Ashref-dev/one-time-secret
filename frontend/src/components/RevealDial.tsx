import { useEffect, useRef, useState } from 'react';
import { Copy, Flame, Check } from 'lucide-react';
import { SecretCapsule } from '../utils/cryptoEngine';
import { useMorphWidth } from '../utils/useMorphWidth';
import { soundEngine } from '../utils/soundEngine';

interface RevealDialProps {
  capsule: SecretCapsule;
  onBurn: () => void;      // manual burn / fuse timeout
}

// Functional reader: message-first, no gimmicks.
// Short payloads render big; long payloads get a scrollable box.
// Copy is repeatable and never burns; Burn destroys.
export function RevealDial({ capsule, onBurn }: RevealDialProps) {
  const text = capsule.plaintext;
  const total = capsule.ttlSeconds * 1000;

  const [remainingMs, setRemainingMs] = useState(total);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const copyMorph = useMorphWidth<HTMLButtonElement>(copiedFlash);

  const burnedRef = useRef(false);
  const burnRef = useRef(onBurn);
  burnRef.current = onBurn;
  const lastWholeRef = useRef(capsule.ttlSeconds);
  const flashTimer = useRef<number | null>(null);

  // ── fuse countdown → auto burn at zero ──
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const next = Math.max(0, total - (performance.now() - start));
      setRemainingMs(next);

      const whole = Math.ceil(next / 1000);
      if (whole !== lastWholeRef.current) {
        if (whole <= 5 && whole > 0) soundEngine.playDetent(0.8);
        lastWholeRef.current = whole;
      }
      if (next <= 0 && !burnedRef.current) {
        burnedRef.current = true;
        clearInterval(id);
        burnRef.current();
      }
    }, 33);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  // ── keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c') handleCopy();
      if (e.key.toLowerCase() === 'b') handleBurn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBurn = () => {
    if (burnedRef.current) return;
    burnedRef.current = true;
    soundEngine.playDetent(1.6);
    onBurn();
  };

  // Repeatable, never burns — spam it to feel safe.
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* clipboard unavailable */ }
    soundEngine.playDetent(1.5);
    setCopiedFlash(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      flashTimer.current = null;
      setCopiedFlash(false);
    }, 1500);
  };

  const frac = Math.max(0, remainingMs / total);
  const critical = remainingMs < 60000;
  const len = text.length;
  const long = len > 140;

  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = String(totalSec % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-7 w-[min(680px,92vw)]">
      {/* ─── fuse ─── */}
      <div className="w-full max-w-[420px] text-center space-y-2">
        <div className={`font-mono-tabular text-xl md:text-2xl tracking-[0.08em] ${critical ? 'text-[#F43F5E]' : 'text-[#EDEAE4]'}`}>
          T-{mm > 0 ? `${String(mm).padStart(2, '0')}:${ss}` : `${ss}`}
          {mm === 0 && (
            <span className="text-[#777C88] text-sm">.{String(Math.floor((remainingMs % 1000) / 10)).padStart(2, '0')}</span>
          )}
        </div>
        <div className="h-px w-full bg-[#2E323B] relative overflow-hidden rounded-full">
          <div
            className={`absolute left-0 top-0 h-full transition-[width] duration-100 ${critical ? 'bg-[#F43F5E]' : 'bg-[#FF4D15]'}`}
            style={{ width: `${frac * 100}%` }}
          />
        </div>
        <div className="font-mono-tabular text-[8px] tracking-[0.34em] text-[#3E424D] uppercase">
          seconds to incineration
        </div>
      </div>

      {/* ─── the message ─── */}
      {long ? (
        <div className="w-full rounded-xl border border-[#2E323B] bg-black/40 px-5 py-4 max-h-[38vh] overflow-y-auto smooth-scroll">
          <p className="font-mono-tabular text-[15px] leading-relaxed text-[#EDEAE4] whitespace-pre-wrap break-words select-text">
            {text}
          </p>
        </div>
      ) : (
        <p
          className="text-center font-display font-bold text-[#EDEAE4] break-words select-text"
          style={{
            fontSize: len <= 60 ? 'clamp(30px, 5vw, 54px)' : 'clamp(20px, 3.4vw, 32px)',
            lineHeight: 1.25,
            letterSpacing: '0.02em',
            overflowWrap: 'anywhere',
          }}
        >
          {text}
        </p>
      )}

      {/* ─── actions: copy never burns ─── */}
      <div className="flex items-center gap-3 hud-fade">
        <button
          data-hot
          ref={copyMorph}
          onClick={handleCopy}
          className="px-7 py-2.5 rounded-full border border-[#EDEAE4]/25 hover:border-[#10E88A] hover:text-[#10E88A] text-[#EDEAE4] font-mono-tabular text-[10.5px] tracking-[0.3em] uppercase flex items-center gap-2.5 transition-colors whitespace-nowrap"
        >
          {copiedFlash ? <Check size={12} strokeWidth={1.5} className="text-[#10E88A]" /> : <Copy size={12} strokeWidth={1.5} />}
          {copiedFlash ? 'copied' : 'copy'}
        </button>
        <button
          data-hot
          onClick={handleBurn}
          className="px-7 py-2.5 rounded-full font-mono-tabular text-[10.5px] tracking-[0.3em] uppercase text-[#777C88] hover:text-[#F43F5E] flex items-center gap-2.5 transition-colors whitespace-nowrap"
        >
          <Flame size={12} strokeWidth={1.5} />
          burn
        </button>
      </div>

      <p className="font-mono-tabular text-[8px] tracking-[0.3em] text-[#2E323B] uppercase -mt-3">
        [ c ] copy &nbsp;·&nbsp; [ b ] burn
      </p>
    </div>
  );
}
