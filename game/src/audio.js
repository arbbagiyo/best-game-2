// Procedural sound: every effect is an oscillator envelope, the ambience a slow
// detuned pad. No audio files, no network. The context starts on the first gesture
// (browsers forbid sound before one) and everything degrades to silence when audio
// is unavailable.

export function createAudio() {
  let context = null;
  let master = null;
  let pad = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      startPad();
      return true;
    } catch {
      return false;
    }
  }

  function startPad() {
    const gain = context.createGain();
    gain.gain.value = 0.035;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const first = context.createOscillator();
    first.type = 'triangle';
    first.frequency.value = 82.4;
    const second = context.createOscillator();
    second.type = 'triangle';
    second.frequency.value = 123.5;
    second.detune.value = 6;
    const lfo = context.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    first.connect(filter);
    second.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    first.start();
    second.start();
    lfo.start();
    pad = gain;
  }

  function tone({ type = 'sine', from, to, duration, volume, delay = 0 }) {
    if (!context || muted) return;
    try {
      const start = context.currentTime + delay;
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, start);
      if (to !== undefined) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    } catch {
      // Sound must never break the game.
    }
  }

  function noise({ duration, volume, delay = 0, frequency = 900 }) {
    if (!context || muted) return;
    try {
      const start = context.currentTime + delay;
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    } catch {
      // Sound must never break the game.
    }
  }

  return {
    /** Call from any user gesture; safe to call every frame. */
    unlock() {
      ensure();
    },
    setMuted(next) {
      muted = next;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (pad) pad.gain.value = muted ? 0 : 0.035;
    },
    isMuted() {
      return muted;
    },
    attach() {
      tone({ type: 'triangle', from: 340, to: 720, duration: 0.09, volume: 0.25 });
      noise({ duration: 0.05, volume: 0.12, frequency: 2400 });
    },
    release() {
      tone({ type: 'sine', from: 520, to: 260, duration: 0.08, volume: 0.14 });
    },
    jump() {
      tone({ type: 'sine', from: 260, to: 480, duration: 0.12, volume: 0.18 });
    },
    land() {
      noise({ duration: 0.06, volume: 0.1, frequency: 500 });
    },
    orb() {
      tone({ type: 'sine', from: 880, to: 1320, duration: 0.14, volume: 0.22 });
      tone({ type: 'sine', from: 1320, to: 1760, duration: 0.16, volume: 0.16, delay: 0.05 });
    },
    checkpoint() {
      tone({ type: 'triangle', from: 520, to: 780, duration: 0.18, volume: 0.2 });
      tone({ type: 'triangle', from: 780, to: 1040, duration: 0.2, volume: 0.16, delay: 0.08 });
    },
    death() {
      tone({ type: 'sawtooth', from: 220, to: 50, duration: 0.3, volume: 0.22 });
      noise({ duration: 0.2, volume: 0.18, frequency: 700 });
    },
    win() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((note, index) => {
        tone({ type: 'triangle', from: note, duration: 0.28, volume: 0.2, delay: index * 0.09 });
      });
    },
    click() {
      tone({ type: 'sine', from: 700, to: 900, duration: 0.06, volume: 0.14 });
    },
  };
}
