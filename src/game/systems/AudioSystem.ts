export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Ambient
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;

  // Chase
  private chaseOsc1: OscillatorNode | null = null;
  private chaseOsc2: OscillatorNode | null = null;
  private chaseGain: GainNode | null = null;
  private chaseActive = false;

  // Torch
  private torchNoiseSource: AudioBufferSourceNode | null = null;
  private torchGain: GainNode | null = null;

  // Footstep
  private footstepCounter = 0;

  private initialized = false;

  init() {
    if (this.initialized) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
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

  startChaseMusic() {
    if (!this.ctx || !this.masterGain || this.chaseActive) return;
    this.chaseActive = true;

    this.chaseGain = this.ctx.createGain();
    this.chaseGain.gain.value = 0.12;

    this.chaseOsc1 = this.ctx.createOscillator();
    this.chaseOsc1.type = 'sawtooth';
    this.chaseOsc1.frequency.value = 100;

    this.chaseOsc2 = this.ctx.createOscillator();
    this.chaseOsc2.type = 'sawtooth';
    this.chaseOsc2.frequency.value = 103;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    this.chaseOsc1.connect(filter);
    this.chaseOsc2.connect(filter);
    filter.connect(this.chaseGain);
    this.chaseGain.connect(this.masterGain);

    this.chaseOsc1.start();
    this.chaseOsc2.start();
  }

  stopChaseMusic() {
    if (!this.chaseActive) return;
    this.chaseActive = false;

    this.chaseOsc1?.stop();
    this.chaseOsc2?.stop();
    this.chaseOsc1 = null;
    this.chaseOsc2 = null;
    this.chaseGain = null;
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

  destroy() {
    this.stopChaseMusic();
    this.torchNoiseSource?.stop();
    this.ambientSource?.stop();
    this.ctx?.close();
    this.initialized = false;
  }
}
