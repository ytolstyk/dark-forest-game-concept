export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Ambient
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;

  // Leshen chase
  private chaseOsc: OscillatorNode | null = null;
  private chasePulseOsc: OscillatorNode | null = null;
  private chaseGain: GainNode | null = null;
  private chaseDistGain: GainNode | null = null;
  private chaseActive = false;

  // Regular enemy chase
  private regularChaseOsc: OscillatorNode | null = null;
  private regularChasePulseOsc: OscillatorNode | null = null;
  private regularChaseGain: GainNode | null = null;
  private regularChaseDistGain: GainNode | null = null;
  private regularChaseActive = false;

  // Torch
  private torchNoiseSource: AudioBufferSourceNode | null = null;
  private torchGain: GainNode | null = null;

  // Leshen growl
  private leshenGrowlOsc: OscillatorNode | null = null;
  private leshenGrowlLfo: OscillatorNode | null = null;
  private leshenGrowlGain: GainNode | null = null;
  private leshenGrowlActive = false;

  // Footstep
  private footstepCounter = 0;


  private initialized = false;

  init() {
    if (this.initialized) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6;
    this.masterGain.connect(this.ctx.destination);
    this.initialized = true;

    this.startAmbient();
  }

  private startAmbient() {
    if (!this.ctx || !this.masterGain) return;

    // Brown noise for ambient
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }

    this.ambientSource = this.ctx.createBufferSource();
    this.ambientSource.buffer = buffer;
    this.ambientSource.loop = true;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.15;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    this.ambientSource.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);
    this.ambientSource.start();
  }

  updateTorch(torchOn: boolean) {
    if (!this.ctx || !this.masterGain) return;

    if (torchOn && !this.torchNoiseSource) {
      // Torch crackle sound
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.95 ? 1 : 0.1);
      }

      this.torchNoiseSource = this.ctx.createBufferSource();
      this.torchNoiseSource.buffer = buffer;
      this.torchNoiseSource.loop = true;

      this.torchGain = this.ctx.createGain();
      this.torchGain.gain.value = 0.08;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 3000;
      bandpass.Q.value = 2;

      this.torchNoiseSource.connect(bandpass);
      bandpass.connect(this.torchGain);
      this.torchGain.connect(this.masterGain);
      this.torchNoiseSource.start();
    } else if (!torchOn && this.torchNoiseSource) {
      this.torchNoiseSource.stop();
      this.torchNoiseSource = null;
      this.torchGain = null;
    }
  }

  updateFootsteps(moving: boolean) {
    if (!this.ctx || !this.masterGain || !moving) {
      this.footstepCounter = 0;
      return;
    }

    this.footstepCounter++;
    if (this.footstepCounter % 15 === 0) {
      this.playFootstep();
    }
  }

  private playFootstep() {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.06;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  updateEnemyGrowl(closestEnemyDist: number, maxDist: number) {
    if (!this.ctx || !this.masterGain) return;

    // Simple growl when enemies are near - just modulate volume
    if (closestEnemyDist < maxDist) {
      // Could add persistent growl oscillator here; keeping it simple for now
    }
  }

  playLeshenDetectGrowl() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Deep guttural burst — low sawtooth with noise layer
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.08);
    gain.gain.linearRampToValueAtTime(0, now + 0.9);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.9);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 4;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.9);

    // Noise layer for texture
    const bufSize = Math.floor(this.ctx.sampleRate * 0.9);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.12, now + 0.08);
    noiseGain.gain.linearRampToValueAtTime(0, now + 0.9);

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 120;
    noiseFilter.Q.value = 2;

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSrc.start(now);
  }

  startLeshenGrowl() {
    if (!this.ctx || !this.masterGain || this.leshenGrowlActive) return;
    this.leshenGrowlActive = true;

    this.leshenGrowlGain = this.ctx.createGain();
    this.leshenGrowlGain.gain.value = 0.08;

    // Deep sub-bass growl
    this.leshenGrowlOsc = this.ctx.createOscillator();
    this.leshenGrowlOsc.type = 'sawtooth';
    this.leshenGrowlOsc.frequency.value = 48;

    // Slow LFO to make it pulse and breathe
    this.leshenGrowlLfo = this.ctx.createOscillator();
    this.leshenGrowlLfo.frequency.value = 2.5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 10;
    this.leshenGrowlLfo.connect(lfoGain);
    lfoGain.connect(this.leshenGrowlOsc.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;

    this.leshenGrowlOsc.connect(filter);
    filter.connect(this.leshenGrowlGain);
    this.leshenGrowlGain.connect(this.masterGain);

    this.leshenGrowlLfo.start();
    this.leshenGrowlOsc.start();
  }

  stopLeshenGrowl() {
    if (!this.leshenGrowlActive) return;
    this.leshenGrowlActive = false;
    this.leshenGrowlLfo?.stop();
    this.leshenGrowlOsc?.stop();
    this.leshenGrowlLfo = null;
    this.leshenGrowlOsc = null;
    this.leshenGrowlGain = null;
  }

  startChaseMusic() {
    if (!this.ctx || !this.masterGain || this.chaseActive) return;
    this.chaseActive = true;

    // Distance-controlled outer gain (starts silent; updateLeshenChaseVolume drives it)
    this.chaseDistGain = this.ctx.createGain();
    this.chaseDistGain.gain.value = 0;

    // Base gain
    this.chaseGain = this.ctx.createGain();
    this.chaseGain.gain.value = 0.18;

    // Deep pulse tone
    this.chaseOsc = this.ctx.createOscillator();
    this.chaseOsc.type = 'sawtooth';
    this.chaseOsc.frequency.value = 55;

    // Pulse LFO — modulates gain so the sound throbs
    this.chasePulseOsc = this.ctx.createOscillator();
    this.chasePulseOsc.type = 'sine';
    this.chasePulseOsc.frequency.value = 1.8; // throbs ~1.8 times per second

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.5; // pulse depth: gain swings 0 → 1

    // Bias the LFO output so gain stays positive (offset +0.5, amplitude 0.5 → range 0..1)
    const lfoOffset = this.ctx.createConstantSource();
    lfoOffset.offset.value = 0.5;

    const pulseGain = this.ctx.createGain();
    pulseGain.gain.value = 0; // driven by lfoOffset + lfoGain
    lfoOffset.connect(pulseGain.gain);
    this.chasePulseOsc.connect(lfoGain);
    lfoGain.connect(pulseGain.gain);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    this.chaseOsc.connect(filter);
    filter.connect(pulseGain);
    pulseGain.connect(this.chaseGain);
    this.chaseGain.connect(this.chaseDistGain);
    this.chaseDistGain.connect(this.masterGain);

    lfoOffset.start();
    this.chasePulseOsc.start();
    this.chaseOsc.start();
  }

  /** Call every frame while leshen is chasing. dist is pixels to leshen. */
  updateLeshenChaseVolume(dist: number) {
    if (!this.chaseDistGain || !this.ctx) return;
    const MAX_DIST = 600; // fully silent beyond this
    const MIN_DIST = 80;  // max volume within this
    const t = 1 - Math.min(1, Math.max(0, (dist - MIN_DIST) / (MAX_DIST - MIN_DIST)));
    this.chaseDistGain.gain.setTargetAtTime(t, this.ctx.currentTime, 0.15);
  }

  stopChaseMusic() {
    if (!this.chaseActive) return;
    this.chaseActive = false;

    this.chaseOsc?.stop();
    this.chasePulseOsc?.stop();
    this.chaseOsc = null;
    this.chasePulseOsc = null;
    this.chaseGain = null;
    this.chaseDistGain = null;
  }

  startRegularChaseSound() {
    if (!this.ctx || !this.masterGain || this.regularChaseActive) return;
    this.regularChaseActive = true;

    this.regularChaseDistGain = this.ctx.createGain();
    this.regularChaseDistGain.gain.value = 1;

    this.regularChaseGain = this.ctx.createGain();
    this.regularChaseGain.gain.value = 0.14;

    // Mid-range square wave — harsher, higher than the Leshen's deep sawtooth
    this.regularChaseOsc = this.ctx.createOscillator();
    this.regularChaseOsc.type = 'square';
    this.regularChaseOsc.frequency.value = 160;

    // Faster pulse LFO (4.5 Hz) — frantic vs Leshen's slow 1.8 Hz throb
    this.regularChasePulseOsc = this.ctx.createOscillator();
    this.regularChasePulseOsc.type = 'sine';
    this.regularChasePulseOsc.frequency.value = 4.5;

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.5;

    const lfoOffset = this.ctx.createConstantSource();
    lfoOffset.offset.value = 0.5;

    const pulseGain = this.ctx.createGain();
    pulseGain.gain.value = 0;
    lfoOffset.connect(pulseGain.gain);
    this.regularChasePulseOsc.connect(lfoGain);
    lfoGain.connect(pulseGain.gain);

    // Bandpass centred around 350 Hz — cuts lows so it sounds distinct from Leshen
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 350;
    filter.Q.value = 2.5;

    this.regularChaseOsc.connect(filter);
    filter.connect(pulseGain);
    pulseGain.connect(this.regularChaseGain);
    this.regularChaseGain.connect(this.regularChaseDistGain);
    this.regularChaseDistGain.connect(this.masterGain);

    lfoOffset.start();
    this.regularChasePulseOsc.start();
    this.regularChaseOsc.start();
  }

  updateRegularChaseVolume(dist: number) {
    if (!this.regularChaseDistGain || !this.ctx) return;
    const MAX_DIST = 500;
    const MIN_DIST = 60;
    const t = 1 - Math.min(1, Math.max(0, (dist - MIN_DIST) / (MAX_DIST - MIN_DIST)));
    this.regularChaseDistGain.gain.setTargetAtTime(t, this.ctx.currentTime, 0.15);
  }

  stopRegularChaseSound() {
    if (!this.regularChaseActive) return;
    this.regularChaseActive = false;

    this.regularChaseOsc?.stop();
    this.regularChasePulseOsc?.stop();
    this.regularChaseOsc = null;
    this.regularChasePulseOsc = null;
    this.regularChaseGain = null;
    this.regularChaseDistGain = null;
  }

  playCrowScatter() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 2–3 quick "caw" bursts
    const burstCount = 2 + Math.floor(Math.random() * 2);
    for (let b = 0; b < burstCount; b++) {
      const t = now + b * 0.18;

      // Noise layer for raspy crow texture
      const bufSize = Math.floor(this.ctx.sampleRate * 0.12);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = buf;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1400;
      noiseFilter.Q.value = 6;

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime(0.45, t + 0.015);
      noiseGain.gain.linearRampToValueAtTime(0, t + 0.12);

      noiseSrc.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noiseSrc.start(t);

      // Sawtooth oscillator for pitch/croak
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(360 + Math.random() * 80, t);
      osc.frequency.linearRampToValueAtTime(240, t + 0.12);

      const oscFilter = this.ctx.createBiquadFilter();
      oscFilter.type = 'bandpass';
      oscFilter.frequency.value = 900;
      oscFilter.Q.value = 3;

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0, t);
      oscGain.gain.linearRampToValueAtTime(0.3, t + 0.015);
      oscGain.gain.linearRampToValueAtTime(0, t + 0.12);

      osc.connect(oscFilter);
      oscFilter.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.14);
    }
  }

  playPickup() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.value = 0.15;
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playDeath() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 400;
    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.8);

    const gain = this.ctx.createGain();
    gain.gain.value = 0.2;
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.8);
  }

  playWin() {
    if (!this.ctx || !this.masterGain) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.ctx!.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.15, this.ctx!.currentTime + i * 0.15 + 0.05);
      gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + i * 0.15 + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(this.ctx!.currentTime + i * 0.15);
      osc.stop(this.ctx!.currentTime + i * 0.15 + 0.3);
    });
  }

  stopAll() {
    this.stopChaseMusic();
    this.stopRegularChaseSound();
    this.stopLeshenGrowl();
    if (this.torchNoiseSource) {
      this.torchNoiseSource.stop();
      this.torchNoiseSource = null;
      this.torchGain = null;
    }
    if (this.ambientSource) {
      this.ambientSource.stop();
      this.ambientSource = null;
      this.ambientGain = null;
    }
    this.footstepCounter = 0;
  }

  destroy() {
    this.stopAll();
    this.ctx?.close();
    this.initialized = false;
  }
}
