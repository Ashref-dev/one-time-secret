import { useMemo, type CSSProperties } from 'react';
import { SecretCapsule } from '../utils/cryptoEngine';

// Deterministic pseudo-random per index so the scatter is stable per mount.
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Burning view: the box border dissolves first and fast, then every letter
// scatters off in a random direction while blurring out — synced with the
// ember canvas hit behind it.
export function BurnView({ capsule }: { capsule: SecretCapsule }) {
  const text = capsule.plaintext;
  const long = text.length > 140;

  const chars = useMemo(
    () =>
      Array.from(text).map((ch, i) => ({
        ch,
        dx: `${((rand(i + 1) - 0.5) * 64).toFixed(1)}px`,
        dy: `${(-(rand(i + 1001) * 52 + 8)).toFixed(1)}px`,
        rot: `${((rand(i + 2001) - 0.5) * 48).toFixed(1)}deg`,
        delay: `${(rand(i + 3001) * 0.14).toFixed(3)}s`,
      })),
    [text]
  );

  const scattered = (
    <>
      {chars.map((c, i) => (
        <span
          key={i}
          className="burn-char"
          style={
            {
              '--dx': c.dx,
              '--dy': c.dy,
              '--rot': c.rot,
              animationDelay: c.delay,
            } as CSSProperties
          }
        >
          {c.ch}
        </span>
      ))}
    </>
  );

  if (long) {
    return (
      <div className="w-full rounded-xl border border-[#2E323B] bg-black/40 px-5 py-4 max-h-[38vh] overflow-hidden text-left burn-box">
        <p className="font-mono-tabular text-[15px] leading-relaxed text-[#EDEAE4] whitespace-pre-wrap break-words select-none">
          {scattered}
        </p>
      </div>
    );
  }

  return (
    <p
      className="text-center font-display font-bold text-[#EDEAE4] break-words select-none"
      style={{
        fontSize: text.length <= 60 ? 'clamp(30px, 5vw, 54px)' : 'clamp(20px, 3.4vw, 32px)',
        lineHeight: 1.25,
        letterSpacing: '0.02em',
        overflowWrap: 'anywhere',
        textShadow: '0 0 22px rgba(255,77,21,0.55)',
      }}
    >
      {scattered}
    </p>
  );
}
