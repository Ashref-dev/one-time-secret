import { SecretCapsule } from '../utils/cryptoEngine';

// Burning view: the exact reader layout dissolving as one fiery block,
// synced with the ember canvas hit behind it. No re-layout, no resize —
// the same box and type sizes as the reader, so nothing can jump.
// Mobile keeps a single cheap opacity fade.
export function BurnView({ capsule }: { capsule: SecretCapsule }) {
  const text = capsule.plaintext;
  const long = text.length > 140;
  const mobile =
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches));

  if (mobile) {
    return (
      <div className="burn-simple w-full text-center">
        {long ? (
          <div className="w-full rounded-xl border border-[#2E323B] bg-black/40 px-5 py-4 max-h-[38vh] overflow-hidden text-left">
            <p className="font-mono-tabular text-[15px] leading-relaxed text-[#EDEAE4] whitespace-pre-wrap break-words select-none">
              {text}
            </p>
          </div>
        ) : (
          <p
            className="font-display font-bold text-[#EDEAE4] break-words select-none"
            style={{
              fontSize: text.length <= 60 ? 'clamp(30px, 5vw, 54px)' : 'clamp(20px, 3.4vw, 32px)',
              lineHeight: 1.25,
              letterSpacing: '0.02em',
              overflowWrap: 'anywhere',
            }}
          >
            {text}
          </p>
        )}
      </div>
    );
  }

  if (long) {
    return (
      <div className="burn-dissolve w-full rounded-xl border border-[#2E323B] bg-black/40 px-5 py-4 max-h-[38vh] overflow-hidden text-left">
        <p className="font-mono-tabular text-[15px] leading-relaxed text-[#EDEAE4] whitespace-pre-wrap break-words select-none">
          {text}
        </p>
      </div>
    );
  }

  return (
    <p
      className="burn-dissolve text-center font-display font-bold text-[#EDEAE4] break-words select-none"
      style={{
        fontSize: text.length <= 60 ? 'clamp(30px, 5vw, 54px)' : 'clamp(20px, 3.4vw, 32px)',
        lineHeight: 1.25,
        letterSpacing: '0.02em',
        overflowWrap: 'anywhere',
        textShadow: '0 0 22px rgba(255,77,21,0.55)',
      }}
    >
      {text}
    </p>
  );
}
