import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';

interface SealMedallionProps {
  capsuleId: string;
  title: string;
  fuseSeconds: number;
  onUnseal: () => void;
}

const HOLD_MS = 1500;

export function SealMedallion({ capsuleId, title, fuseSeconds, onUnseal }: SealMedallionProps) {
  const [progress, setProgress] = useState(0);
  const holdingRef = useRef(false);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stop = () => endHold();
    window.addEventListener('pointerup', stop);
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('touchend', stop);
      cancelAnimationFrame(rafRef.current);
      soundEngine.stopIgniteDrone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loop = (ts: number) => {
    if (!lastTsRef.current) lastTsRef.current = ts;
    const dt = Math.min(50, ts - lastTsRef.current);
    lastTsRef.current = ts;

    let p = progressRef.current;
    if (holdingRef.current) {
      p = Math.min(1, p + dt / HOLD_MS);
      soundEngine.updateIgniteDrone(p);
    } else {
      p = p * Math.pow(0.004, dt / 340);
      if (p < 0.003) p = 0;
    }
    progressRef.current = p;
    setProgress(p);

    // Tectonic shake as the seal nears fracture
    if (bodyRef.current && holdingRef.current && p > 0.35) {
      const amp = (p - 0.35) * 3.2;
      bodyRef.current.style.transform = `translate(${(Math.random() - 0.5) * amp}px, ${(Math.random() - 0.5) * amp}px)`;
    } else if (bodyRef.current) {
      bodyRef.current.style.transform = '';
    }

    if (p >= 1) {
      holdingRef.current = false;
      progressRef.current = 0;
      soundEngine.stopIgniteDrone();
      soundEngine.playVaultUnseal();
      onUnseal();
      return;
    }
    if (p > 0 || holdingRef.current) {
      rafRef.current = requestAnimationFrame(loop);
    }
  };

  const beginHold = () => {
    holdingRef.current = true;
    lastTsRef.current = 0;
    soundEngine.playDetent(1.4);
    soundEngine.startIgniteDrone();
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  };

  const endHold = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    soundEngine.stopIgniteDrone();
  };

  const S = 200;
  const C = S / 2;
  const arcR = 86;

  return (
    <div className="flex flex-col items-center gap-8 hud-fade select-none">
      {/* designation */}
      <div className="text-center space-y-1.5">
        <p className="font-mono-tabular text-[10px] tracking-[0.32em] text-[#777C88] uppercase">{title}</p>
        <p className="font-mono-tabular text-[11px] tracking-[0.2em] text-[#EDEAE4]">CAPSULE {capsuleId}</p>
      </div>

      {/* The seal */}
      <div
        data-hot
        onPointerDown={beginHold}
        className="relative touch-none"
        style={{ width: S, height: S }}
        title="Press and hold to break the seal"
      >
        {/* orbit inscription */}
        <svg className="absolute inset-0 spin-slower" width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
          <defs>
            <path id="orbitText" d={`M ${C} 26 a ${C - 26} ${C - 26} 0 1 1 -0.01 0`} />
          </defs>
          <text className="fill-[#3E424D] uppercase" style={{ fontSize: 8.5, letterSpacing: '0.34em', fontFamily: 'JetBrains Mono, monospace' }}>
            <textPath href="#orbitText">zero knowledge · single read · incinerated · zero knowledge · single read ·</textPath>
          </text>
        </svg>

        {/* ring stack */}
        <svg className="absolute inset-0" width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
          <circle cx={C} cy={C} r={arcR} fill="none" stroke="rgba(237,234,228,0.10)" strokeWidth="1" />
          <circle cx={C} cy={C} r={arcR - 7} fill="none" stroke="rgba(237,234,228,0.06)" strokeWidth="1" strokeDasharray="1 9" className="spin-rev" style={{ transformOrigin: 'center' }} />
          {/* ignition progress */}
          {progress > 0 && (
            <circle
              cx={C}
              cy={C}
              r={arcR}
              fill="none"
              stroke="#FF4D15"
              strokeWidth="2"
              pathLength={100}
              strokeDasharray="100 100"
              strokeDashoffset={100 - progress * 100}
              transform={`rotate(-90 ${C} ${C})`}
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(255,77,21,0.9))' }}
            />
          )}
          {/* fracture cheers */}
          <polyline
            points="100,38 94,64 106,82 92,104"
            fill="none"
            stroke="#EDEAE4"
            strokeWidth="1"
            opacity={Math.max(0, progress - 0.45) * 1.8}
          />
          <polyline
            points="52,152 78,128 88,140 108,118 104,162"
            fill="none"
            stroke="#EDEAE4"
            strokeWidth="1"
            opacity={Math.max(0, progress - 0.6) * 1.8}
          />
          <polyline
            points="150,60 132,88 140,96 128,124"
            fill="none"
            stroke="#EDEAE4"
            strokeWidth="1"
            opacity={Math.max(0, progress - 0.72) * 1.8}
          />
        </svg>

        {/* glass core */}
        <div
          ref={bodyRef}
          className="absolute rounded-full flex flex-col items-center justify-center gap-2"
          style={{
            inset: 34,
            background: `radial-gradient(circle at 32% 28%, #1D2028 0%, #0E0F13 62%, #08090B 100%)`,
            boxShadow: `inset 0 1px 0 rgba(237,234,228,0.14), 0 18px 50px rgba(0,0,0,0.75), 0 0 ${progress * 70}px rgba(255,77,21,${progress * 0.4})`,
          }}
        >
          <Lock size={20} strokeWidth={1.5} className="text-[#FF4D15]" style={{ filter: 'drop-shadow(0 0 8px rgba(255,77,21,0.7))' }} />
          <span className="font-mono-tabular text-[7.5px] tracking-[0.3em] text-[#3E424D]">SEALED</span>
        </div>
      </div>

      {/* instruction */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2.5">
          <span className="w-1 h-1 rounded-full bg-[#FF4D15]" style={{ animation: 'soft-pulse 2s ease-in-out infinite' }} />
          <p className="font-mono-tabular text-[10px] tracking-[0.34em] text-[#777C88] uppercase">
            press &amp; hold to break seal
          </p>
          <span className="w-1 h-1 rounded-full bg-[#FF4D15]" style={{ animation: 'soft-pulse 2s ease-in-out infinite' }} />
        </div>
        <p className="font-mono-tabular text-[9px] tracking-[0.26em] text-[#3E424D] uppercase">
          {fuseSeconds >= 3600
            ? `${Math.round(fuseSeconds / 3600)}h fuse · one read · no replays`
            : fuseSeconds >= 60
              ? `${Math.round(fuseSeconds / 60)} min fuse · one read · no replays`
              : `${fuseSeconds}s fuse · one read · no replays`}
        </p>
      </div>
    </div>
  );
}
