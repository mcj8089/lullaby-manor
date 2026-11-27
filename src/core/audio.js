/**
 * WebAudio mixer for Lullaby Manor.
 *
 * Audio is decoded once during boot (the context may stay suspended until the
 * player presses Play), then every cue is a one-shot buffer source. Music
 * crossfades between the menu, stage and warden themes.
 */
export class AudioManager {
  constructor(config) {
    this.config = config;
    this.ctx = null;
    this.buffers = {};
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.current = null;
    this.currentName = "";
    this.pendingMusic = "";
    this.muted = false;
    this.ducked = false;
    this.paused = false;
    this.ready = false;
    this._unlocked = false;
    this._fadeToken = 0;
    this._resuming = false;
    this._lastPlay = {};
  }

  ensureContext() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      console.warn("[Audio] WebAudio unavailable");
      return null;
    }
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.config.musicVolume;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.config.sfxVolume;
      this.sfxBus.connect(this.master);
    } catch (e) {
      console.warn("[Audio] context failed", e);
      this.ctx = null;
    }
    return this.ctx;
  }

  async load(urls, onProgress) {
    const ctx = this.ensureContext();
    const entries = Object.entries(urls);
    if (!ctx) return;
    let done = 0;
    await Promise.all(
      entries.map(async ([name, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error("HTTP " + res.status);
          const raw = await res.arrayBuffer();
          const buffer = await new Promise((resolve, reject) => {
            const p = ctx.decodeAudioData(raw, resolve, reject);
            if (p && p.then) p.then(resolve, reject);
          });
          if (buffer) this.buffers[name] = buffer;
        } catch (e) {
          console.warn("[Audio] could not load", name, e && e.message);
        }
        done += 1;
        if (onProgress) onProgress(done / entries.length, name);
      })
    );
    this.ready = Object.keys(this.buffers).length > 0;
  }

  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this._unlocked = true;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (this.pendingMusic) {
      const track = this.pendingMusic;
      this.pendingMusic = "";
      this.playMusic(track);
    }
  }

  play(sfx, opts) {
    if (!this.ctx || this.muted || !this.ready) return null;
    const buffer = this.buffers[sfx];
    if (!buffer) return null;
    const o = opts || {};
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const rate = o.rate || (1 + (Math.random() - 0.5) * 0.07);
    source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = o.volume == null ? 1 : o.volume;
    if (o.pan != null && this.ctx.createStereoPanner) {
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, o.pan));
      source.connect(gain).connect(pan).connect(this.sfxBus);
    } else {
      source.connect(gain).connect(this.sfxBus);
    }
    source.start(now);
    this._lastPlay[sfx] = now;
    return source;
  }

  /** Play a cue at most every `ms` milliseconds (bubbles can burst together). */
  playThrottled(sfx, ms, opts) {
    const now = this.ctx ? this.ctx.currentTime : 0;
    const last = this._lastPlay[sfx] || -99;
    if (now - last < (ms || 40) / 1000) return null;
    return this.play(sfx, opts);
  }

  playMusic(name) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this._unlocked || ctx.state === "suspended") {
      this.pendingMusic = name;
      this.currentName = name;
      if (this._unlocked && !this._resuming) {
        this._resuming = true;
        ctx
          .resume()
          .then(() => {
            this._resuming = false;
            const track = this.pendingMusic;
            this.pendingMusic = "";
            if (track) this.playMusic(track);
          })
          .catch(() => {
            this._resuming = false;
          });
      }
      return;
    }
    if (this.currentName === name && this.current) return;
    if (!this.buffers[name]) {
      this.currentName = name;
      return;
    }
    const token = ++this._fadeToken;
    const old = this.current;
    if (old) {
      try {
        const g = old.gain.gain;
        g.cancelScheduledValues(ctx.currentTime);
        g.setValueAtTime(g.value, ctx.currentTime);
        g.linearRampToValueAtTime(0, ctx.currentTime + this.config.crossfade);
        setTimeout(() => {
          try {
            old.source.stop();
          } catch (e) {
            /* already stopped */
          }
        }, (this.config.crossfade + 0.1) * 1000);
      } catch (e) {
        /* ignore */
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = this.buffers[name];
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.musicBus);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + this.config.crossfade * 0.6);
    source.start(now);
    this.current = { source, gain, token };
    this.currentName = name;
  }

  stopMusic(fade) {
    const ctx = this.ctx;
    if (!ctx || !this.current) {
      this.currentName = "";
      return;
    }
    const old = this.current;
    this.current = null;
    this.currentName = "";
    try {
      const f = fade == null ? 0.5 : fade;
      old.gain.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.gain.setValueAtTime(old.gain.gain.value, ctx.currentTime);
      old.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + f);
      setTimeout(() => {
        try {
          old.source.stop();
        } catch (e) {
          /* already stopped */
        }
      }, (f + 0.1) * 1000);
    } catch (e) {
      /* ignore */
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : this.ducked ? 0 : 1, now + 0.12);
    }
  }

  /** Temporarily silence everything while an ad or the system pause is up. */
  setDucked(ducked) {
    this.ducked = !!ducked;
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(this.muted || this.ducked ? 0 : 1, now + 0.2);
    }
  }

  setPaused(paused) {
    this.paused = !!paused;
    if (this.musicBus && this.ctx) {
      const now = this.ctx.currentTime;
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, now);
      this.musicBus.gain.linearRampToValueAtTime(this.config.musicVolume * (this.paused ? 0.35 : 1), now + 0.3);
    }
  }
}
