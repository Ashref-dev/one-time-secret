// Precision tactile clicks — short filtered transients only.
// No swells, no drones, no arpeggios. Muted until the user opts in.

export class TacticalSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = false;

  // Shared 120ms noise buffer, created once to avoid first-click jank.
  private noiseBuf: AudioBuffer | null = null;

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.12);
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  // Single mechanical click: filtered noise snap + tiny body tick.
  private click(ctx: AudioContext, at: number, freq: number, gainPeak: number, dur = 0.03) {
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, at);
    bp.Q.setValueAtTime(9, at);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainPeak, at);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(at, Math.random() * 0.06);
    src.stop(at + dur + 0.02);
  }

  // UI tick — the default sound for taps and detents.
  public playDetent(pitchMultiplier: number = 1) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.click(ctx, now, 3400 * pitchMultiplier, 0.11, 0.025);
  }

  // Seal broken — one dry clack (two stacked clicks, no swell).
  public playVaultUnseal() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.click(ctx, now, 2100, 0.14, 0.035);
    this.click(ctx, now + 0.045, 4200, 0.09, 0.025);
  }

  // Forge confirmed — two crisp ticks.
  public playCapsuleForged() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.click(ctx, now, 3000, 0.12, 0.03);
    this.click(ctx, now + 0.07, 3800, 0.1, 0.03);
  }

  // Burn — brief dry crackle snap, no rising swell.
  public playThermalIncineration() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      this.click(ctx, now + i * 0.05, 1600 + Math.random() * 2400, 0.1, 0.03);
    }
  }

  // Seal-hold progress — intentionally silent (visual ring only).
  public startIgniteDrone() {}
  public updateIgniteDrone(_progress: number) {}
  public stopIgniteDrone() {}
}

export const soundEngine = new TacticalSoundEngine();
