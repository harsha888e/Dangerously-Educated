class SoundEffects {
  private ctx: AudioContext | null = null;
  private enabled = true;

  public setEnabled(value: boolean) {
    this.enabled = value;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') {
      return null;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.08,
    delay = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public click() {
    this.playTone(540, 0.05, 'triangle', 0.04);
  }

  public correct(streak = 1) {
    const semitoneBoost = Math.min(streak - 1, 6);
    const root = 523.25 * Math.pow(1.059463, semitoneBoost);
    this.playTone(root, 0.14, 'triangle', 0.08, 0);
    this.playTone(root * 1.25, 0.18, 'triangle', 0.08, 0.07);
    if (streak >= 3) {
      this.playTone(root * 1.5, 0.24, 'sine', 0.07, 0.14);
    }
  }

  public close() {
    this.playTone(440, 0.14, 'triangle', 0.07, 0);
    this.playTone(554.37, 0.18, 'triangle', 0.06, 0.08);
  }

  public wrong() {
    this.playTone(210, 0.18, 'sawtooth', 0.045, 0);
    this.playTone(155, 0.26, 'sawtooth', 0.045, 0.1);
  }

  public lifeline() {
    this.playTone(659.25, 0.09, 'sine', 0.06, 0);
    this.playTone(880, 0.14, 'sine', 0.06, 0.06);
  }

  public roundComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.22, 'triangle', 0.07, idx * 0.08);
    });
  }
}

export const soundFx = new SoundEffects();
