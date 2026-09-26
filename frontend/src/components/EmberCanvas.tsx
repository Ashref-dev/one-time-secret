import { useEffect, useRef } from 'react';

interface EmberCanvasProps {
  active: boolean;
  onSettled: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  seed: number;
  ember: boolean;
}

export function EmberCanvas({ active, onSettled }: EmberCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    doneRef.current = false;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = (canvas.width = window.innerWidth);
    const H = (canvas.height = window.innerHeight);
    const cx = W / 2;
    const cy = H / 2;

    // Pre-rendered glow sprite: shadowBlur forces an offscreen pass per
    // ember per frame, drawImage of a cached gradient does not.
    const glow = document.createElement('canvas');
    glow.width = 32;
    glow.height = 32;
    const gg = glow.getContext('2d');
    if (gg) {
      const grad = gg.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,140,70,1)');
      grad.addColorStop(0.35, 'rgba(255,77,21,0.55)');
      grad.addColorStop(1, 'rgba(255,77,21,0)');
      gg.fillStyle = grad;
      gg.fillRect(0, 0, 32, 32);
    }

    // Mobile GPUs choke on full-screen canvas + shadowBlur: cut particles
    // and drop the per-ember glow there. Same choreography, lighter load.
    const mobile =
      W < 768 ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches);
    const COUNT = mobile ? 130 : 420;
    const EMBERS = mobile ? 50 : 150;

    const emberColors = ['#FF4D15', '#FF6A1F', '#FFB800', '#FFD23F', '#EDEAE4'];
    const ashColors = ['#8A8F99', '#575B66', '#3A3E47', '#2E323B', '#1E2127'];

    const particles: Particle[] = [];
    for (let i = 0; i < COUNT; i++) {
      const ember = i < EMBERS;
      const r = Math.sqrt(Math.random()) * Math.min(320, W * 0.34);
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r * 0.8,
        vx: (Math.random() - 0.5) * (ember ? 2.4 : 1.2),
        vy: -(Math.random() * 3.4 + 0.8),
        size: ember ? Math.random() * 2.6 + 0.7 : Math.random() * 3.4 + 0.8,
        color: ember
          ? emberColors[Math.floor(Math.random() * emberColors.length)]
          : ashColors[Math.floor(Math.random() * ashColors.length)],
        alpha: 0.4 + Math.random() * 0.6,
        decay: ember ? 0.010 + Math.random() * 0.014 : 0.006 + Math.random() * 0.010,
        seed: Math.random() * 100,
        ember,
      });
    }

    let frame = 0;
    let raf = 0;

    const loop = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);

      // heat flash
      if (frame < 14) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.5);
        g.addColorStop(0, `rgba(255,110,40,${0.20 * (1 - frame / 14)})`);
        g.addColorStop(1, 'rgba(255,110,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      let alive = 0;
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        alive++;
        p.x += p.vx + Math.sin(frame * 0.05 + p.seed) * (p.ember ? 1.5 : 0.7);
        p.y += p.vy;
        p.vy -= p.ember ? 0.02 : 0.008;
        p.alpha -= p.decay;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        if (p.ember) {
          const s = p.size * 7;
          ctx.drawImage(glow, p.x - s / 2, p.y - s / 2, s, s);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size * 0.62);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size * 0.62);
        }
        ctx.restore();
      }

      if (alive > 0 && frame < 170) {
        raf = requestAnimationFrame(loop);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onSettled();
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, onSettled]);

  if (!active) return null;
  return <canvas ref={ref} className="fixed inset-0 z-[70] pointer-events-none" />;
}
