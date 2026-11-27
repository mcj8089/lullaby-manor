/**
 * Art + audio manifest.
 * Every runtime asset is referenced through here so the single-file build can
 * swap each path for an inlined data URI (window.__ASSETS__).
 */
export const IMAGES = {
  keyartWide: "assets/images/keyart-wide.jpg",
  keyart: "assets/images/keyart.jpg",
  dreamNursery: "assets/images/dream-nursery.jpg",
  dreamStudy: "assets/images/dream-study.jpg",
  dreamGarden: "assets/images/dream-garden.jpg",
  dreamAttic: "assets/images/dream-attic.jpg",
  dreamGallery: "assets/images/dream-gallery.jpg",
  dreamWeaver: "assets/images/dream-weaver.jpg",
  portraitOllie: "assets/images/portrait-ollie.jpg",
  portraitTheo: "assets/images/portrait-theo.jpg",
  portraitClara: "assets/images/portrait-clara.jpg",
  portraitBiscuit: "assets/images/portrait-biscuit.jpg",
  portraitJune: "assets/images/portrait-june.jpg",
  portraitWeaver: "assets/images/portrait-weaver.jpg",
  emblem: "assets/images/emblem.png"
};

export const AUDIO = {
  ui: "assets/audio/sfx-ui.wav",
  collect: "assets/audio/sfx-collect.wav",
  bell: "assets/audio/sfx-bell.wav",
  hurt: "assets/audio/sfx-hurt.wav",
  splash: "assets/audio/sfx-splash.wav",
  bark: "assets/audio/sfx-bark.wav",
  bone: "assets/audio/sfx-bone.wav",
  gear: "assets/audio/sfx-gear.wav",
  tick: "assets/audio/sfx-tick.wav",
  mirror: "assets/audio/sfx-mirror.wav",
  swap: "assets/audio/sfx-swap.wav",
  power: "assets/audio/sfx-power.wav",
  revive: "assets/audio/sfx-revive.wav",
  win: "assets/audio/sfx-win.wav",
  lose: "assets/audio/sfx-lose.wav",
  bgmMenu: "assets/audio/bgm-menu.wav",
  bgmDream: "assets/audio/bgm-dream.wav",
  bgmBoss: "assets/audio/bgm-boss.wav",
  bgmEnding: "assets/audio/bgm-ending.wav"
};

function assetUrl(path) {
  const inline = typeof window !== "undefined" && window.__ASSETS__;
  if (inline && inline[path]) return inline[path];
  return path;
}

export class Assets {
  constructor() {
    this.images = {};
    this.urls = {};
    this.loaded = { images: 0, audio: 0 };
    this.total = { images: Object.keys(IMAGES).length, audio: Object.keys(AUDIO).length };
  }

  url(key) {
    const path = IMAGES[key] || AUDIO[key] || key;
    return assetUrl(path);
  }

  audioUrl(key) {
    return assetUrl(AUDIO[key]);
  }

  get(key) {
    return this.images[key] || null;
  }

  loadImages(onProgress) {
    const entries = Object.entries(IMAGES);
    let done = 0;
    return Promise.all(
      entries.map(
        ([key, path]) =>
          new Promise((resolve) => {
            const img = new Image();
            img.decoding = "async";
            img.onload = () => {
              this.images[key] = img;
              this.urls[key] = assetUrl(path);
              done += 1;
              this.loaded.images = done;
              if (onProgress) onProgress(done / entries.length, key);
              resolve(img);
            };
            img.onerror = () => {
              console.warn("[Assets] image failed:", path);
              done += 1;
              this.loaded.images = done;
              if (onProgress) onProgress(done / entries.length, key);
              resolve(null);
            };
            img.src = assetUrl(path);
          })
      )
    );
  }

  audioMap() {
    const out = {};
    for (const key of Object.keys(AUDIO)) out[key] = assetUrl(AUDIO[key]);
    return out;
  }

  applyBackground(el, key) {
    const url = this.urls[key] || this.url(key);
    if (el && url) el.style.backgroundImage = 'url("' + url + '")';
  }

  applyImg(img, key) {
    if (!img || !IMAGES[key]) return;
    img.src = this.url(key);
    img.alt = img.alt || "";
  }
}
