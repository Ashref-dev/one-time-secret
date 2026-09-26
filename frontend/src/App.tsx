import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX, Plus, RotateCcw, Copy, Check } from 'lucide-react';
import { SecretCapsule } from './utils/cryptoEngine';
import { decrypt, parseKeyFromUrl } from './utils/otsCrypto';
import { fetchSecret, burnSecret } from './utils/otsApi';
import { soundEngine } from './utils/soundEngine';
import { SealMedallion } from './components/SealMedallion';
import { RevealDial } from './components/RevealDial';
import { EmberCanvas } from './components/EmberCanvas';
import { ForgeForm } from './components/ForgeForm';
import { BurnView } from './components/BurnView';
import { useMorphWidth } from './utils/useMorphWidth';

type Stage = 'empty' | 'sealed' | 'open' | 'burning' | 'ash' | 'loading' | 'error';

const STAGE_STATUS: Record<string, string> = {
  empty: 'AWAITING PAYLOAD',
  sealed: 'SEALED',
  open: 'X-RAY LIVE',
  burning: 'INCINERATING',
  ash: '410 GONE',
  loading: 'FETCHING…',
  error: 'NOT FOUND',
};

function getSecretIdFromPath(): string | null {
  const m = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Concurrent mounts (StrictMode dev double-mount) must share one GET,
// because GET atomically burns the secret server-side.
const inflightSecretFetch = new Map<string, Promise<string>>();

export function App() {
  const viewId = useMemo(() => getSecretIdFromPath(), []);
  const isViewMode = viewId !== null;

  // No demo capsule: landing shows an empty forge CTA until the user
  // seals something real. capsule is only set from backend-backed flows.
  const [capsule, setCapsule] = useState<SecretCapsule | null>(null);
  // Crossfade curtain: `stageRef` is the target, `shownStage` is what's on
  // screen. On change the old view fades out, then the new one fades in.
  const [shownStage, setShownStage] = useState<Stage>(isViewMode ? 'loading' : 'empty');
  const [stageLeaving, setStageLeaving] = useState(false);
  const [bareMount, setBareMount] = useState(false);
  const stageRef = useRef<Stage>(isViewMode ? 'loading' : 'empty');
  const stageTimer = useRef<number | null>(null);

  const gotoStage = useCallback((next: Stage, opts?: { instant?: boolean }) => {
    if (stageRef.current === next) return;
    stageRef.current = next;
    // Instant swap: no fade-out, no entrance fade — the new view takes over
    // mid-frame. Used for open→burning where the same text must ignite in
    // place instead of dipping to black and popping back.
    if (opts?.instant) {
      if (stageTimer.current) window.clearTimeout(stageTimer.current);
      stageTimer.current = null;
      setBareMount(true);
      setShownStage(next);
      setStageLeaving(false);
      return;
    }
    setBareMount(false);
    setStageLeaving(true);
    if (stageTimer.current) window.clearTimeout(stageTimer.current);
    stageTimer.current = window.setTimeout(() => {
      stageTimer.current = null;
      setShownStage(next);
      setStageLeaving(false);
    }, 180);
  }, []);

  useEffect(() => () => {
    if (stageTimer.current) window.clearTimeout(stageTimer.current);
  }, []);

  // Pre-warm the heavy backdrop blur once during boot (hidden behind the
  // app-enter fade) so the first modal open doesn't pay the raster cost.
  // Desktop only — on mobile GPUs the prewarm itself would be the hitch.
  useEffect(() => {
    if (
      window.innerWidth < 768 ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches)
    ) {
      return;
    }
    let idleHandle: number | null = null;
    let grainTimer: number | null = null;
    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(
        () => {
          idleHandle = null;
          setGrainOn(true);
        },
        { timeout: 1500 }
      );
    } else {
      grainTimer = window.setTimeout(() => {
        grainTimer = null;
        setGrainOn(true);
      }, 1200);
    }
    const t = window.setTimeout(() => {
      const veil = document.createElement('div');
      veil.style.cssText =
        'position:fixed;inset:0;pointer-events:none;opacity:0;z-index:0;' +
        'backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);';
      document.body.appendChild(veil);
      void veil.offsetHeight;
      window.setTimeout(() => veil.remove(), 900);
    }, 600);
    return () => {
      if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
      if (grainTimer !== null) window.clearTimeout(grainTimer);
      window.clearTimeout(t);
    };
  }, []);
  const [keyVersion, setKeyVersion] = useState(1);
  const [forgeOpen, setForgeOpen] = useState(false);
  const [forgeClosing, setForgeClosing] = useState(false);
  const forgeTimer = useRef<number | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [clock, setClock] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const copyMorph = useMorphWidth<HTMLButtonElement>(copiedLink);
  const [viewError, setViewError] = useState<string | null>(null);
  // Film grain texture is the heaviest background layer (turbulence raster
  // + full-page blend). Keep it off through boot/first paint, switch it on
  // once idle so it never hitches an interaction. (CSS hides it on mobile.)
  const [grainOn, setGrainOn] = useState(false);
  // Loader grace period: stays black and fades straight into the result
  // for fast loads; the spinner only appears if fetching exceeds 1s.
  const [showLoader, setShowLoader] = useState(false);

  // ── view mode: fetch + decrypt exactly once per link ──
  // GET burns the secret server-side, so two concurrent GETs (e.g. React
  // StrictMode double-mounting this effect in dev) would race: the first
  // 200 consumes the row, the second 404s. A module-level shared promise
  // dedupes concurrent mounts onto a SINGLE network request; every mount
  // awaits the same result. The entry is dropped once settled so revisiting
  // an already-burned link correctly re-fetches (and 404s).
  useEffect(() => {
    if (!isViewMode || !viewId) return;
    let cancelled = false;
    const loaderTimer = window.setTimeout(() => {
      if (!cancelled) setShowLoader(true);
    }, 1000);
    const settle = (next: Stage) => {
      window.clearTimeout(loaderTimer);
      gotoStage(next);
    };
    (async () => {
      try {
        const keyB64 = parseKeyFromUrl();
        if (!keyB64) {
          setViewError('Missing key — open the full link including #key.');
          settle('error');
          return;
        }
        let pending = inflightSecretFetch.get(viewId);
        if (!pending) {
          pending = (async () => {
            const data = await fetchSecret(viewId);
            const { importKey } = await import('./utils/otsCrypto');
            const key = await importKey(keyB64);
            return decrypt(data.ciphertext, data.iv, key);
          })();
          inflightSecretFetch.set(viewId, pending);
          pending.catch(() => {}).finally(() => {
            if (inflightSecretFetch.get(viewId) === pending) inflightSecretFetch.delete(viewId);
          });
        }
        const plaintext = await pending;
        if (cancelled) return;
        const { forgeSecretCapsule } = await import('./utils/cryptoEngine');
        const caps = forgeSecretCapsule({
          title: 'INCOMING PAYLOAD',
          secretType: 'PASSWORD',
          plaintext,
          ttlSeconds: 1800,
          vaultExpiryLabel: 'ONE READ',
          readQuota: '1_READ_BURN',
        });
        caps.id = `OTS-${viewId.slice(0, 6).toUpperCase()}-LIVE`;
        setCapsule(caps);
        settle('sealed');
      } catch (err) {
        if (cancelled) return;
        setViewError(err instanceof Error && err.message === 'GONE'
          ? 'This link was already burned or expired.'
          : err instanceof Error ? err.message : 'Fetch failed.');
        settle('error');
      }
    })();
    return () => { cancelled = true; window.clearTimeout(loaderTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const update = () => setClock(new Date().toISOString().slice(11, 19) + ' UTC');
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const isMobile = useMemo(
    () =>
      typeof window !== 'undefined' &&
      (window.innerWidth < 768 ||
        (typeof window.matchMedia === 'function' &&
          window.matchMedia('(pointer: coarse)').matches)),
    []
  );

  const motes = useMemo(
    () =>
      Array.from({ length: isMobile ? 6 : 14 }).map((_, i) => ({
        left: `${(i * 61.8 + 7) % 100}%`,
        top: `${(i * 37.4 + 15) % 100}%`,
        size: 1 + ((i * 7) % 3),
        d: 9 + ((i * 13) % 9),
        delay: -(i * 1.7),
        o: 0.12 + ((i * 11) % 10) * 0.025,
        x: `${((i * 29) % 24) - 12}px`,
      })),
    [isMobile]
  );

  const burn = useCallback(() => {
    if (stageRef.current !== 'open') return;
    soundEngine.playThermalIncineration();
    // Best-effort server burn (GET already consumed it; DELETE is idempotent)
    if (viewId) burnSecret(viewId);
    gotoStage('burning', { instant: true });
  }, [viewId, gotoStage]);

  const handleSettled = useCallback(() => gotoStage('ash'), [gotoStage]);
  const unseal = useCallback(() => gotoStage('open'), [gotoStage]);

  const reArm = useCallback(() => {
    soundEngine.playDetent(1.2);
    setKeyVersion((v) => v + 1);
    gotoStage('sealed');
  }, [gotoStage]);

  // Modal dismiss with exit animation: play forge-out, then unmount/advance.
  const dismissForge = useCallback((done: () => void) => {
    setForgeClosing(true);
    if (forgeTimer.current) window.clearTimeout(forgeTimer.current);
    forgeTimer.current = window.setTimeout(() => {
      forgeTimer.current = null;
      setForgeClosing(false);
      done();
    }, 200);
  }, []);

  useEffect(() => () => {
    if (forgeTimer.current) window.clearTimeout(forgeTimer.current);
  }, []);

  const sealNew = useCallback((caps: SecretCapsule, url: string) => {
    // Stage the result FIRST so the modal dissolves onto the sealed screen —
    // never onto the empty menu. Then dismiss the modal over the top.
    setCapsule(caps);
    setShareUrl(url);
    setCopiedLink(false);
    setKeyVersion((v) => v + 1);
    gotoStage('sealed');
    dismissForge(() => setForgeOpen(false));
  }, [dismissForge, gotoStage]);

  const closeForge = useCallback(() => {
    soundEngine.playDetent(0.9);
    dismissForge(() => setForgeOpen(false));
  }, [dismissForge]);

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch { /* ignore */ }
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundEngine.enabled = next;
    if (next) soundEngine.playDetent(1.2);
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#0A0A0B] text-[#EDEAE4] select-none app-enter">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 90% 60% at 50% 118%, rgba(255,77,21,${shownStage === 'ash' ? 0.05 : 0.10}) 0%, transparent 60%),
                         radial-gradient(ellipse 60% 40% at 50% -8%, rgba(16,232,138,0.035) 0%, transparent 60%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(237,234,228,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(237,234,228,0.022) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 78%)',
          }}
        />
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 180px rgba(0,0,0,0.9)' }} />
        {motes.map((m, i) => (
          <span
            key={i}
            className="dust-mote absolute rounded-full bg-[#EDEAE4]"
            style={{
              left: m.left,
              top: m.top,
              width: m.size,
              height: m.size,
              ['--mote-d' as string]: `${m.d}s`,
              ['--mote-delay' as string]: `${m.delay}s`,
              ['--mote-o' as string]: m.o,
              ['--mote-x' as string]: m.x,
            }}
          />
        ))}
      </div>

      <header className="absolute top-0 inset-x-0 z-40 flex items-start justify-end px-6 md:px-10 pt-6 md:pt-8 hud-fade">
        <div className="flex items-center gap-5">
          <div className="text-right leading-tight hidden sm:block">
            <div className={`font-mono-tabular text-[10px] tracking-[0.3em] ${shownStage === 'open' ? 'text-[#10E88A]' : shownStage === 'burning' ? 'text-[#F43F5E]' : 'text-[#777C88]'}`}>
              {STAGE_STATUS[shownStage]}
            </div>
            <div className="font-mono-tabular text-[8px] tracking-[0.28em] text-[#3E424D] mt-0.5">{capsule ? capsule.id : 'NO CAPSULE'}</div>
          </div>
          <button
            data-hot
            onClick={toggleSound}
            className="text-[#777C88] hover:text-[#EDEAE4] transition-colors"
            title={soundOn ? 'Mute synth' : 'Arm synth'}
          >
            {soundOn ? <Volume2 size={15} strokeWidth={1.5} /> : <VolumeX size={15} strokeWidth={1.5} />}
          </button>
        </div>
      </header>

      <footer className="absolute bottom-0 inset-x-0 z-40 flex items-end justify-start px-6 md:px-10 pb-6 md:pb-8 hud-fade">
        <div className="font-mono-tabular text-[9px] tracking-[0.24em] text-[#3E424D] uppercase leading-relaxed">
          36.8065°N 10.1815°E — Tunis, Tunisia
          <br />
          <span className="text-[#777C88]">{clock}</span>
        </div>
      </footer>

      <main className="absolute inset-0 z-10 flex items-center justify-center px-4">
      <div key={shownStage} className={`stage-view ${stageLeaving ? 'leaving' : bareMount ? '' : 'entering'}`}>
        {(shownStage === 'loading') && showLoader && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-14 h-14 rounded-full border border-[#2E323B] border-t-[#FF4D15] animate-spin" />
            <p className="font-mono-tabular text-[10px] tracking-[0.3em] text-[#777C88] uppercase">fetching sealed capsule…</p>
          </div>
        )}
        {(shownStage === 'error') && (
          <div className="flex flex-col items-center gap-6 text-center max-w-md">
            <div className="w-20 h-20 rounded-full border border-[#F43F5E]/50 flex items-center justify-center">
              <span className="font-mono-tabular text-lg text-[#F43F5E]">404</span>
            </div>
            <div className="space-y-2">
              <p className="font-display font-bold text-2xl tracking-[0.06em]">Unrecoverable.</p>
              <p className="font-mono-tabular text-[10px] tracking-[0.24em] text-[#777C88] uppercase leading-relaxed">
                {viewError || 'Not found.'}
              </p>
            </div>
            <a href="/" className="px-7 py-2.5 rounded-full border border-[#EDEAE4]/25 hover:border-[#10E88A] hover:text-[#10E88A] font-mono-tabular text-[10.5px] tracking-[0.3em] uppercase transition-colors">
              forge your own
            </a>
          </div>
        )}
        {shownStage === 'empty' && !isViewMode && (
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="w-20 h-20 rounded-full border border-dashed border-[#3E424D] flex items-center justify-center hud-fade">
              <Plus size={20} strokeWidth={1.25} className="text-[#777C88]" />
            </div>
            <div className="space-y-2 hud-fade" style={{ animationDelay: '0.05s' }}>
              <p className="font-display font-bold text-2xl tracking-[0.06em] text-[#EDEAE4]">Nothing sealed.</p>
              <p className="font-mono-tabular text-[9px] tracking-[0.32em] text-[#3E424D] uppercase">
                forge a capsule — it lives for one read
              </p>
            </div>
            <button
              data-hot
              onClick={() => { soundEngine.playDetent(1.1); setForgeOpen(true); }}
              className="px-8 py-3 rounded-full bg-[#FF4D15] text-[#0A0A0B] font-mono-tabular text-[11px] font-bold tracking-[0.26em] uppercase flex items-center gap-2.5 hover:bg-[#ff6230] transition-colors hud-fade"
              style={{ animationDelay: '0.1s' }}
            >
              <Plus size={12} strokeWidth={1.5} />
              forge new capsule
            </button>
          </div>
        )}
        {shownStage === 'sealed' && capsule && !isViewMode && (
          <div className="flex flex-col items-center gap-6 text-center max-w-[92vw]">
            <div className="w-16 h-16 rounded-full border border-[#10E88A] flex items-center justify-center hud-fade">
              <Check size={20} className="text-[#10E88A]" />
            </div>
            <div className="space-y-2 hud-fade" style={{ animationDelay: '0.05s' }}>
              <p className="font-display font-bold text-2xl tracking-[0.06em] text-[#EDEAE4]">Sealed.</p>
              <p className="font-mono-tabular text-[9px] tracking-[0.28em] text-[#3E424D] uppercase leading-relaxed">
                one read only — send the link, don't open it yourself
              </p>
            </div>
            {shareUrl && (
              <div className="flex items-center gap-2 max-w-[92vw] hud-fade" style={{ animationDelay: '0.1s' }}>
                <input
                  readOnly
                  value={shareUrl}
                  spellCheck={false}
                  autoComplete="off"
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  title={shareUrl}
                  aria-label="Share link — click to select, copy the full text"
                  className="font-mono-tabular text-[10px] text-[#10E88A] border border-[#2E323B] rounded-full px-4 py-2 bg-black/40 max-w-[60vw] w-[420px] overflow-hidden text-ellipsis whitespace-nowrap outline-none focus:border-[#10E88A] cursor-text transition-colors"
                />
                <button
                  data-hot
                  ref={copyMorph}
                  onClick={copyShareLink}
                  className="px-4 py-2 rounded-full border border-[#2E323B] hover:border-[#10E88A] font-mono-tabular text-[10px] tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  {copiedLink ? <Check size={12} className="text-[#10E88A]" /> : <Copy size={12} />}
                  {copiedLink ? 'copied' : 'copy link'}
                </button>
              </div>
            )}
          </div>
        )}
        {shownStage === 'sealed' && capsule && isViewMode && (
          <div className="flex flex-col items-center gap-6">
            <SealMedallion
              key={`seal-${keyVersion}`}
              capsuleId={capsule.id.replace('OTS-', '')}
              title={capsule.title}
              fuseSeconds={capsule.ttlSeconds}
              onUnseal={unseal}
            />
          </div>
        )}
        {shownStage === 'open' && capsule && (
          <RevealDial
            key={`dial-${keyVersion}`}
            capsule={capsule}
            onBurn={burn}
          />
        )}
        {shownStage === 'burning' && capsule && (
          <div className="flex flex-col items-center w-[min(680px,92vw)]">
            <div className="w-full text-center">
              <BurnView key={`burn-${keyVersion}`} capsule={capsule} />
            </div>
          </div>
        )}
        {shownStage === 'ash' && (
          <div className="flex flex-col items-center gap-9 text-center">
            <div className="w-20 h-20 rounded-full border border-[#3E424D] flex items-center justify-center hud-fade" style={{ animationDelay: '0.03s' }}>
              <span className="font-mono-tabular text-lg text-[#777C88] tracking-[0.1em]">410</span>
            </div>
            <div className="space-y-2 hud-fade" style={{ animationDelay: '0.08s' }}>
              <p className="font-display font-bold text-2xl tracking-[0.06em] text-[#EDEAE4]">Gone.</p>
              <p className="font-mono-tabular text-[9px] tracking-[0.32em] text-[#3E424D] uppercase">
                burned on server — this link never works again
              </p>
            </div>
            <div className="flex items-center gap-3 hud-fade" style={{ animationDelay: '0.15s' }}>
              {!isViewMode ? (
                <>
                  <button
                    data-hot
                    onClick={reArm}
                    className="px-7 py-2.5 rounded-full border border-[#EDEAE4]/25 hover:border-[#10E88A] hover:text-[#10E88A] font-mono-tabular text-[10.5px] tracking-[0.3em] uppercase flex items-center gap-2.5 transition-colors"
                  >
                    <RotateCcw size={12} strokeWidth={1.5} />
                    replay capsule
                  </button>
                  <button
                    data-hot
                    onClick={() => { soundEngine.playDetent(1.1); setForgeOpen(true); }}
                    className="px-7 py-2.5 rounded-full font-mono-tabular text-[10.5px] tracking-[0.3em] uppercase text-[#777C88] hover:text-[#EDEAE4] flex items-center gap-2.5 transition-colors"
                  >
                    <Plus size={12} strokeWidth={1.5} />
                    forge new
                  </button>
                </>
              ) : (
                <a href="/" className="px-7 py-2.5 rounded-full border border-[#EDEAE4]/25 hover:border-[#10E88A] hover:text-[#10E88A] font-mono-tabular text-[10.5px] tracking-[0.3em] uppercase transition-colors">
                  forge your own
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      </main>

      <EmberCanvas active={shownStage === 'burning'} onSettled={handleSettled} />
      {forgeOpen && !isViewMode && (
        <div className={`fixed inset-0 z-[120] bg-[#0A0A0B]/85 backdrop-blur-2xl forge-veil flex items-center justify-center ${forgeClosing ? 'forge-exit' : 'forge-enter'}`}>
          <div className="w-[min(680px,90vw)] max-h-[92vh] overflow-y-auto smooth-scroll py-2">
            <ForgeForm onSeal={sealNew} onCancel={closeForge} />
          </div>
        </div>
      )}
      <div className="grain-overlay" style={{ visibility: grainOn ? 'visible' : 'hidden' }} />
    </div>
  );
}

export default App;
