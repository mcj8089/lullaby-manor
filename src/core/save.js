import { GAME_CONFIG } from "../../config/game.config.js";
import { LEVELS } from "../../config/levels.js";

const MILESTONES = GAME_CONFIG.rescueMilestones;

function freshData() {
  return {
    v: 1,
    unlocked: 1,
    stars: {},
    best: {},
    muted: false,
    name: "",
    introSeen: false,
    endingSeen: false,
    healthNags: 0,
    plays: 0,
    wins: 0,
    lastLevel: 1,
    bonusGuards: 0
  };
}

function toInt(v, min, max, fallback) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export class SaveStore {
  constructor(sdk) {
    this.sdk = sdk || null;
    this.data = this._load();
    this._normalise();
  }

  _load() {
    try {
      const raw = localStorage.getItem(GAME_CONFIG.storageKey);
      if (!raw) return freshData();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return freshData();
      return Object.assign(freshData(), parsed);
    } catch (e) {
      console.warn("[Save] could not read", e);
      return freshData();
    }
  }

  _normalise() {
    const d = this.data;
    d.v = 1;
    d.unlocked = toInt(d.unlocked, 1, 16, 1);
    d.plays = toInt(d.plays, 0, 1e6, 0);
    d.wins = toInt(d.wins, 0, 1e6, 0);
    d.healthNags = toInt(d.healthNags, 0, 1e5, 0);
    d.lastLevel = toInt(d.lastLevel, 1, 16, 1);
    d.bonusGuards = toInt(d.bonusGuards, 0, 5, 0);
    d.name = String(d.name || "").slice(0, 16);
    d.muted = !!d.muted;
    d.introSeen = !!d.introSeen;
    d.endingSeen = !!d.endingSeen;
    d.stars = d.stars && typeof d.stars === "object" ? d.stars : {};
    d.best = d.best && typeof d.best === "object" ? d.best : {};
    for (const k of Object.keys(d.stars)) {
      const id = toInt(k, 1, 16, 0);
      if (!id) {
        delete d.stars[k];
        continue;
      }
      d.stars[id] = toInt(d.stars[k], 0, 3, 0);
    }
    for (const k of Object.keys(d.best)) {
      const id = toInt(k, 1, 16, 0);
      if (!id) {
        delete d.best[k];
        continue;
      }
      d.best[id] = toInt(d.best[k], 0, 1e9, 0);
    }
  }

  verify() {
    if (!this.sdk || !this.sdk.shield) return true;
    try {
      const r = this.sdk.shield.verify(this.data, "lullaby-manor");
      return !r || !r.tampered;
    } catch (e) {
      return true;
    }
  }

  write() {
    try {
      localStorage.setItem(GAME_CONFIG.storageKey, JSON.stringify(this.data));
      if (this.sdk && this.sdk.shield) this.sdk.shield.save(this.data, "lullaby-manor");
      return true;
    } catch (e) {
      console.warn("[Save] could not write", e);
      return false;
    }
  }

  get muted() {
    return !!this.data.muted;
  }

  get name() {
    return this.data.name || "";
  }

  get introSeen() {
    return !!this.data.introSeen;
  }

  get unlocked() {
    return this.data.unlocked;
  }

  get bonusGuards() {
    return this.data.bonusGuards || 0;
  }

  takeBonusGuards() {
    const n = this.data.bonusGuards || 0;
    if (n) {
      this.data.bonusGuards = 0;
      this.write();
    }
    return n;
  }

  starsFor(levelId) {
    return toInt(this.data.stars[levelId], 0, 3, 0);
  }

  bestFor(levelId) {
    return toInt(this.data.best[levelId], 0, 1e9, 0);
  }

  isUnlocked(levelId) {
    return Number(levelId) <= this.data.unlocked;
  }

  get clearedCount() {
    return LEVELS.filter((l) => this.starsFor(l.id) > 0).length;
  }

  get totalStars() {
    return LEVELS.reduce((n, l) => n + this.starsFor(l.id), 0);
  }

  rescuedIds() {
    return Object.keys(MILESTONES)
      .filter((id) => this.starsFor(id) > 0)
      .map((id) => MILESTONES[id]);
  }

  rescuedCount() {
    return this.rescuedIds().length;
  }

  bossUnlocked() {
    return this.starsFor(15) > 0;
  }

  continueLevel() {
    for (const l of LEVELS) {
      if (!this.isUnlocked(l.id)) break;
      if (l.boss) {
        if (this.bossUnlocked() && this.starsFor(l.id) === 0) return l.id;
        break;
      }
      if (this.starsFor(l.id) === 0) return l.id;
    }
    return this.data.unlocked;
  }

  completeLevel({ id, stars, time }) {
    const before = this.starsFor(id);
    const firstClear = before === 0;
    const next = Math.max(before, toInt(stars, 0, 3, 0));
    this.data.stars[id] = next;
    const bestBefore = this.bestFor(id);
    const bestNow = bestBefore === 0 ? toInt(time, 0, 1e9, 0) : Math.min(bestBefore, toInt(time, 0, 1e9, 0));
    this.data.best[id] = bestNow;
    this.data.wins += 1;
    this.data.lastLevel = toInt(id, 1, 16, 1);
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(16, id + 1));
    const milestone = MILESTONES[id];
    const newlyRescued = milestone && firstClear ? milestone : null;
    this.write();
    return {
      firstClear,
      before,
      now: next,
      best: bestNow,
      newBest: bestBefore === 0 || toInt(time, 0, 1e9, 0) < bestBefore,
      newlyRescued
    };
  }

  recordStart(id) {
    this.data.plays += 1;
    this.data.lastLevel = toInt(id, 1, 16, 1);
    this.write();
  }

  setName(name) {
    this.data.name = String(name || "").trim().slice(0, 16);
    this.write();
  }

  setMuted(muted) {
    this.data.muted = !!muted;
    this.write();
  }

  markIntroSeen() {
    this.data.introSeen = true;
    this.write();
  }

  markEndingSeen() {
    this.data.endingSeen = true;
    this.write();
  }

  noteHealthNag() {
    this.data.healthNags += 1;
    this.write();
  }

  addBonusGuard() {
    this.data.bonusGuards = Math.min(5, (this.data.bonusGuards || 0) + 1);
    this.write();
    return this.data.bonusGuards;
  }

  reset() {
    this.data = freshData();
    this.write();
  }
}
