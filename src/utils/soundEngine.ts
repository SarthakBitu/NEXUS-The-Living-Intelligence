// Procedural Web Audio API synthesizer & live microphone frequency analyzer

export interface AudioMetrics {
  level: number;
  bass: number;
  treble: number;
  bins: number[];
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public playPulse(freq = 220, duration = 0.22, gainVal = 0.06) {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playAwakenChord() {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [146.83, 220.0, 293.66, 440.0, 587.33]; // D3, A3, D4, A4, D5
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * 0.96, now + idx * 0.07);
      osc.frequency.exponentialRampToValueAtTime(freq, now + idx * 0.07 + 0.8);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.045, now + idx * 0.07 + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 2.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 2.3);
    });
  }

  public playErrorTone() {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(95, now + 0.32);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playSuccessChime() {
    if (!this.enabled) return;
    this.playPulse(523.25, 0.28, 0.045);
    setTimeout(() => this.playPulse(659.25, 0.35, 0.045), 90);
  }

  public playModeTransition(
    mode: 'orb' | 'galaxy' | 'brain' | 'neural' | 'consciousness' | 'quantum'
  ) {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (mode === 'orb') {
      // Warm organic living-orb resonant breath swell
      [110, 165].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, now);
        filter.frequency.exponentialRampToValueAtTime(920, now + 0.45);

        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f * 1.08, now);
        osc.frequency.exponentialRampToValueAtTime(f, now + 0.65);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.14);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.9);
      });
    } else if (mode === 'galaxy') {
      // Wide cosmic spiral sweep: ascending celestial arpeggio + airy filter rush
      const freqs = [196.0, 293.66, 392.0, 587.33, 783.99];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t = now + i * 0.065;
        osc.frequency.setValueAtTime(freq * 0.88, t);
        osc.frequency.exponentialRampToValueAtTime(freq, t + 0.42);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.038, t + 0.09);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 1.2);
      });
    } else if (mode === 'brain') {
      // Bio-electric synaptic ignition: rapid crystalline neuron bursts + fifth lock
      const sparks = [440, 660, 554.37, 880, 1108.73];
      sparks.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i % 2 === 0 ? 'triangle' : 'sine';
        const t = now + i * 0.055;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.036, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.26);
      });
    } else if (mode === 'neural') {
      // Spatial bifurcation: dual diverging frequency glide (exploded anatomy)
      [
        { start: 260, end: 520 },
        { start: 260, end: 130 },
      ].forEach(({ start, end }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(start, now);
        osc.frequency.exponentialRampToValueAtTime(end, now + 0.55);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.042, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.7);
      });
    } else if (mode === 'consciousness') {
      // Golden-ratio Fibonacci harmonic lattice resonance
      const fib = [144, 233, 377, 610];
      fib.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t = now + idx * 0.04;
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.linearRampToValueAtTime(f * 1.01, t + 1.2);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.03, t + 0.22);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 1.4);
      });
    } else if (mode === 'quantum') {
      // Discrete Planck-quantized FM harmonic steps + phase-lock ping
      const steps = [528, 792, 1056, 1584];
      steps.forEach((f, idx) => {
        const carrier = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        const outGain = ctx.createGain();
        const t = now + idx * 0.06;

        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(f, t);
        mod.type = 'sine';
        mod.frequency.setValueAtTime(f * 2.0, t);
        modGain.gain.setValueAtTime(140, t);
        modGain.gain.exponentialRampToValueAtTime(1, t + 0.22);

        outGain.gain.setValueAtTime(0.0001, t);
        outGain.gain.linearRampToValueAtTime(0.034, t + 0.012);
        outGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);

        mod.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(outGain);
        outGain.connect(ctx.destination);

        mod.start(t);
        carrier.start(t);
        mod.stop(t + 0.36);
        carrier.stop(t + 0.36);
      });
    }
  }

  public async startMicrophone(): Promise<boolean> {
    try {
      const ctx = this.ensureContext();
      if (!ctx || !navigator.mediaDevices?.getUserMedia) return false;
      if (this.micStream) return true;

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micSource = ctx.createMediaStreamSource(this.micStream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.78;
      this.micSource.connect(this.analyser);

      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
      return true;
    } catch {
      return false;
    }
  }

  public stopMicrophone() {
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.analyser = null;
    this.freqData = null;
    this.timeData = null;
  }

  public getMicrophoneMetrics(): AudioMetrics {
    if (!this.analyser || !this.freqData) {
      return { level: 0, bass: 0, treble: 0, bins: [] };
    }
    this.analyser.getByteFrequencyData(this.freqData);

    const len = this.freqData.length;
    let total = 0;
    let bass = 0;
    let treble = 0;
    const bassEnd = Math.max(1, Math.floor(len * 0.25));
    const trebleStart = Math.floor(len * 0.55);

    const bins: number[] = [];
    for (let i = 0; i < len; i++) {
      const val = this.freqData[i] / 255;
      total += val;
      if (i < bassEnd) bass += val;
      if (i >= trebleStart) treble += val;
      if (i < 24) bins.push(val);
    }

    return {
      level: Math.min(1, (total / len) * 2.2),
      bass: Math.min(1, (bass / bassEnd) * 1.8),
      treble: Math.min(1, (treble / Math.max(1, len - trebleStart)) * 2.4),
      bins,
    };
  }
}

export const soundEngine = new SoundEngine();
