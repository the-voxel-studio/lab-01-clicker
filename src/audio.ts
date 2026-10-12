// Web Audio API procedural sound engine: zero dependencies, 100% offline, 0 console errors
export class AudioManager {
  private ctx: AudioContext | null = null;
  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private isMusicPlaying: boolean = false;
  private isMuted: boolean = false;
  private musicIntervalId: number | null = null;
  private musicStep: number = 0;

  // Catchy Cyberpunk / Synthwave 16-step melody loop in F minor / Ab major
  private bassNotes: number[] = [
    174.61, 174.61, 174.61, 174.61, // F3
    130.81, 130.81, 130.81, 130.81, // C3
    155.56, 155.56, 155.56, 155.56, // Eb3
    116.54, 116.54, 130.81, 155.56  // Bb2 -> C3 -> Eb3
  ];

  private leadNotes: (number | null)[] = [
    349.23, null, 415.30, 523.25, // F4, Ab4, C5
    466.16, null, 415.30, null,   // Bb4, Ab4
    392.00, 415.30, 523.25, 622.25, // G4, Ab4, C5, Eb5
    523.25, null, 466.16, 415.30  // C5, Bb4, Ab4
  ];

  private getAudioContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        
        // Master gains
        this.musicGainNode = this.ctx.createGain();
        this.musicGainNode.gain.setValueAtTime(0.18, this.ctx.currentTime);
        this.musicGainNode.connect(this.ctx.destination);

        this.sfxGainNode = this.ctx.createGain();
        this.sfxGainNode.gain.setValueAtTime(0.25, this.ctx.currentTime);
        this.sfxGainNode.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playClickSound(): void {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx || !this.sfxGainNode) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.05);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // Ignore audio interruptions safely
    }
  }

  public playBuySound(): void {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx || !this.sfxGainNode) return;

    try {
      const now = ctx.currentTime;
      // 2-tone pleasant power-up chime
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(this.sfxGainNode);
      osc1.start(now);
      osc1.stop(now + 0.12);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.08); // G5
      gain2.gain.setValueAtTime(0.2, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc2.connect(gain2);
      gain2.connect(this.sfxGainNode);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.25);
    } catch {
      // Safe fallback
    }
  }

  public toggleMusic(): boolean {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    if (this.isMusicPlaying) {
      this.stopMusic();
      return false;
    } else {
      this.startMusic();
      return true;
    }
  }

  public startMusic(): void {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMusicPlaying) return;

    this.isMusicPlaying = true;
    const stepDurationMs = 210; // ~142 BPM synth pulse

    this.musicIntervalId = window.setInterval(() => {
      this.playSynthNoteStep();
    }, stepDurationMs);
  }

  public stopMusic(): void {
    if (this.musicIntervalId !== null) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
    this.isMusicPlaying = false;
  }

  private playSynthNoteStep(): void {
    if (!this.isMusicPlaying || this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx || !this.musicGainNode) return;

    const step = this.musicStep % 16;
    const now = ctx.currentTime;

    // Bass note
    const bassFreq = this.bassNotes[step];
    if (bassFreq) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(bassFreq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGainNode);

      osc.start(now);
      osc.stop(now + 0.19);
    }

    // Lead melody note
    const leadFreq = this.leadNotes[step];
    if (leadFreq) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(leadFreq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGainNode);

      osc.start(now);
      osc.stop(now + 0.17);
    }

    this.musicStep++;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.musicGainNode && this.sfxGainNode && this.ctx) {
      const targetGain = this.isMuted ? 0 : 0.18;
      const sfxGain = this.isMuted ? 0 : 0.25;
      this.musicGainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
      this.sfxGainNode.gain.setValueAtTime(sfxGain, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public isPlaying(): boolean {
    return this.isMusicPlaying;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}
