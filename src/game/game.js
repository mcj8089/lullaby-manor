import * as THREE from "three";
import { GAME_CONFIG } from "../../config/game.config.js";
import { CELL, DREAM_LEVELS, levelById } from "../../config/levels.js";
import {
  createObstacle,
  createExitDoor,
  createThornGate,
  createCreak,
  createMirror,
  createPendulum,
  pendulumAngle,
  disposeTree
} from "../art/props.js";
import { createWisp, createMemory } from "../art/jelly.js";
import { createEnemy } from "../art/enemy.js";
import { Swarm } from "./swarm.js";
import { Input } from "../core/input.js";
import { i18n } from "../core/i18n.js";

const P = GAME_CONFIG.player;
const BOSS_POS = new THREE.Vector3(0, 0, -2.6);
const TAU = Math.PI * 2;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerpAngle(a, b, k) {
  let d = ((b - a + Math.PI * 3) % TAU) - Math.PI;
  return a + d * k;
}

function cellToWorld(col, row) {
  return { x: (col - 5) * CELL, z: (row - 3.5) * CELL };
}

function dist2D(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

function pointRayDistance(px, pz, ox, oz, dx, dz) {
  const vx = px - ox;
  const vz = pz - oz;
  const t = Math.max(0, vx * dx + vz * dz);
  return Math.hypot(px - (ox + dx * t), pz - (oz + dz * t));
}

export class Game {
  constructor({ stage, ui, audio, save, ads, sdk }) {
    this.stage = stage;
    this.ui = ui;
    this.audio = audio;
    this.save = save;
    this.ads = ads;
    this.sdk = sdk || (typeof window !== "undefined" ? window.GameSDK : null);

    this.state = "boot";
    this.level = null;
    this.dream = "nursery";
    this.isBoss = false;
    this.accent = "#8fe3cf";

    this.player = null;
    this.playerPos = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.swarm = null;
    this.hearts = P.hearts;
    this.heartsLost = 0;
    this.invuln = 0;
    this.revived = false;
    this.bonusGuards = 0;
    this.blessingUsed = false;

    this.memories = [];
    this.collected = 0;
    this.door = null;
    this.doorOpen = false;
    this.colliders = [];
    this.enemies = [];
    this.gates = [];
    this.creaks = [];
    this.pendulums = [];
    this.decor = [];
    this.water = null;
    this.tide = 0;
    this.tidePhase = -Math.PI / 2;
    this.calm = 0;
    this.rippleT = 0;
    this.tickT = 0;

    this.elapsed = 0;
    this.abilityCooldown = 0;
    this.abilityMax = 0;
    this.history = [];
    this.historyT = 0;
    this.exitHintT = 0;
    this.hudT = 0;
    this.tutorialT = 0;
    this.tutorialShown = false;

    this.boss = null;
    this.pendingWin = false;
    this.transitioning = false;

    this.playSeconds = 0;
    this.healthAt = 45 * 60;
    this.nagging = false;
    this.blessingReady = false;
    this._freshRun = true;
    this._storyStart = false;
    this._adPrev = null;
    this._last = 0;

    this.input = new Input({
      onAbility: () => this.useAbility(),
      onPause: () => this.togglePause(),
      onMute: () => this.toggleMute(),
      onQuiet: (on) => this.ui.setQuiet?.(on)
    });
    this.input.bind();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "playing") this.pause();
    });
  }

  /* ------------------------------------------------------------- menu ---- */

  menuData() {
    const dreams = ["nursery", "study", "garden", "attic", "gallery"].map((id) => {
      const config = GAME_CONFIG.dreams[id];
      const levels = DREAM_LEVELS[id].map((levelId) => ({
        id: levelId,
        stars: this.save.starsFor(levelId),
        best: this.save.bestFor(levelId),
        unlocked: this.save.isUnlocked(levelId)
      }));
      return {
        id,
        family: config.family,
        ability: config.ability,
        enemy: config.enemy,
        levels,
        cleared: levels.every((l) => l.stars > 0),
        unlocked: levels.some((l) => l.unlocked)
      };
    });
    return {
      dreams,
      boss: {
        id: 16,
        unlocked: this.save.bossUnlocked(),
        stars: this.save.starsFor(16)
      },
      cleared: this.save.clearedCount,
      stars: this.save.totalStars,
      totalStars: 48,
      continueId: this.save.continueLevel(),
      finished: this.save.starsFor(16) > 0,
      rescued: this.save.rescuedIds(),
      bonusGuards: this.save.bonusGuards,
      name: this.save.name
    };
  }

  showMenu() {
    this.state = "menu";
    this.level = null;
    this.boss = null;
    this.player = null;
    this.swarm = null;
    this.colliders = [];
    this.enemies = [];
    this.memories = [];
    this.gates = [];
    this.creaks = [];
    this.pendulums = [];
    this.decor = [];
    this.water = null;
    this.door = null;
    this.dream = "nursery";
    this.isBoss = false;
    this.stage.showMenu("nursery");
    this.audio.setPaused(false);
    this.audio.setDucked(false);
    this.audio.playMusic("bgmMenu");
    this.input.setEnabled(false);
    this.input.reset();
    this.ui.setQuiet?.(false);
    this.ui.hideAllPanels?.();
    this.ui.showMenu?.(this.menuData());
    this.ui.hudVisible?.(false);
    this._freshRun = true;
    this.transitioning = false;
  }

  begin() {
    if (!this.save.introSeen) {
      this._storyStart = true;
      this.ui.showStory?.("intro");
      return;
    }
    this.startLevel(1);
  }

  openStory() {
    this._storyStart = false;
    this.ui.showStory?.("lore");
  }

  afterStory() {
    this.ui.hideStory?.();
    if (!this.save.introSeen) this.save.markIntroSeen();
    const start = this._storyStart;
    this._storyStart = false;
    if (start) this.startLevel(1);
  }

  continueGame() {
    this.startLevel(this.save.continueLevel());
  }

  startBoss() {
    this.startLevel(16);
  }

  /* ------------------------------------------------------------ build ---- */

  startLevel(id, opts = {}) {
    const level = levelById(id);
    if (!opts.force && !this.save.isUnlocked(level.id)) return false;
    if (this.transitioning && !opts.force) return false;
    const fromMenu = this.state === "menu" || this.state === "ending";
    this.state = "loading";
    this.ui.hideAllPanels?.();
    this.ui.hideLose?.();
    this.ui.hidePause?.();
    this.ui.hideBossIntro?.();
    this.audio.setPaused(false);
    this.audio.setDucked(false);

    if (this._freshRun || this.state === "menu" || fromMenu) {
      this.ads.resetRun();
      this._freshRun = false;
    }

    this.level = level;
    this.dream = level.dream;
    this.isBoss = !!level.boss;
    this.accent = (GAME_CONFIG.dreams[this.dream] || GAME_CONFIG.dreams.nursery).accent;
    this.memories = [];
    this.collected = 0;
    this.colliders = [];
    this.enemies = [];
    this.gates = [];
    this.creaks = [];
    this.pendulums = [];
    this.decor = [];
    this.boss = null;
    this.door = null;
    this.doorOpen = false;
    this.water = null;
    this.tidePhase = -Math.PI / 2;
    this.tide = 0;
    this.calm = 0;
    this.velocity.set(0, 0, 0);
    this.hearts = P.hearts;
    this.heartsLost = 0;
    this.invuln = 0;
    this.revived = false;
    this.bonusGuards = 0;
    this.blessingUsed = false;
    this.elapsed = 0;
    this.abilityCooldown = 0;
    this.abilityMax = 0;
    this.history = [];
    this.historyT = 0;
    this.exitHintT = 0;
    this.hudT = 0;
    this.tutorialT = this.isBoss ? 0 : 1.5;
    this.tutorialShown = false;
    this.pendingWin = false;
    this.transitioning = false;
    this.rippleT = 0;
    this.tickT = 0;
    this.input.reset();
    this.ui.setQuiet?.(false);
    this.abilityMax = this.isBoss ? 0 : GAME_CONFIG.ability[GAME_CONFIG.dreams[this.dream].ability].cooldown;

    if (this.isBoss) this._buildBoss();
    else this._buildRoom();

    this.save.recordStart(level.id);
    this.sdk?.trackStart?.({ level: level.id, dream: level.dream, boss: this.isBoss });
    this.sdk?.trackCustom?.("stage", { level: level.id, dream: level.dream });

    this.ui.showGame?.();
    this.ui.hudVisible?.(true);
    this.ui.setMuted?.(this.save.muted);
    this._hudNow();

    if (this.isBoss) {
      this.state = "bossintro";
      this.input.setEnabled(false);
      this.audio.playMusic("bgmBoss");
      this.ui.showBossIntro?.({ levelId: 16, phase: 1 });
    } else {
      this.state = "playing";
      this.input.setEnabled(true);
      this.audio.playMusic("bgmDream");
    }
    this._snapCamera();
    return true;
  }

  _buildRoom() {
    const level = this.level;
    const shell = this.stage.loadRoom(this.dream);
    this.world = this.stage.world;
    this.colliders = [];
    let spawn = { x: 0, z: 4 };
    let variant = 0;
    let gateCount = 0;

    for (let row = 0; row < level.map.length; row++) {
      const line = level.map[row];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        const p = cellToWorld(col, row);
        if (ch === "#") {
          const prop = createObstacle(this.dream, variant++, this.accent);
          prop.position.set(p.x, 0, p.z);
          this.world.add(prop);
          this.colliders.push({ x: p.x, z: p.z, r: prop.userData.colliderRadius || 0.64, dead: false });
        } else if (ch === "N") {
          const mesh = createMemory(this.dream);
          mesh.position.set(p.x, mesh.userData.baseY, p.z);
          this.world.add(mesh);
          this.memories.push({
            mesh,
            x: p.x,
            z: p.z,
            baseY: mesh.userData.baseY,
            phase: Math.random() * TAU,
            taken: false
          });
        } else if (ch === "P") {
          spawn = p;
        } else if (ch === "X") {
          const door = createExitDoor(this.dream, this.accent);
          door.position.set(p.x, 0, p.z);
          this.world.add(door);
          this.door = door;
        } else if (ch === "E") {
          this._spawnEnemy(GAME_CONFIG.dreams[this.dream].enemy, p.x, p.z);
        } else if (ch === "C") {
          const mesh = createCreak(this.accent);
          mesh.position.set(p.x, 0, p.z);
          this.world.add(mesh);
          this.creaks.push({ mesh, x: p.x, z: p.z, cooldown: 0 });
        } else if (ch === "G") {
          const mesh = createThornGate(this.accent);
          mesh.position.set(p.x, 0, p.z);
          this.world.add(mesh);
          const collider = { x: p.x, z: p.z, r: 0.66, dead: false };
          this.colliders.push(collider);
          this.gates.push({ mesh, x: p.x, z: p.z, collider, open: false, index: gateCount++ });
        } else if (ch === "M") {
          const mesh = createMirror(this.accent);
          mesh.position.set(p.x, 0, p.z);
          this.world.add(mesh);
          this.decor.push(mesh);
        } else if (ch === "S") {
          this._spawnEnemy("shadow", p.x, p.z, { single: true });
        } else if (ch === "^") {
          const mesh = createPendulum(this.accent);
          mesh.position.set(p.x, 0, p.z);
          this.world.add(mesh);
          this.pendulums.push(mesh);
        }
      }
    }

    this.playerPos.set(spawn.x, 0, spawn.z);
    this.player = createWisp();
    this.player.position.copy(this.playerPos);
    this.world.add(this.player);

    this.swarm = new Swarm(this.world);
    this.bonusGuards = this.save.takeBonusGuards();
    this.swarm.setMembers(this.save.rescuedIds(), this.bonusGuards);

    if (this.dream === "study") this._buildWater();
    if (this.door) {
      this.door.userData.setOpen(false);
      this.door.userData.update(0, 0);
    }
    void shell;
  }

  _buildWater() {
    const w = 11 * CELL - 1.3;
    const d = 8 * CELL - 1.3;
    const mat = new THREE.MeshStandardMaterial({
      color: "#163039",
      transparent: true,
      opacity: 0.45,
      roughness: 0.22,
      metalness: 0.5,
      emissive: new THREE.Color(this.accent),
      emissiveIntensity: 0.12,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.04;
    mesh.renderOrder = 1;
    this.world.add(mesh);
    this.water = { mesh, mat };
  }

  _buildBoss() {
    const arena = this.stage.loadBoss();
    this.world = this.stage.world;
    this.colliders = [];
    for (const pillar of arena.userData.pillars || []) {
      this.colliders.push({ x: pillar.x, z: pillar.z, r: pillar.r, dead: false });
    }

    this.playerPos.set(0, 0, 4.4);
    this.player = createWisp();
    this.player.position.copy(this.playerPos);
    this.player.rotation.y = Math.PI;
    this.world.add(this.player);

    this.swarm = new Swarm(this.world);
    this.bonusGuards = this.save.takeBonusGuards();
    this.swarm.setMembers(this.save.rescuedIds(), this.bonusGuards);

    const mesh = createEnemy("weaver", this.accent);
    mesh.position.copy(BOSS_POS);
    mesh.userData.setPhase(1);
    this.world.add(mesh);

    const cfg = GAME_CONFIG.boss;
    this.boss = {
      mesh,
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
      phase: 1,
      charge: 0,
      maxCharge: cfg.chargeCost,
      motes: [],
      flares: [],
      beams: [],
      geysers: [],
      dead: false,
      deathT: 0,
      deathFxT: 0,
      attackDelay: 2.4,
      beamT: 2.4,
      geyserT: 4.4,
      addT: 13,
      addCount: 0
    };
    for (let i = 0; i < cfg.maxMotes; i++) {
      const mote = createMemory("weaver");
      mote.scale.setScalar(1.15);
      this.world.add(mote);
      const entry = { mesh: mote, active: false, timer: 0, phase: Math.random() * TAU };
      this._placeMote(entry);
      entry.active = true;
      entry.mesh.visible = true;
      this.boss.motes.push(entry);
    }
    this.abilityMax = 0;
    this.audio.play("power", { volume: 0.5 });
  }

  /* ----------------------------------------------------------- enemies ---- */

  _spawnEnemy(kind, x, z, opts = {}) {
    const mesh = createEnemy(kind, this.accent);
    mesh.position.set(x, 0, z);
    this.world.add(mesh);
    const enemy = {
      kind,
      mesh,
      home: { x, z },
      pos: { x, z },
      dir: { x: 0, z: 1 },
      state: "idle",
      t: Math.random() * 0.6,
      wait: 0.5 + Math.random() * 1.4,
      stun: 0,
      stunWas: false,
      alert: 0,
      wander: null,
      wanderT: Math.random() * 2,
      phase: Math.random() * TAU,
      delay: opts.single ? 1.15 + Math.random() * 0.5 : 1.1,
      life: opts.life == null ? null : opts.life,
      bossAdd: !!opts.bossAdd,
      dead: false
    };
    this.enemies.push(enemy);
    return enemy;
  }

  _removeEnemy(enemy) {
    enemy.dead = true;
    if (enemy.mesh.parent) enemy.mesh.parent.remove(enemy.mesh);
    disposeTree(enemy.mesh);
  }

  _moveEnemy(e, tx, tz, speed, dt) {
    const dx = tx - e.pos.x;
    const dz = tz - e.pos.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.0001) return false;
    const nx = e.pos.x + (dx / len) * speed * dt;
    const nz = e.pos.z + (dz / len) * speed * dt;
    const p = this._pushCircle(nx, nz, 0.28, this.stage.bounds);
    e.pos.x = p.x;
    e.pos.z = p.z;
    e.dir.x = dx / len;
    e.dir.z = dz / len;
    return true;
  }

  _face(e, dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) > 0.001) {
      e.mesh.rotation.y = lerpAngle(e.mesh.rotation.y, Math.atan2(dx, dz), 0.16);
    }
  }

  _updateEnemies(dt, time) {
    const p = this.playerPos;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.life != null) {
        e.life -= dt;
        if (e.life <= 0) {
          this.stage.fx.burst(new THREE.Vector3(e.pos.x, 0.6, e.pos.z), this.accent, 18, { speed: 1.6, up: 0.8, life: 0.7 });
          this._removeEnemy(e);
          continue;
        }
      }
      e.stun = Math.max(0, e.stun - dt);
      const stunned = e.stun > 0;
      if (stunned !== e.stunWas) {
        e.mesh.userData.setStunned?.(stunned);
        e.stunWas = stunned;
      }
      let moving = false;
      let alerted = false;

      if (e.kind === "hushling") {
        const d = dist2D(e.pos.x, e.pos.z, p.x, p.z);
        if (!stunned) {
          const hearing = e.bossAdd ? 99 : this._noiseRadius();
          if (d < hearing || e.bossAdd) {
            e.alert = 2.4;
            e.wander = null;
          } else {
            e.alert = Math.max(0, e.alert - dt);
          }
          if (e.alert > 0) {
            alerted = true;
            moving = this._moveEnemy(e, p.x, p.z, e.bossAdd ? 2.15 : 2.3, dt);
          } else {
            e.wanderT -= dt;
            if (!e.wander || e.wanderT <= 0) {
              e.wanderT = 1.6 + Math.random() * 2.2;
              const a = Math.random() * TAU;
              e.wander = { x: e.home.x + Math.cos(a) * 1.3, z: e.home.z + Math.sin(a) * 1.3 };
            }
            if (dist2D(e.pos.x, e.pos.z, e.wander.x, e.wander.z) > 0.2) {
              moving = this._moveEnemy(e, e.wander.x, e.wander.z, 0.62, dt);
            }
          }
          this._face(e, e.dir.x || Math.sin(e.phase), e.dir.z || Math.cos(e.phase));
        }
        e.mesh.userData.update(dt, time, { moving, alerted });
      } else if (e.kind === "eel") {
        const surfaced = this.tide > 0.54 && this.calm <= 0 && !stunned;
        if (surfaced) {
          alerted = true;
          moving = this._moveEnemy(e, p.x, p.z, 1.55 + Math.min(0.4, this.level.id * 0.02), dt);
          this._face(e, p.x - e.pos.x, p.z - e.pos.z);
        } else if (!stunned) {
          moving = this._moveEnemy(e, e.home.x, e.home.z, 0.5, dt);
        }
        e.mesh.userData.setSubmerged?.(!surfaced);
        e.mesh.userData.update(dt, time, { moving, alerted, submerged: !surfaced });
        e.surfaced = surfaced;
      } else if (e.kind === "hound") {
        e.t += dt;
        const d = dist2D(e.pos.x, e.pos.z, p.x, p.z);
        if (stunned) {
          e.state = "rest";
          e.t = 0;
        } else if (e.state === "idle") {
          alerted = d < 6.2;
          if (d < 5.4 && e.t > 0.7) {
            e.state = "wind";
            e.t = 0;
          }
        } else if (e.state === "wind") {
          alerted = true;
          this._face(e, p.x - e.pos.x, p.z - e.pos.z);
          if (e.t > 0.55) {
            const dx = p.x - e.pos.x;
            const dz = p.z - e.pos.z;
            const len = Math.hypot(dx, dz) || 1;
            e.dir = { x: dx / len, z: dz / len };
            e.state = "charge";
            e.t = 0;
            this.audio.playThrottled("bark", 1100, { volume: 0.45 });
          }
        } else if (e.state === "charge") {
          alerted = true;
          moving = true;
          const nx = e.pos.x + e.dir.x * 8.2 * dt;
          const nz = e.pos.z + e.dir.z * 8.2 * dt;
          const pinned = this._pushCircle(nx, nz, 0.3, this.stage.bounds);
          e.pos.x = pinned.x;
          e.pos.z = pinned.z;
          this._face(e, e.dir.x, e.dir.z);
          if (e.t > 0.5) {
            e.state = "rest";
            e.t = 0;
          }
        } else {
          e.t += 0;
          if (e.t > 0.95) {
            e.state = "idle";
            e.t = 0;
          }
        }
        e.mesh.userData.update(dt, time, { moving, alerted });
      } else if (e.kind === "sentinel") {
        e.t += dt;
        if (stunned) {
          e.state = "idle";
          e.t = 0;
        } else if (e.state === "idle") {
          alerted = dist2D(e.pos.x, e.pos.z, p.x, p.z) < 7;
          if (e.t > e.wait) {
            e.state = "wind";
            e.t = 0;
          }
        } else if (e.state === "wind") {
          alerted = true;
          this._face(e, p.x - e.pos.x, p.z - e.pos.z);
          if (e.t > 0.55) {
            const dx = p.x - e.pos.x;
            const dz = p.z - e.pos.z;
            const len = Math.hypot(dx, dz) || 1;
            e.dir = { x: dx / len, z: dz / len };
            e.state = "dash";
            e.t = 0;
            this.audio.playThrottled("gear", 700, { volume: 0.4 });
          }
        } else if (e.state === "dash") {
          alerted = true;
          moving = true;
          const nx = e.pos.x + e.dir.x * 8.6 * dt;
          const nz = e.pos.z + e.dir.z * 8.6 * dt;
          const pinned = this._pushCircle(nx, nz, 0.3, this.stage.bounds);
          if (Math.abs(pinned.x - nx) > 0.01 || Math.abs(pinned.z - nz) > 0.01) e.t = 1;
          e.pos.x = pinned.x;
          e.pos.z = pinned.z;
          this._face(e, e.dir.x, e.dir.z);
          if (e.t > 0.48) {
            e.state = "back";
            e.t = 0;
          }
        } else {
          moving = dist2D(e.pos.x, e.pos.z, e.home.x, e.home.z) > 0.15;
          if (moving) {
            this._moveEnemy(e, e.home.x, e.home.z, 2.3, dt);
            this._face(e, e.dir.x, e.dir.z);
          }
          if (e.t > 1.4) {
            e.state = "idle";
            e.t = 0;
            e.wait = 0.45 + Math.random() * 0.9;
          }
        }
        e.mesh.userData.update(dt, time, { moving, alerted });
      } else if (e.kind === "shadow") {
        if (!stunned) {
          const sample = this._historyAt(e.delay);
          let tx = e.home.x;
          let tz = e.home.z;
          if (sample) {
            const a = time * 0.6 + e.phase;
            tx = sample.x + Math.cos(a) * 0.45;
            tz = sample.z + Math.sin(a) * 0.45;
          }
          moving = this._moveEnemy(e, tx, tz, 3.15, dt);
          if (moving) this._face(e, e.dir.x, e.dir.z);
          alerted = true;
        }
        e.mesh.userData.update(dt, time, { moving, alerted });
      }

      e.mesh.position.set(e.pos.x, 0, e.pos.z);

      if (!stunned && this.state === "playing") {
        const contact = e.kind === "eel" ? 0.55 : e.kind === "hound" ? 0.62 : e.kind === "sentinel" ? 0.58 : 0.5;
        if (dist2D(e.pos.x, e.pos.z, p.x, p.z) < contact + P.radius) {
          this._damage({ x: e.pos.x, z: e.pos.z });
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  _noiseRadius() {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed < 0.25) return 1.9;
    return this.input.quiet ? 3.0 : 7.6;
  }

  _makeNoise(x, z, radius) {
    for (const e of this.enemies) {
      if (e.kind !== "hushling" || e.dead) continue;
      if (dist2D(e.pos.x, e.pos.z, x, z) < radius) {
        e.alert = 2.6;
        e.wander = { x, z };
      }
    }
  }

  _stunEnemy(e, seconds) {
    e.stun = Math.max(e.stun, seconds);
    if (e.kind === "hound" || e.kind === "sentinel") {
      e.state = "rest";
      e.t = 0;
    }
    e.mesh.userData.hit?.();
  }

  /* ------------------------------------------------------------- player --- */

  _pushCircle(x, z, radius, bounds) {
    const b = bounds || this.stage.bounds;
    let nx = clamp(x, -b.halfW + radius, b.halfW - radius);
    let nz = clamp(z, -b.halfD + radius, b.halfD - radius);
    for (const c of this.colliders) {
      if (c.dead) continue;
      const min = c.r + radius;
      const dx = nx - c.x;
      const dz = nz - c.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.0001;
        nx = c.x + (dx / d) * min;
        nz = c.z + (dz / d) * min;
      }
    }
    nx = clamp(nx, -b.halfW + radius, b.halfW - radius);
    nz = clamp(nz, -b.halfD + radius, b.halfD - radius);
    if (this.isBoss) {
      const cz = 0.4;
      const dx = nx;
      const dz = nz - cz;
      const d = Math.hypot(dx, dz);
      const max = 8.6;
      if (d > max) {
        nx = (dx / d) * max;
        nz = cz + (dz / d) * max;
      }
    }
    return { x: nx, z: nz };
  }

  _snapCamera() {
    const t = this.stage._cameraTarget(this.playerPos, this.velocity);
    this.stage.camera.position.set(t.x, t.height, t.z + t.back);
    this.stage.camera.lookAt(t.lookX, t.lookY, t.lookZ);
  }

  _historyAt(delay) {
    if (!this.history.length) return null;
    const target = this.elapsed - delay;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].t <= target) return this.history[i];
    }
    return this.history[0];
  }

  _stepPlayer(dt, time) {
    const move = this.input.moveVector;
    const len = Math.hypot(move.x, move.z);
    const base = this.input.quiet ? P.quietSpeed : P.speed;
    const waterDrag = this.dream === "study" ? 1 - this.tide * 0.12 : 1;
    const target = base * waterDrag;
    const k = 1 - Math.exp(-(len > 0.01 ? P.accel : P.friction) * dt);
    this.velocity.x += (move.x * target - this.velocity.x) * k;
    this.velocity.z += (move.z * target - this.velocity.z) * k;

    const pinned = this._pushCircle(
      this.playerPos.x + this.velocity.x * dt,
      this.playerPos.z + this.velocity.z * dt,
      P.radius
    );
    this.playerPos.set(pinned.x, 0, pinned.z);
    this.player.position.set(pinned.x, 0, pinned.z);

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > 0.18) {
      const wanted = Math.atan2(this.velocity.x, this.velocity.z);
      this.player.rotation.y = lerpAngle(this.player.rotation.y, wanted, Math.min(1, dt * P.turnLerp));
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.player.visible = this.invuln <= 0 || Math.floor(time * 22) % 4 !== 0;
    this.player.userData.update(dt, time, speed);

    this.historyT += dt;
    if (this.historyT >= 0.06) {
      this.historyT = 0;
      this.history.push({ t: this.elapsed, x: this.playerPos.x, z: this.playerPos.z });
      while (this.history.length > 1 && this.history[0].t < this.elapsed - 6.5) this.history.shift();
    }

    if (this.swarm) {
      this.swarm.update(dt, time, this.playerPos, speed > 0.3);
    }
    this.stage.follow(this.playerPos, this.velocity, dt);
  }

  _stepWorld(dt, time) {
    for (const m of this.memories) {
      if (m.taken) continue;
      m.mesh.position.y = m.baseY + Math.sin(time * 2 + m.phase) * 0.09;
      m.mesh.rotation.y += dt * 0.9;
      if (dist2D(m.x, m.z, this.playerPos.x, this.playerPos.z) < 0.8) this._collect(m);
    }

    if (this.door) {
      this.door.userData.update(dt, time);
      if (this.doorOpen) {
        if (dist2D(this.door.position.x, this.door.position.z, this.playerPos.x, this.playerPos.z) < 1.05) {
          this._winLevel();
          return;
        }
      } else {
        this.exitHintT = Math.max(0, this.exitHintT - dt);
        if (
          this.exitHintT <= 0 &&
          dist2D(this.door.position.x, this.door.position.z, this.playerPos.x, this.playerPos.z) < 1.3
        ) {
          this.exitHintT = 4;
          this.ui.toast?.("toast.exitLocked", {
            item: i18n.t("collect." + this.dream)
          });
        }
      }
    }

    for (const gate of this.gates) {
      gate.mesh.userData.update(dt, time);
    }

    for (const c of this.creaks) {
      const d = dist2D(c.x, c.z, this.playerPos.x, this.playerPos.z);
      const active = d < 1.15;
      c.mesh.userData.update(dt, time, active);
      c.cooldown = Math.max(0, c.cooldown - dt);
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      if (active && c.cooldown <= 0 && !this.input.quiet && speed > 2.2) {
        c.cooldown = 2.6;
        this._makeNoise(c.x, c.z, 11.5);
        this.stage.fx.pulse(new THREE.Vector3(c.x, 0, c.z), "#ffe0a0", 2.4, { y: 0.08 });
        this.audio.playThrottled("tick", 260, { volume: 0.5, rate: 0.8 });
      }
    }

    for (const mirror of this.decor) mirror.userData.update?.(dt, time);
    for (const p of this.pendulums) p.userData.update(dt, time);

    if (this.dream === "study") this._stepTide(dt, time);

    if (this.pendulums.length || this.dream === "attic") {
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = this.dream === "attic" ? 1.9 : 3.2;
        const near = this.pendulums.some((p) => dist2D(p.position.x, p.position.z, this.playerPos.x, this.playerPos.z) < 7);
        if (near) this.audio.playThrottled("tick", 900, { volume: 0.3, rate: 1.2 });
      }
    }

    for (const p of this.pendulums) {
      const a = pendulumAngle(time, p.userData.phase);
      const bx = p.position.x + Math.sin(a) * (p.userData.length || 1.64);
      const bz = p.position.z + Math.cos(a) * (p.userData.length || 1.64);
      if (dist2D(bx, bz, this.playerPos.x, this.playerPos.z) < 0.55) {
        this._damage({ x: bx, z: bz });
      }
    }

    this._updateEnemies(dt, time);
    if (this.state !== "playing") return;
    if (this.boss) this._updateBoss(dt, time, true);
  }

  _stepTide(dt, time) {
    this.tidePhase += dt * 0.42;
    this.calm = Math.max(0, this.calm - dt);
    const raw = Math.sin(this.tidePhase) * 0.5 + 0.5;
    const rising = Math.max(0, raw);
    this.tide = this.calm > 0 ? 0 : rising;
    if (this.water) {
      const targetY = -0.045 + this.tide * 0.19;
      this.water.mesh.position.y += (targetY - this.water.mesh.position.y) * Math.min(1, dt * 2);
      this.water.mat.opacity = 0.3 + this.tide * 0.26;
      this.water.mat.emissiveIntensity = 0.08 + this.tide * 0.12 + Math.sin(time * 1.5) * 0.03;
    }
    this.rippleT -= dt;
    if (this.rippleT <= 0) {
      this.rippleT = 1.1 + Math.random() * 1.6;
      const x = (Math.random() - 0.5) * 15;
      const z = (Math.random() - 0.5) * 10;
      this.stage.fx.ring(new THREE.Vector3(x, 0, z), this.accent, 1.4 + Math.random(), {
        y: this.water ? this.water.mesh.position.y + 0.02 : 0.05,
        life: 1.5,
        opacity: 0.18,
        fade: 0.2
      });
    }
  }

  _collect(m) {
    m.taken = true;
    m.mesh.visible = false;
    this.collected += 1;
    this.stage.fx.sparkle(new THREE.Vector3(m.x, 0.9, m.z), this.accent, 12);
    this.stage.fx.flashLight(new THREE.Vector3(m.x, 1.2, m.z), this.accent, 1.4, 0.35);
    this.audio.play("collect", { volume: 0.75 });
    this.ui.toast?.("toast.note", {
      item: i18n.t("collect." + this.dream),
      n: this.collected
    });
    this.sdk?.trackCustom?.("memory", { level: this.level.id, n: this.collected });
    if (this.collected >= 3 && !this.doorOpen) this._openDoor();
  }

  _openDoor() {
    this.doorOpen = true;
    if (this.door) this.door.userData.setOpen(true);
    this.stage.fx.pulse(this.door ? this.door.position.clone() : this.playerPos, this.accent, 3.6);
    this.audio.play("power", { volume: 0.7 });
    this.ui.toast?.("toast.exitOpen");
  }

  /* ----------------------------------------------------------- abilities -- */

  useAbility() {
    if (this.state !== "playing") return;
    if (this.isBoss) {
      this._useFlare();
      return;
    }
    const ability = GAME_CONFIG.dreams[this.dream].ability;
    if (this.abilityCooldown > 0) {
      this.ui.toast?.("toast.abilityCooldown", { ability: i18n.t("ability." + ability) });
      this.ui.abilityNudge?.(ability);
      return;
    }
    const cfg = GAME_CONFIG.ability[ability];
    if (!cfg) return;
    const pos = this.playerPos.clone();
    let used = true;

    if (ability === "bell") {
      this.audio.play("bell", { volume: 0.85 });
      this.stage.fx.pulse(pos, this.accent, cfg.radius);
      this.stage.fx.flashLight(pos, this.accent, 2.6, 0.4);
      for (const e of this.enemies) {
        if (dist2D(e.pos.x, e.pos.z, pos.x, pos.z) < cfg.radius) {
          this._stunEnemy(e, cfg.duration);
          this.stage.fx.sparkle(new THREE.Vector3(e.pos.x, 0.8, e.pos.z), "#ffe0a0", 6);
        }
      }
      this.ui.toast?.("toast.bell");
    } else if (ability === "pulse") {
      this.audio.play("splash", { volume: 0.9, rate: 0.9 });
      this.stage.fx.pulse(pos, this.accent, cfg.radius, { y: 0.16 });
      this.calm = cfg.duration;
      this.tide = 0;
      for (const e of this.enemies) {
        if (e.kind === "eel" && dist2D(e.pos.x, e.pos.z, pos.x, pos.z) < cfg.radius) {
          this._stunEnemy(e, cfg.duration);
        }
      }
      this.ui.toast?.("toast.pulse");
    } else if (ability === "whistle") {
      this.audio.play("power", { volume: 0.7, rate: 1.35 });
      this.stage.fx.pulse(pos, this.accent, cfg.radius);
      let opened = 0;
      for (const gate of this.gates) {
        if (!gate.open && dist2D(gate.x, gate.z, pos.x, pos.z) < cfg.radius) {
          gate.open = true;
          gate.collider.dead = true;
          gate.mesh.userData.setOpen(true);
          this.stage.fx.sparkle(new THREE.Vector3(gate.x, 0.9, gate.z), this.accent, 10);
          opened += 1;
        }
      }
      for (const e of this.enemies) {
        if (e.kind === "hound" && dist2D(e.pos.x, e.pos.z, pos.x, pos.z) < cfg.radius) {
          this._stunEnemy(e, cfg.stun);
        }
      }
      this.ui.toast?.("toast.whistle");
      void opened;
    } else if (ability === "rewind") {
      const sample = this._historyAt(cfg.window) || this.history[0];
      this.audio.play("tick", { volume: 0.9, rate: 0.7 });
      this.stage.fx.sparkle(pos, "#cfe6ff", 16);
      if (sample) {
        const pinned = this._pushCircle(sample.x, sample.z, P.radius);
        this.playerPos.set(pinned.x, 0, pinned.z);
        this.player.position.set(pinned.x, 0, pinned.z);
        this.velocity.set(0, 0, 0);
        this._snapCamera();
      }
      this.invuln = Math.max(this.invuln, 1.2);
      this.stage.fx.pulse(this.playerPos.clone(), this.accent, 3.4);
      for (const e of this.enemies) {
        if (dist2D(e.pos.x, e.pos.z, this.playerPos.x, this.playerPos.z) < 4.5) this._stunEnemy(e, cfg.stun);
      }
      this.ui.toast?.("toast.rewind");
    } else if (ability === "swap") {
      let target = null;
      let best = Infinity;
      for (const e of this.enemies) {
        if (e.kind !== "shadow" || e.dead) continue;
        const d = dist2D(e.pos.x, e.pos.z, pos.x, pos.z);
        if (d < best && d < cfg.maxRange) {
          best = d;
          target = e;
        }
      }
      if (!target) {
        this.ui.toast?.("ability.swap.hint");
        used = false;
      } else {
        this.audio.play("mirror", { volume: 0.85 });
        const sx = target.pos.x;
        const sz = target.pos.z;
        const pinnedShadow = this._pushCircle(pos.x, pos.z, 0.3, this.stage.bounds);
        target.pos.x = pinnedShadow.x;
        target.pos.z = pinnedShadow.z;
        const pinned = this._pushCircle(sx, sz, P.radius);
        this.playerPos.set(pinned.x, 0, pinned.z);
        this.player.position.set(pinned.x, 0, pinned.z);
        this.velocity.set(0, 0, 0);
        this._stunEnemy(target, cfg.stun);
        this.stage.fx.pulse(pos, "#9dc7ff", 2.6);
        this.stage.fx.pulse(this.playerPos.clone(), this.accent, 2.6);
        this.stage.fx.sparkle(this.playerPos.clone().setY(0.9), "#cfe6ff", 14);
        this._snapCamera();
        this.ui.toast?.("toast.swap");
      }
    }

    if (used) {
      this.abilityCooldown = cfg.cooldown;
      this.abilityMax = cfg.cooldown;
      this.sdk?.trackCustom?.("ability", { id: ability, level: this.level.id });
    }
  }

  _useFlare() {
    const b = this.boss;
    if (!b || b.dead) return;
    if (b.charge < b.maxCharge) {
      this.ui.toast?.("toast.charge", { n: b.charge });
      this.ui.abilityNudge?.(b.charge >= b.maxCharge ? "ready" : "flare");
      return;
    }
    b.charge = 0;
    const mesh = createMemory("weaver");
    mesh.scale.setScalar(1.3);
    mesh.position.set(this.playerPos.x, 1.0, this.playerPos.z);
    this.world.add(mesh);
    b.flares.push({ mesh, pos: mesh.position.clone(), t: 0 });
    this.audio.play("power", { volume: 0.9, rate: 0.9 });
    this.stage.fx.flashLight(this.playerPos.clone().setY(1.2), "#ffd98a", 3, 0.5);
    this.stage.shake(0.18);
    this.sdk?.trackCustom?.("flare", { level: 16, hp: b.hp });
  }

  /* -------------------------------------------------------------- boss ---- */

  _placeMote(mote) {
    const a = Math.random() * TAU;
    const r = 2.9 + Math.random() * 3.6;
    const x = Math.cos(a) * r;
    const z = 1.2 + Math.sin(a) * r * 0.78;
    const p = this._pushCircle(clamp(x, -8, 8), clamp(z, -5.6, 6), 0.3, this.stage.bounds);
    mote.mesh.position.set(p.x, 0.9, p.z);
    mote.x = p.x;
    mote.z = p.z;
  }

  _updateBoss(dt, time, active) {
    const b = this.boss;
    if (!b) return;
    const bossPos = BOSS_POS;

    for (const mote of b.motes) {
      if (mote.active) {
        mote.mesh.position.y = 0.9 + Math.sin(time * 2 + mote.phase) * 0.1;
        mote.mesh.rotation.y += dt * 0.9;
        if (active && b.charge < b.maxCharge && this.state === "playing") {
          if (dist2D(mote.mesh.position.x, mote.mesh.position.z, this.playerPos.x, this.playerPos.z) < 0.75) {
            mote.active = false;
            mote.mesh.visible = false;
            mote.timer = GAME_CONFIG.boss.moteRespawnMs / 1000;
            b.charge += 1;
            this.audio.play("collect", { volume: 0.8, rate: 1.15 });
            this.stage.fx.sparkle(mote.mesh.position.clone(), "#ffd98a", 10);
            this.ui.toast?.("toast.charge", { n: b.charge });
            if (b.charge >= b.maxCharge) {
              this.audio.play("power", { volume: 0.8 });
              this.ui.abilityNudge?.("ready");
            }
          }
        }
      } else {
        mote.timer -= dt;
        if (mote.timer <= 0) {
          this._placeMote(mote);
          mote.active = true;
          mote.mesh.visible = true;
          this.stage.fx.sparkle(new THREE.Vector3(mote.x, 0.9, mote.z), this.accent, 8);
        }
      }
    }

    for (let i = b.flares.length - 1; i >= 0; i--) {
      const flare = b.flares[i];
      flare.t += dt;
      const target = new THREE.Vector3(BOSS_POS.x, 2.4, BOSS_POS.z);
      const dir = target.clone().sub(flare.pos);
      const dist = dir.length();
      if (dist < 1.2 || flare.t > 2.4) {
        this._hurtBoss(GAME_CONFIG.boss.flareDamage);
        this.world.remove(flare.mesh);
        disposeTree(flare.mesh);
        b.flares.splice(i, 1);
        continue;
      }
      dir.normalize();
      flare.pos.addScaledVector(dir, Math.min(dist, 15 * dt));
      flare.mesh.position.copy(flare.pos);
      flare.mesh.rotation.y += dt * 9;
      if (Math.random() < 0.4) this.stage.fx.sparkle(flare.pos.clone(), "#ffd98a", 2);
    }

    b.mesh.userData.update(dt, time, { moving: false, alerted: false });

    if (!active || this.state !== "playing" || b.dead) {
      this._updateBossBeams(dt, time, false);
      return;
    }

    b.attackDelay = Math.max(0, b.attackDelay - dt);
    if (b.attackDelay <= 0) {
      b.beamT -= dt;
      if (b.beamT <= 0 && !b.beams.length) this._startBossBeams();
      b.geyserT -= dt;
      if (b.geyserT <= 0) this._startBossGeysers();
      b.addT -= dt;
      if (b.phase >= 2 && b.addT <= 0) {
        b.addT = b.phase >= 3 ? 11 : 14;
        this._spawnBossAdds(b.phase >= 3 ? 3 : 2);
        this.ui.toast?.("toast.bossAdds");
      }
    }
    this._updateBossBeams(dt, time, true);

    for (let i = b.geysers.length - 1; i >= 0; i--) {
      const g = b.geysers[i];
      g.t += dt;
      if (!g.fired && g.t >= g.dur) {
        g.fired = true;
        this.stage.fx.burst(new THREE.Vector3(g.x, 0.3, g.z), this.accent, 26, {
          speed: 3.2,
          up: 3.2,
          life: 0.8,
          size: 0.55,
          spread: 0.5
        });
        this.stage.shake(0.16);
        this.audio.playThrottled("splash", 120, { volume: 0.5 });
        if (dist2D(g.x, g.z, this.playerPos.x, this.playerPos.z) < g.r) this._damage({ x: g.x, z: g.z });
      }
      if (g.t > g.dur + 0.4) b.geysers.splice(i, 1);
    }

    if (dist2D(bossPos.x, bossPos.z, this.playerPos.x, this.playerPos.z) < GAME_CONFIG.boss.contactRadius + P.radius) {
      this._damage(bossPos);
    }
  }

  _startBossBeams() {
    const b = this.boss;
    const count = b.phase >= 3 ? 3 : 2;
    const speed = (b.phase >= 3 ? 1.18 : 0.86) * (Math.random() < 0.5 ? -1 : 1);
    const base = Math.random() * TAU;
    for (let i = 0; i < count; i++) {
      const handle = this.stage.fx.createBeam(this.accent, 0.16);
      handle.material.opacity = 0;
      b.beams.push({
        angle: base + (i * TAU) / count,
        speed,
        warm: 1.15,
        life: 1.8,
        handle
      });
    }
    b.beamT = b.phase >= 3 ? 4.0 : 5.4;
    this.audio.play("gear", { volume: 0.5, rate: 0.65 });
  }

  _updateBossBeams(dt, time, active) {
    const b = this.boss;
    if (!b) return;
    const from = new THREE.Vector3(BOSS_POS.x, 0.55, BOSS_POS.z);
    for (let i = b.beams.length - 1; i >= 0; i--) {
      const beam = b.beams[i];
      if (beam.warm > 0) {
        beam.warm -= dt;
        beam.handle.material.opacity = 0.08 + Math.sin(time * 16) * 0.05;
        if (beam.warm <= 0) this.audio.play("tick", { volume: 0.5 });
      } else {
        beam.life -= dt;
        beam.angle += beam.speed * dt;
        beam.handle.material.opacity = 0.55 + Math.sin(time * 12) * 0.12;
        if (active && this.state === "playing") {
          const dx = Math.sin(beam.angle);
          const dz = Math.cos(beam.angle);
          if (pointRayDistance(this.playerPos.x, this.playerPos.z, from.x, from.z, dx, dz) < 0.42) {
            this._damage({ x: from.x, z: from.z });
          }
        }
      }
      const to = new THREE.Vector3(
        from.x + Math.sin(beam.angle) * 15,
        0.55,
        from.z + Math.cos(beam.angle) * 15
      );
      beam.handle.set(from, to);
      if (beam.life <= 0) {
        beam.handle.dispose();
        b.beams.splice(i, 1);
      }
    }
  }

  _startBossGeysers() {
    const b = this.boss;
    const count = Math.min(5, b.phase + 1);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const r = i === 0 ? 0 : 0.8 + Math.random() * 2.4;
      const x = clamp(this.playerPos.x + Math.cos(a) * r, -8.6, 8.6);
      const z = clamp(this.playerPos.z + Math.sin(a) * r, -5.6, 5.8);
      const vfx = this.stage.fx.telegraph(new THREE.Vector3(x, 0, z), this.accent, 1.18, 1.12, { column: true });
      b.geysers.push({ x, z, t: 0, dur: 1.12, r: 1.18, fired: false, vfx });
    }
    b.geyserT = 5.6 - b.phase * 0.7;
    this.audio.play("gear", { volume: 0.4, rate: 0.8 });
  }

  _spawnBossAdds(count) {
    const b = this.boss;
    if (b.addCount >= 7) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const x = clamp(Math.cos(a) * 7.2, -8.2, 8.2);
      const z = clamp(Math.sin(a) * 5.2, -5.6, 5.8);
      const e = this._spawnEnemy("hushling", x, z, { bossAdd: true, life: 20 });
      e.mesh.scale.setScalar(0.85);
      b.addCount += 1;
      this.stage.fx.burst(new THREE.Vector3(x, 0.6, z), this.accent, 14, { speed: 1.6, up: 1.2 });
    }
  }

  _hurtBoss(amount) {
    const b = this.boss;
    if (!b || b.dead) return;
    b.hp = Math.max(0, b.hp - amount);
    b.mesh.userData.hit?.();
    b.mesh.userData.flash?.();
    this.stage.shake(0.45);
    const pos = new THREE.Vector3(BOSS_POS.x, 2.6, BOSS_POS.z);
    this.stage.fx.burst(pos, "#ffd98a", 44, { speed: 4.2, up: 2.2, life: 1, size: 0.7, spread: 1 });
    this.stage.fx.flashLight(pos, "#ffd98a", 4, 0.5);
    this.audio.play("hurt", { volume: 0.5, rate: 0.7 });
    this.sdk?.trackCustom?.("bossHit", { hp: b.hp, phase: b.phase });

    if (b.hp <= 0) {
      this._bossDefeat();
      return;
    }
    const next = b.hp > 66 ? 1 : b.hp > 33 ? 2 : 3;
    if (next > b.phase) {
      b.phase = next;
      b.mesh.userData.setPhase(next);
      this.ui.toast?.("toast.phase", { phase: i18n.t("boss.phase" + next) });
      this.stage.shake(0.5);
      const adds = next >= 3 ? 3 : 2;
      this._spawnBossAdds(adds);
      b.addT = next >= 3 ? 11 : 14;
      this.audio.play("power", { volume: 0.7, rate: 0.8 });
      this.sdk?.trackCustom?.("bossPhase", { phase: next });
    }
  }

  _bossDefeat() {
    const b = this.boss;
    if (!b || b.dead) return;
    b.dead = true;
    this.state = "bossend";
    this.input.setEnabled(false);
    for (const beam of b.beams) beam.handle.dispose();
    b.beams = [];
    b.geysers = [];
    for (const flare of b.flares) {
      if (flare.mesh.parent) flare.mesh.parent.remove(flare.mesh);
      disposeTree(flare.mesh);
    }
    b.flares = [];
    for (const e of [...this.enemies]) this._removeEnemy(e);
    this.enemies = [];
    this.audio.play("power", { volume: 0.9, rate: 0.6 });
    this.ui.toast?.("toast.bossDefeat");
    this.stage.shake(0.65);
    this.stage.fx.burst(new THREE.Vector3(BOSS_POS.x, 3, BOSS_POS.z), this.accent, 80, {
      speed: 5,
      up: 3,
      life: 1.4,
      size: 0.8,
      spread: 1.4
    });
    this.sdk?.trackCustom?.("bossDefeat", {});
  }

  _animateBossDeath(dt) {
    const b = this.boss;
    if (!b) return;
    b.deathT += dt;
    b.deathFxT -= dt;
    if (b.deathFxT <= 0) {
      b.deathFxT = 0.32;
      const pos = new THREE.Vector3(
        BOSS_POS.x + (Math.random() - 0.5) * 3,
        1.5 + Math.random() * 2.5,
        BOSS_POS.z + (Math.random() - 0.5) * 2
      );
      this.stage.fx.burst(pos, Math.random() < 0.5 ? this.accent : "#ffd98a", 18, {
        speed: 2.6,
        up: 1.4,
        life: 0.9
      });
      b.mesh.userData.hit?.();
      this.stage.shake(0.16);
    }
    b.mesh.userData.update(dt, performance.now() / 1000, { moving: false, alerted: false });
    if (b.deathT > 1.2) {
      const s = Math.max(0.02, 1 - (b.deathT - 1.2) / 1.5);
      b.mesh.scale.setScalar(s);
    }
    if (b.deathT > 2.9) this._winLevel();
  }

  /* --------------------------------------------------------------- flow --- */

  _damage(source) {
    if (this.state !== "playing" || this.invuln > 0) return;
    const sx = source ? (source.pos ? source.pos.x : source.x) : this.playerPos.x;
    const sz = source ? (source.pos ? source.pos.z : source.z) : this.playerPos.z;

    if (this.swarm && this.swarm.remaining > 0) {
      const hit = this.swarm.shatter(this.playerPos);
      this.audio.play("hurt", { volume: 0.45 });
      if (hit) {
        this.stage.fx.burst(hit.position.clone().setY(0.9), hit.accent || "#ffd98a", 16, {
          speed: 2,
          up: 1.2,
          life: 0.7
        });
        this.stage.fx.flashLight(hit.position.clone().setY(1), hit.accent || "#ffd98a", 2, 0.3);
      }
      this.ui.toast?.("toast.guard");
      this.stage.shake(0.2);
      this.invuln = 0.9;
      return;
    }

    this.hearts -= 1;
    this.heartsLost += 1;
    this.invuln = P.invulnMs / 1000;
    const dx = this.playerPos.x - sx;
    const dz = this.playerPos.z - sz;
    const len = Math.hypot(dx, dz) || 1;
    this.velocity.x += (dx / len) * P.knockback;
    this.velocity.z += (dz / len) * P.knockback;
    this.audio.play("hurt", { volume: 0.8 });
    this.ui.toast?.("toast.hurt");
    this.ui.flash?.();
    this.stage.shake(0.36);
    this.stage.fx.flashLight(this.playerPos.clone().setY(1), "#ff7a7a", 3, 0.35);
    this.sdk?.trackCustom?.("hurt", { level: this.level.id, hearts: this.hearts });
    if (this.hearts <= 0) this._lose();
  }

  _winLevel() {
    if (this.state === "won" || this.state === "ending") return;
    if (!this.level) return;
    const level = this.level;
    const time = Math.max(1, Math.round(this.elapsed));
    const noHit = this.heartsLost === 0;
    const underPar = time <= level.par;
    const stars = 1 + (noHit ? 1 : 0) + (underPar ? 1 : 0);
    const result = this.save.completeLevel({ id: level.id, stars, time });
    this.state = "won";
    this.input.setEnabled(false);
    this.audio.play("win", { volume: 0.9 });
    this.ui.hudVisible?.(false);
    this.ads.onLevelCleared();
    this.sdk?.trackWin?.({ level: level.id, dream: level.dream, stars, time, noHit, boss: this.isBoss });
    this.ui.showWin?.({
      levelId: level.id,
      dream: this.dream,
      isBoss: this.isBoss,
      time,
      par: level.par,
      stars,
      collected: this.collected,
      noHit,
      newBest: result.newBest,
      firstClear: result.firstClear,
      newlyRescued: result.newlyRescued || null,
      canBlessing: this.ads.canShow("guardianBlessing") && !this.blessingUsed,
      blessingReady: !this.blessingUsed && this.save.bonusGuards > 0,
      totalStars: this.save.totalStars,
      nextId: level.id < 16 ? level.id + 1 : null
    });
    if (this.isBoss) {
      this.audio.playMusic("bgmEnding");
      this.sdk?.trackCustom?.("runComplete", { stars: this.save.totalStars });
    }
  }

  _lose() {
    if (this.state !== "playing") return;
    this.state = "lost";
    this.input.setEnabled(false);
    this.audio.play("lose", { volume: 0.9 });
    this.audio.stopMusic(1.4);
    this.ui.hudVisible?.(false);
    this.sdk?.trackFail?.({ level: this.level.id, dream: this.dream, memories: this.collected });
    this.ui.showLose?.({
      levelId: this.level.id,
      dream: this.dream,
      memories: this.collected,
      canRevive: this.ads.canShow("revive"),
      revived: this.revived,
      hint: i18n.t("howTo." + (this.dream === "weaver" ? "gallery" : this.dream))
    });
  }

  async revive() {
    if (this.state !== "lost" || this.revived) return;
    const ok = await this.ads.showRewarded("revive");
    if (!ok) return;
    this.revived = true;
    this.hearts = 1;
    this.invuln = 2.4;
    this.state = "playing";
    this.input.setEnabled(true);
    this.ui.hideLose?.();
    this.ui.hudVisible?.(true);
    this.audio.play("revive", { volume: 0.85 });
    this.audio.playMusic(this.isBoss ? "bgmBoss" : "bgmDream");
    this.stage.fx.pulse(this.playerPos.clone(), "#ffd98a", 4);
    this.sdk?.trackRevive?.({ level: this.level.id });
    this.audio.setPaused(false);
  }

  async nextLevel() {
    if (this.state !== "won" || this.transitioning) return;
    if (this.isBoss) {
      this._showEnding();
      return;
    }
    const next = this.level.id + 1;
    this.transitioning = true;
    if (this.ads.canShow("levelClear")) {
      await this.ads.showInterstitial("levelClear", { level: next });
    }
    if (this.state !== "won" && this.state !== "playing" && this.state !== "ad") {
      this.transitioning = false;
      return;
    }
    this.transitioning = false;
    this.startLevel(next);
  }

  async watchBlessing() {
    if (this.blessingUsed || this.state !== "won") return;
    const ok = await this.ads.showRewarded("guardianBlessing");
    if (!ok) return;
    this.blessingUsed = true;
    this.save.addBonusGuard();
    this.ui.toast?.("toast.blessingAdded");
    this.ui.setBlessingUsed?.();
    this.sdk?.trackAd?.({ placement: "guardianBlessing" });
  }

  retry() {
    if (!this.level) {
      this.showMenu();
      return;
    }
    this.startLevel(this.level.id);
  }

  togglePause() {
    if (this.state === "playing") this.pause();
    else if (this.state === "paused") this.resume();
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.input.setEnabled(false);
    this.audio.setPaused(true);
    this.ui.showPause?.({
      levelId: this.level?.id,
      dream: this.dream,
      isBoss: this.isBoss
    });
    this.sdk?.trackCustom?.("pause", { level: this.level?.id });
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.input.setEnabled(true);
    this.audio.setPaused(false);
    this.ui.hidePause?.();
    this.audio.playMusic(this.isBoss ? "bgmBoss" : "bgmDream");
  }

  quitToMenu() {
    if (this.state === "playing" || this.state === "paused") {
      this.sdk?.trackCustom?.("quit", { level: this.level?.id });
    }
    this.audio.setPaused(false);
    this.audio.setDucked(false);
    this.showMenu();
  }

  beginBoss() {
    if (this.state !== "bossintro") return;
    this.state = "playing";
    this.input.setEnabled(true);
    this.ui.hideBossIntro?.();
    this.tutorialT = 1.4;
    this.boss.attackDelay = 2.2;
    this.audio.playMusic("bgmBoss");
    this.sdk?.trackCustom?.("bossStart", {});
  }

  _showEnding() {
    if (!this.level) return;
    this.state = "ending";
    this.input.setEnabled(false);
    this.audio.stopMusic(0.8);
    this.audio.playMusic("bgmEnding");
    this.save.markEndingSeen();
    this.ui.hudVisible?.(false);
    this.ui.showEnding?.({
      cleared: this.save.clearedCount,
      stars: this.save.totalStars,
      family: this.save.rescuedIds(),
      night: this._bestTotal(),
      name: this.save.name
    });
    this.stage.showMenu("weaver");
    this._freshRun = true;
    this.sdk?.trackCustom?.("ending", { stars: this.save.totalStars });
  }

  _bestTotal() {
    return Object.values(this.save.data.best || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  /* --------------------------------------------------------------- misc --- */

  toggleMute() {
    const muted = !this.save.muted;
    this.save.setMuted(muted);
    this.audio.setMuted(muted);
    this.ui.setMuted?.(muted);
    this.sdk?.trackCustom?.("sound", { muted });
  }

  setName(name) {
    this.save.setName(name);
    this.sdk?.trackCustom?.("name", { length: this.save.name.length });
    return this.save.name;
  }

  shareData() {
    return {
      name: this.save.name,
      dreams: this.save.rescuedCount(),
      cleared: this.save.clearedCount,
      stars: this.save.totalStars,
      night: this._bestTotal(),
      levelId: this.level?.id || null,
      finished: this.save.starsFor(16) > 0
    };
  }

  _healthBreak() {
    if (this.state !== "playing") return;
    this.state = "health";
    this.nagging = true;
    this.input.setEnabled(false);
    this.audio.setPaused(true);
    this.healthAt += 45 * 60;
    this.save.noteHealthNag();
    this.ui.showHealth?.();
    this.sdk?.trackCustom?.("health", {});
  }

  resumeFromHealth() {
    if (this.state !== "health") return;
    this.state = "playing";
    this.nagging = false;
    this.input.setEnabled(true);
    this.audio.setPaused(false);
    this.ui.hideHealth?.();
  }

  healthQuit() {
    this.ui.hideHealth?.();
    this.quitToMenu();
  }

  onAdStart() {
    this._adPrev = this.state;
    if (this.state === "playing" || this.state === "bossintro") {
      this.state = "ad";
      this.input.setEnabled(false);
    }
    this.audio.setDucked(true);
  }

  onAdEnd() {
    this.audio.setDucked(false);
    if (this._adPrev && this._adPrev !== "ad") {
      if (["playing", "bossintro", "won", "lost", "paused"].includes(this._adPrev)) {
        this.state = this._adPrev;
        if (this.state === "playing" || this.state === "bossintro") this.input.setEnabled(true);
      }
    }
    this._adPrev = null;
  }

  _hudNow() {
    if (!this.level || !this.ui?.updateHUD) return;
    const ability = this.isBoss ? "flare" : GAME_CONFIG.dreams[this.dream].ability;
    this.ui.updateHUD({
      levelId: this.level.id,
      dream: this.dream,
      isBoss: this.isBoss,
      collected: this.collected,
      total: 3,
      hearts: this.hearts,
      maxHearts: P.hearts,
      guards: this.swarm ? this.swarm.remaining : 0,
      ability,
      cooldown: Math.max(0, this.abilityCooldown),
      cooldownMax: this.abilityMax,
      quiet: this.input.quiet,
      exitOpen: this.doorOpen,
      elapsed: Math.round(this.elapsed),
      par: this.level.par,
      boss: this.boss
        ? {
            hp: this.boss.hp,
            maxHp: this.boss.maxHp,
            phase: this.boss.phase,
            charge: this.boss.charge,
            maxCharge: this.boss.maxCharge
          }
        : null
    });
  }

  _animateIdle(dt, time) {
    if (!this.player) return;
    this.player.userData.update(dt, time, 0);
    if (this.swarm) this.swarm.update(dt, time, this.playerPos, false);
    for (const m of this.memories) {
      if (m.taken) continue;
      m.mesh.position.y = m.baseY + Math.sin(time * 2 + m.phase) * 0.09;
      m.mesh.rotation.y += dt * 0.9;
    }
    if (this.door) this.door.userData.update(dt, time);
    for (const gate of this.gates) gate.mesh.userData.update(dt, time);
    for (const mirror of this.decor) mirror.userData.update?.(dt, time);
    for (const p of this.pendulums) p.userData.update(dt, time);
    if (this.dream === "study") this._stepTide(dt, time);
    for (const e of this.enemies) {
      if (e.stun > 0) continue;
      e.mesh.userData.update(dt, time, { moving: false, alerted: false });
    }
    if (this.boss) this._updateBoss(dt, time, false);
    this.stage.follow(this.playerPos, this.velocity, dt);
  }

  _animateWon(dt, time) {
    if (!this.player) return;
    this.player.userData.update(dt, time, 0);
    if (this.swarm) this.swarm.update(dt, time, this.playerPos, false);
    for (const m of this.memories) {
      if (m.taken) continue;
      m.mesh.position.y = m.baseY + Math.sin(time * 2 + m.phase) * 0.09;
      m.mesh.rotation.y += dt * 0.9;
    }
    if (this.door) this.door.userData.update(dt, time);
    if (this.boss) {
      if (this.state !== "bossend") this.boss.mesh.userData.update(dt, time, { moving: false, alerted: false });
      for (const mote of this.boss.motes) {
        if (mote.active) mote.mesh.rotation.y += dt;
      }
    }
    this.stage.follow(this.playerPos, this.velocity, dt);
  }

  update(dt, time) {
    dt = Math.min(dt, 0.05);
    this.stage.update(dt, time);
    if (this.state === "menu" || this.state === "boot" || this.state === "loading") return;

    if (this.state === "playing") {
      this.elapsed += dt;
      this.playSeconds += dt;
      if (this.playSeconds >= this.healthAt) this._healthBreak();
      if (this.state !== "playing") return;
      this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
      this._stepPlayer(dt, time);
      this._stepWorld(dt, time);
      if (this.tutorialT > 0) {
        this.tutorialT -= dt;
        if (this.tutorialT <= 0 && !this.tutorialShown) {
          this.tutorialShown = true;
          const key = this.isBoss ? "tutorial.boss" : "tutorial." + this.dream;
          const first = this.isBoss || DREAM_LEVELS[this.dream][0] === this.level.id;
          if (first) this.ui.tutorial?.(i18n.t(key));
        }
      }
      this.hudT -= dt;
      if (this.hudT <= 0) {
        this.hudT = 0.1;
        this._hudNow();
      }
    } else if (this.state === "bossend") {
      this._animateWon(dt, time);
      this._animateBossDeath(dt);
      this.hudT -= dt;
      if (this.hudT <= 0) {
        this.hudT = 0.1;
        this._hudNow();
      }
    } else if (this.state === "bossintro") {
      this._animateIdle(dt, time);
      this.hudT -= dt;
      if (this.hudT <= 0) {
        this.hudT = 0.1;
        this._hudNow();
      }
    } else if (this.state === "won" || this.state === "lost") {
      this._animateWon(dt, time);
    } else if (this.state === "paused" || this.state === "health" || this.state === "ad") {
      if (this.player) this.player.userData.update(0, time, 0);
    }
  }

  /* ----------------------------------------------------------- QA hooks --- */

  debugSummary() {
    return {
      state: this.state,
      level: this.level ? this.level.id : null,
      dream: this.dream,
      boss: this.isBoss,
      hearts: this.hearts,
      guards: this.swarm ? this.swarm.remaining : 0,
      collected: this.collected,
      doorOpen: this.doorOpen,
      elapsed: Math.round(this.elapsed),
      abilityCooldown: Math.round(this.abilityCooldown * 10) / 10,
      enemies: this.enemies.length,
      bossHp: this.boss ? this.boss.hp : null,
      bossPhase: this.boss ? this.boss.phase : null,
      bossCharge: this.boss ? this.boss.charge : null,
      menu: this.state === "menu" ? this.menuData() : null
    };
  }

  debugStart(id) {
    return this.startLevel(id, { force: true });
  }

  debugCollectAll() {
    for (const m of this.memories) if (!m.taken) this._collect(m);
    return this.collected;
  }

  debugWin() {
    this._winLevel();
  }

  debugLose() {
    this.hearts = 0;
    this._lose();
  }

  debugDamage() {
    this.invuln = 0;
    this._damage({ x: this.playerPos.x + 1, z: this.playerPos.z });
  }

  debugTeleport(x, z) {
    const pinned = this._pushCircle(x, z, P.radius);
    this.playerPos.set(pinned.x, 0, pinned.z);
    if (this.player) this.player.position.copy(this.playerPos);
    this._snapCamera();
  }

  debugCharge() {
    if (this.boss) this.boss.charge = this.boss.maxCharge;
  }

  debugKillBoss() {
    if (this.boss) this._hurtBoss(999);
  }

  debugPhase(n) {
    if (!this.boss) return;
    this.boss.hp = n >= 3 ? 30 : n === 2 ? 60 : 100;
    this.boss.phase = n;
    this.boss.mesh.userData.setPhase(n);
  }

  debugUnlockAll() {
    this.save.data.unlocked = 16;
    for (let i = 1; i <= 15; i++) this.save.data.stars[i] = this.save.data.stars[i] || 1;
    this.save.write();
  }
}
