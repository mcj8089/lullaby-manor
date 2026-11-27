import { GAME_CONFIG } from "../../config/game.config.js";
import { DREAM_LEVELS, levelById } from "../../config/levels.js";
import { i18n } from "../core/i18n.js";
import { ShareKit } from "./share.js";

const DREAM_ORDER = ["nursery", "study", "garden", "attic", "gallery"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
const GLYPH = {
  bell: "bell",
  pulse: "pulse",
  whistle: "whistle",
  rewind: "rewind",
  swap: "swap",
  flare: "flare"
};
const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-heart"></use></svg>';

function $(id) {
  return document.getElementById(id);
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function cap(id) {
  return id ? id.charAt(0).toUpperCase() + id.slice(1) : "";
}

function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ":" + String(s).padStart(2, "0");
}

function formatNight(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  return m + ":" + String(s).padStart(2, "0");
}

function starsMarkup(stars, total = 3) {
  let out = "";
  for (let i = 0; i < total; i++) out += '<i class="' + (i < stars ? "on" : "") + '"></i>';
  return out;
}

/**
 * DOM-side companion to Game. It owns menus, HUD, paper panels, the share card
 * and the boot/domain overlays; Game owns simulation and only calls these
 * methods.
 */
export class UI {
  constructor(assets) {
    this.assets = assets;
    this.game = null;
    this.onEnter = null;
    this._winData = null;
    this._loseData = null;
    this._pauseData = null;
    this._storyMode = "intro";
    this._howSource = null;
    this._lastHud = {};
    this._toastTimers = new Set();
    this._tutorialTimer = 0;
    this._flashTimer = 0;
    this._bootDone = false;

    this.el = {
      boot: $("boot"),
      bootBar: $("boot-bar"),
      bootPct: $("boot-pct"),
      bootStage: $("boot-stage"),
      bootPlay: $("boot-play"),
      bootFail: $("boot-fail"),
      menu: $("menu"),
      menuProgress: $("menu-progress"),
      menuStars: $("menu-stars"),
      menuContinue: $("menu-continue"),
      menuContinueHint: $("menu-continue-hint"),
      menuBegin: $("menu-begin"),
      menuBlessing: $("menu-blessing"),
      menuEmpty: $("menu-empty"),
      dreamGrid: $("dream-grid"),
      bossCard: $("boss-card"),
      bossStart: $("boss-start"),
      bossLockCopy: $("boss-lock-copy"),
      bossStars: $("boss-stars"),
      familyStrip: $("family-strip"),
      hud: $("hud"),
      hudStage: $("hud-stage"),
      hudDreamName: $("hud-dream-name"),
      hudLevelName: $("hud-level-name"),
      hudTime: $("hud-time"),
      hudPar: $("hud-par"),
      hudHearts: $("hud-hearts"),
      hudGuards: $("hud-guards"),
      hudMemories: $("hud-memories"),
      hudExit: $("hud-exit"),
      hudObjective: document.querySelector(".hud-objective"),
      hudBoss: $("hud-boss"),
      hudBossBar: $("hud-boss-bar"),
      hudBossPhase: $("hud-boss-phase"),
      hudBossPhases: $("hud-boss-phases"),
      hudCharge: $("hud-charge"),
      hudAbility: $("hud-ability"),
      abilityLabel: $("ability-label"),
      hudCooldown: $("hud-cooldown"),
      hudQuiet: $("hud-quiet"),
      joystick: $("joystick"),
      joystickKnob: $("joystick-knob"),
      tutorial: $("tutorial"),
      tutorialText: $("tutorial-text"),
      story: $("story"),
      storyEnter: $("story-enter"),
      storySkip: $("story-skip"),
      how: $("how"),
      pause: $("pause"),
      pauseDream: $("pause-dream"),
      pauseLevel: $("pause-level"),
      win: $("win"),
      winKicker: $("win-kicker"),
      winLevel: $("win-level"),
      winTitle: $("win-title"),
      winStars: $("win-stars"),
      winStarhint: $("win-starhint"),
      winTime: $("win-time"),
      winPar: $("win-par"),
      winNotes: $("win-notes"),
      winRecord: $("win-record"),
      winTotal: $("win-total"),
      winStarsEarned: $("win-stars-earned"),
      winCompanion: $("win-companion"),
      winPortrait: $("win-portrait"),
      winCompanionName: $("win-companion-name"),
      winCompanionBody: $("win-companion-body"),
      winBlessing: $("win-blessing"),
      winBlessingNote: $("win-blessing-note"),
      winNext: $("win-next"),
      winNextLabel: $("win-next-label"),
      lose: $("lose"),
      loseNotes: $("lose-notes"),
      loseHint: $("lose-hint"),
      loseRevive: $("lose-revive"),
      bossIntro: $("boss-intro"),
      ending: $("ending"),
      endingTime: $("ending-time"),
      endingStars: $("ending-stars"),
      endingCleared: $("ending-cleared"),
      endingFamily: $("ending-family"),
      health: $("health"),
      share: $("share"),
      domain: $("domain"),
      domainCount: $("domain-count"),
      toasts: $("toasts"),
      flash: $("flash"),
      ad: $("ad-overlay"),
      adLabel: $("ad-label")
    };

    this.share = new ShareKit(assets, {
      onName: (name) => this.game && this.game.setName(name),
      onTrack: (channel) => this.game && this.game.sdk && this.game.sdk.trackCustom && this.game.sdk.trackCustom("share", { channel })
    });

    this.adOverlay = {
      label: "",
      show: (text) => this._showAd(text),
      hide: () => this._hideAd()
    };

    this._bindStatic();
    this._hydrateImages();
    i18n.applyToDom(document);
    this._detectTouch();
    this._setSoundIcons(false);
    this._refreshSilentButtons();
    this.adOverlay.label = i18n.t("ads.playing");
    document.body.classList.add("boot-open");
  }

  /* ------------------------------------------------------------- bindings -- */

  _bindStatic() {
    const click = (id, fn) => {
      const el = $(id);
      if (el) el.addEventListener("click", fn);
    };

    click("boot-play", () => {
      if (this._bootDone) return;
      this._bootDone = true;
      if (this.onEnter) this.onEnter();
    });

    click("menu-continue", () => {
      if (!this.game) return;
      if (this._continueIsBegin) this.game.begin();
      else this.game.continueGame();
    });

    click("menu-begin", () => {
      if (this.game) this.game.begin();
    });

    click("boss-start", () => {
      if (this.game) this.game.startBoss();
    });

    document.addEventListener("click", (e) => {
      const target = e.target && e.target.closest ? e.target.closest("[data-action]") : null;
      if (!target) return;
      const action = target.getAttribute("data-action");
      this._onAction(action);
    });

    if (this.el.dreamGrid) {
      this.el.dreamGrid.addEventListener("click", (e) => {
        const btn = e.target.closest(".stage-btn");
        if (!btn || btn.disabled) return;
        const id = Number(btn.getAttribute("data-level"));
        if (id && this.game) {
          this.game.audio && this.game.audio.play("ui", { volume: 0.4 });
          this.game.startLevel(id);
        }
      });
    }

    click("story-enter", () => this._closeStory());
    click("story-skip", () => {
      if (this.game) this.game.afterStory();
      else this.hideStory();
    });

    click("pause-resume", () => this.game && this.game.resume());
    click("pause-restart", () => {
      this.hidePause();
      if (this.game) this.game.retry();
    });
    click("pause-how", () => this.showHow("pause"));
    click("pause-sound", () => this.game && this.game.toggleMute());
    click("pause-quit", () => {
      this.hidePause();
      if (this.game) this.game.quitToMenu();
    });

    click("win-next", () => {
      const data = this._winData;
      this.hideWin();
      if (!this.game) return;
      this.game.nextLevel();
      void data;
    });
    click("win-replay", () => {
      this.hideWin();
      if (this.game) this.game.retry();
    });
    click("win-map", () => {
      this.hideWin();
      if (this.game) this.game.quitToMenu();
    });
    click("win-share", () => this.openShare());
    click("win-blessing", () => this._watchBlessing());

    click("lose-revive", () => this._revive());
    click("lose-retry", () => {
      this.hideLose();
      if (this.game) this.game.retry();
    });
    click("lose-map", () => {
      this.hideLose();
      if (this.game) this.game.quitToMenu();
    });
    click("lose-share", () => this.openShare());

    click("boss-face", () => {
      this.hideBossIntro();
      if (this.game) this.game.beginBoss();
    });

    click("ending-share", () => this.openShare());
    click("ending-again", () => {
      this.hideEnding();
      if (this.game) this.game.startLevel(1);
    });
    click("ending-menu", () => {
      this.hideEnding();
      if (this.game) this.game.quitToMenu();
    });

    click("health-continue", () => this.game && this.game.resumeFromHealth());
    click("health-break", () => this.game && this.game.healthQuit());

    click("tutorial-close", () => this.hideTutorial());
  }

  _onAction(action) {
    switch (action) {
      case "how":
        this.showHow("menu");
        break;
      case "story":
        if (this.game) this.game.openStory();
        else this.showStory("lore");
        break;
      case "share":
        this.openShare();
        break;
      case "sound":
        if (this.game) this.game.toggleMute();
        break;
      case "pause":
        if (this.game) this.game.togglePause();
        break;
      case "story-close":
        this._closeStory();
        break;
      case "how-close":
        this.closeHow();
        break;
      case "share-close":
        this.share.close();
        break;
      default:
        break;
    }
  }

  _closeStory() {
    if (this._storyMode === "lore") {
      this.hideStory();
      return;
    }
    if (this.game) this.game.afterStory();
    else this.hideStory();
  }

  bindGame(game) {
    this.game = game;
    if (!game) return;
    const input = game.input;
    if (input) {
      input.attachJoystick(this.el.joystick, this.el.joystickKnob);
      input.attachAction(this.el.hudAbility);
      input.attachQuiet(this.el.hudQuiet);
    }
    this.setMuted(!!(game.save && game.save.muted));
    this.adOverlay.label = i18n.t("ads.playing");
  }

  _detectTouch() {
    let touch = false;
    try {
      touch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    } catch (e) {
      touch = "ontouchstart" in window;
    }
    document.body.classList.toggle("touch", touch);
  }

  _hydrateImages() {
    document.querySelectorAll("[data-asset]").forEach((img) => {
      const key = img.getAttribute("data-asset");
      if (!key || !this.assets) return;
      if (!img.getAttribute("alt")) img.setAttribute("alt", "");
      img.addEventListener("error", () => {
        img.style.visibility = "hidden";
      });
      img.src = this.assets.url(key);
    });
  }

  _refreshSilentButtons() {
    const h = this.el.hud;
    if (h) h.classList.remove("is-off");
  }

  /* ------------------------------------------------------------ boot/domain -- */

  bootProgress(stageKey, frac) {
    if (this.el.bootBar && frac != null) {
      const pct = Math.max(0, Math.min(100, Math.round(frac * 100)));
      this.el.bootBar.style.width = pct + "%";
      if (this.el.bootPct) this.el.bootPct.textContent = pct + "%";
    }
    if (this.el.bootStage && stageKey) {
      this.el.bootStage.textContent = i18n.has(stageKey) ? i18n.t(stageKey) : stageKey;
    }
  }

  bootReady() {
    if (this.el.bootBar) this.el.bootBar.style.width = "100%";
    if (this.el.bootPct) this.el.bootPct.textContent = "100%";
    if (this.el.bootStage) this.el.bootStage.textContent = i18n.t("boot.stage.ready");
    if (this.el.bootPlay) this.el.bootPlay.hidden = false;
    if (this.el.bootFail) this.el.bootFail.hidden = true;
  }

  bootFail() {
    if (this.el.bootPlay) this.el.bootPlay.hidden = true;
    if (this.el.bootFail) this.el.bootFail.hidden = false;
    if (this.el.bootStage) this.el.bootStage.textContent = i18n.t("boot.failedHint");
  }

  hideBoot() {
    if (this.el.boot) this.el.boot.hidden = true;
    document.body.classList.remove("boot-open");
  }

  showDomain(delayMs) {
    if (this.el.domain) this.el.domain.hidden = false;
    if (this.el.bootPlay) this.el.bootPlay.hidden = true;
    this.domainTick(delayMs == null ? 3000 : delayMs);
  }

  domainTick(leftMs) {
    const n = Math.max(0, Math.ceil((Number(leftMs) || 0) / 1000));
    if (this.el.domainCount) this.el.domainCount.textContent = String(n);
  }

  /* ------------------------------------------------------------------ menu -- */

  showMenu(data) {
    this.hideAllPanels();
    this._lastHud = {};
    if (this.el.menu) this.el.menu.hidden = false;
    if (this.el.hud) this.el.hud.hidden = true;
    document.body.classList.add("menu-open");
    document.body.classList.remove("is-playing", "boot-open");
    this._menuData = data;
    this._renderMenu(data);
    this.setMuted(!!(this.game && this.game.save && this.game.save.muted));
  }

  _renderMenu(data) {
    if (!data) return;
    const cleared = Number(data.cleared) || 0;
    if (this.el.menuProgress) {
      this.el.menuProgress.textContent = i18n.t("menu.progress", { done: cleared });
    }
    if (this.el.menuStars) this.el.menuStars.textContent = String(data.stars || 0);
    if (this.el.menuBlessing) this.el.menuBlessing.hidden = !(data.bonusGuards > 0);

    const continueId = Number(data.continueId) || 1;
    const level = levelById(continueId);
    const isBegin = cleared === 0;
    this._continueIsBegin = isBegin;
    if (this.el.menuContinue) {
      const label = this.el.menuContinue.querySelector(".continue-label");
      if (label) label.textContent = i18n.t(isBegin ? "menu.begin" : "menu.continue");
      const arrow = this.el.menuContinue.querySelector(".ic");
      if (arrow) arrow.style.display = isBegin ? "none" : "";
    }
    if (this.el.menuContinueHint) {
      this.el.menuContinueHint.textContent = isBegin
        ? i18n.t("menu.continueEmpty")
        : i18n.t("menu.continueHint", { n: continueId, name: level ? i18n.t("level." + level.id + ".name") : "" });
    }
    if (this.el.menuBegin) this.el.menuBegin.hidden = isBegin;
    if (this.el.menuEmpty) this.el.menuEmpty.hidden = true;

    this._renderDreams(data);
    this._renderBoss(data);
    this._renderFamily(data);
  }

  _renderDreams(data) {
    const grid = this.el.dreamGrid;
    if (!grid) return;
    const byId = {};
    for (const d of data.dreams || []) byId[d.id] = d;
    grid.innerHTML = "";
    DREAM_ORDER.forEach((id, index) => {
      const d = byId[id];
      if (!d) return;
      const meta = GAME_CONFIG.dreams[id];
      const art = "dream" + cap(id);
      const name = i18n.t("dream." + id + ".name");
      const family = i18n.t("dream." + id + ".family");
      const rule = i18n.t("howTo." + id);
      const card = document.createElement("article");
      card.className = "dream-card" + (d.unlocked ? "" : " is-locked");
      card.setAttribute("data-dream", id);
      card.style.setProperty("--accent", meta.accent);

      let stageButtons = "";
      (d.levels || []).forEach((lv, i) => {
        const next = lv.id === data.continueId && lv.unlocked;
        const title = i18n.t("menu.stageN", { n: i + 1 }) + " · " + i18n.t("level." + lv.id + ".name");
        stageButtons +=
          '<button class="stage-btn' + (next ? " is-next" : "") + '" type="button" data-level="' + lv.id + '"' +
          (lv.unlocked ? "" : " disabled") + ' title="' + esc(title) + '">' +
          "<b>" + (i + 1) + "</b><small aria-hidden=\"true\">" + starsMarkup(lv.stars) + "</small>" +
          '<span class="sr-only">' + esc(title) + "</span></button>";
      });

      card.innerHTML =
        '<div class="dream-art">' +
          '<img src="' + esc(this.assets ? this.assets.url(art) : "") + '" alt="" loading="lazy" />' +
          '<span class="dream-numeral">' + ROMAN[index] + "</span>" +
          (d.unlocked ? "" : '<span class="dream-lock"><svg class="ic" aria-hidden="true"><use href="#i-lock"></use></svg></span>') +
          '<span class="dream-seal"><svg class="ic" aria-hidden="true"><use href="#i-' + (GLYPH[meta.ability] || "spark") + '"></use></svg></span>' +
        "</div>" +
        '<div class="dream-body">' +
          '<p class="eyebrow">' + esc(i18n.t("enemy." + meta.enemy)) + "</p>" +
          '<h3 class="dream-name">' + esc(name) + "</h3>" +
          '<p class="dream-family">' + esc(family) + "</p>" +
          '<p class="dream-rule">' + esc(rule) + "</p>" +
          '<div class="stage-row">' + stageButtons + "</div>" +
        "</div>";
      const img = card.querySelector("img");
      if (img) img.addEventListener("error", () => { img.style.visibility = "hidden"; });
      grid.appendChild(card);
    });
  }

  _renderBoss(data) {
    const card = this.el.bossCard;
    if (!card) return;
    const boss = data.boss || { unlocked: false, stars: 0 };
    card.classList.toggle("is-locked", !boss.unlocked);
    card.classList.toggle("is-unlocked", !!boss.unlocked);
    if (this.el.bossStart) this.el.bossStart.disabled = !boss.unlocked;
    if (this.el.bossLockCopy) this.el.bossLockCopy.hidden = !!boss.unlocked;
    if (this.el.bossStars) this.el.bossStars.innerHTML = starsMarkup(boss.stars || 0);
    const img = card.querySelector("img");
    if (img && !img.getAttribute("src") && this.assets) img.src = this.assets.url("dreamWeaver");
  }

  _renderFamily(data) {
    const list = this.el.familyStrip;
    if (!list) return;
    const rescued = data.rescued || [];
    list.innerHTML = "";
    Object.keys(GAME_CONFIG.family).forEach((id) => {
      const safe = rescued.indexOf(id) !== -1;
      const li = document.createElement("li");
      li.className = "family-member " + (safe ? "is-safe" : "is-unknown");
      const name = i18n.t("family." + id + ".name");
      const title = i18n.t("family." + id + ".title");
      li.innerHTML =
        '<span class="avatar"><img src="' + esc(this.assets ? this.assets.url("portrait" + cap(id)) : "") + '" alt="" loading="lazy" /></span>' +
        "<span>" + esc(name) + "</span>";
      li.setAttribute("title", safe ? name + " · " + title : i18n.t("menu.locked"));
      const img = li.querySelector("img");
      if (img) img.addEventListener("error", () => { img.style.visibility = "hidden"; });
      list.appendChild(li);
    });
  }

  /* ------------------------------------------------------------------- HUD -- */

  showGame() {
    if (this.el.menu) this.el.menu.hidden = true;
    document.body.classList.remove("menu-open");
    document.body.classList.add("is-playing");
    this.hideAllPanels();
  }

  hudVisible(on) {
    if (this.el.hud) this.el.hud.hidden = !on;
    if (on) this.hideTutorial();
  }

  updateHUD(p) {
    if (!p || !this.el) return;
    const lv = levelById(p.levelId);
    const dreamName = i18n.t("dream." + p.dream + ".name");
    const levelName = lv ? i18n.t("level." + lv.id + ".name") : "";
    if (this.el.hudStage) this.el.hudStage.textContent = i18n.t("hud.stage", { n: p.levelId });
    if (this.el.hudDreamName) this.el.hudDreamName.textContent = dreamName;
    if (this.el.hudLevelName) this.el.hudLevelName.textContent = levelName;
    if (this.el.hudTime) this.el.hudTime.textContent = formatTime(p.elapsed);
    if (this.el.hudPar) this.el.hudPar.textContent = formatTime(p.par);

    if (this._lastHud.hearts !== p.hearts || this._lastHud.maxHearts !== p.maxHearts) {
      let html = "";
      for (let i = 0; i < p.maxHearts; i++) {
        html += '<span class="heart' + (i < p.hearts ? "" : " is-lost") + '">' + HEART_SVG + "</span>";
      }
      if (this.el.hudHearts) {
        this.el.hudHearts.innerHTML = html;
        this.el.hudHearts.setAttribute("aria-label", i18n.t("hud.hearts", { n: p.hearts }));
      }
      this._lastHud.hearts = p.hearts;
      this._lastHud.maxHearts = p.maxHearts;
    }

    if (this._lastHud.guards !== p.guards) {
      if (this.el.hudGuards) {
        this.el.hudGuards.querySelector("b").textContent = String(p.guards || 0);
        this.el.hudGuards.classList.toggle("is-empty", !p.guards);
        this.el.hudGuards.setAttribute("aria-label", i18n.t("hud.guards", { n: p.guards || 0 }));
      }
      this._lastHud.guards = p.guards;
    }

    if (this._lastHud.collected !== p.collected) {
      if (this.el.hudMemories) {
        this.el.hudMemories.innerHTML = starsMarkup(p.collected, p.total || 3);
      }
      this._lastHud.collected = p.collected;
    }

    if (this.el.hudObjective) this.el.hudObjective.hidden = !!p.isBoss;
    if (this.el.hudExit) {
      const item = i18n.t("collect." + p.dream);
      this.el.hudExit.textContent = p.exitOpen ? i18n.t("hud.exitOpen") : i18n.t("hud.exitLocked", { item });
      this.el.hudExit.classList.toggle("is-open", !!p.exitOpen);
    }

    const abilityKey = GAME_CONFIG.dreams[p.dream] ? GAME_CONFIG.dreams[p.dream].ability : p.ability;
    if (this.el.hudAbility) {
      const use = this.el.hudAbility.querySelector(".ability-glyph use");
      if (use) use.setAttribute("href", "#i-" + (GLYPH[p.ability] || abilityKey || "spark"));
      const ready = p.isBoss
        ? !!(p.boss && p.boss.charge >= p.boss.maxCharge)
        : p.cooldown <= 0.05;
      this.el.hudAbility.classList.toggle("ready", ready);
      this.el.hudAbility.classList.toggle("cooling", !ready);
      const progress = p.isBoss
        ? Math.max(0, Math.min(1, p.boss ? p.boss.charge / Math.max(1, p.boss.maxCharge) : 0))
        : p.cooldownMax > 0
          ? Math.max(0, Math.min(1, 1 - p.cooldown / p.cooldownMax))
          : 1;
      this.el.hudAbility.style.setProperty("--cd", String(progress));
    }
    if (this.el.abilityLabel) this.el.abilityLabel.textContent = i18n.t("ability." + p.ability);
    if (this.el.hudCooldown) {
      this.el.hudCooldown.textContent = p.isBoss
        ? (p.boss && p.boss.charge >= p.boss.maxCharge
            ? i18n.t("hud.charged")
            : i18n.t("hud.charge", { n: p.boss ? p.boss.charge : 0 }))
        : p.cooldown > 0.05
          ? i18n.t("hud.cooldown", { s: Math.ceil(p.cooldown) })
          : i18n.t("hud.abilityReady");
    }

    if (this.el.hudBoss) {
      this.el.hudBoss.hidden = !p.isBoss;
      if (p.isBoss && p.boss) {
        const pct = Math.max(0, Math.min(100, (p.boss.hp / Math.max(1, p.boss.maxHp)) * 100));
        if (this.el.hudBossBar) this.el.hudBossBar.style.width = pct + "%";
        if (this.el.hudBossPhase) this.el.hudBossPhase.textContent = ROMAN[Math.max(0, Math.min(5, p.boss.phase - 1))];
        if (this.el.hudBossPhases) {
          let html = "";
          for (let i = 0; i < 3; i++) html += "<i class=\"" + (i < p.boss.phase ? "on" : "") + "\"></i>";
          this.el.hudBossPhases.innerHTML = html;
        }
        if (this.el.hudCharge) {
          const full = p.boss.charge >= p.boss.maxCharge;
          this.el.hudCharge.classList.toggle("is-full", full);
          const span = this.el.hudCharge.querySelector("span");
          if (span) span.textContent = full ? i18n.t("hud.charged") : i18n.t("hud.charge", { n: p.boss.charge });
        }
      }
    }

    if (this._lastHud.isBoss !== p.isBoss) {
      if (this.el.hudObjective) this.el.hudObjective.hidden = !!p.isBoss;
      this._lastHud.isBoss = p.isBoss;
    }
  }

  abilityNudge() {
    const btn = this.el.hudAbility;
    if (!btn) return;
    btn.classList.remove("nudge");
    void btn.offsetWidth;
    btn.classList.add("nudge");
    setTimeout(() => btn.classList.remove("nudge"), 550);
  }

  setQuiet(on) {
    if (this.el.hudQuiet) this.el.hudQuiet.classList.toggle("on", !!on);
    if (this.el.hud) this.el.hud.classList.toggle("is-quiet", !!on);
    if (this.game && this.game.input) this.game.input.setQuietUI(!!on);
  }

  setMuted(muted) {
    this._setSoundIcons(!!muted);
  }

  _setSoundIcons(muted) {
    document.querySelectorAll("#menu-sound, #hud-sound, #pause-sound").forEach((btn) => {
      btn.classList.toggle("is-off", !!muted);
      btn.setAttribute("aria-pressed", muted ? "true" : "false");
      const use = btn.querySelector("use");
      if (use) use.setAttribute("href", muted ? "#i-sound-off" : "#i-sound-on");
    });
  }

  /* ------------------------------------------------------------- messages -- */

  toast(key, vars) {
    if (!this.el.toasts) return;
    const text = i18n.has(key) ? i18n.t(key, vars) : String(key || "");
    if (!text) return;
    while (this.el.toasts.children.length >= 3) {
      this.el.toasts.firstElementChild.remove();
    }
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = text;
    this.el.toasts.appendChild(node);
    const t = setTimeout(() => {
      node.classList.add("is-out");
      const t2 = setTimeout(() => {
        node.remove();
        this._toastTimers.delete(t2);
      }, 320);
      this._toastTimers.add(t2);
    }, 2400);
    this._toastTimers.add(t);
  }

  tutorial(text) {
    if (!this.el.tutorial || !text) return;
    if (this.el.tutorialText) this.el.tutorialText.textContent = text;
    this.el.tutorial.hidden = false;
    clearTimeout(this._tutorialTimer);
    this._tutorialTimer = setTimeout(() => this.hideTutorial(), 9000);
  }

  hideTutorial() {
    if (this.el.tutorial) this.el.tutorial.hidden = true;
    clearTimeout(this._tutorialTimer);
  }

  flash() {
    if (!this.el.flash) return;
    this.el.flash.classList.remove("on");
    void this.el.flash.offsetWidth;
    this.el.flash.classList.add("on");
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => this.el.flash.classList.remove("on"), 480);
  }

  /* --------------------------------------------------------------- story -- */

  showStory(mode) {
    this._storyMode = mode === "lore" ? "lore" : "intro";
    if (this.el.story) this.el.story.hidden = false;
    if (this.el.storyEnter) {
      const span = this.el.storyEnter.querySelector("span");
      if (span) span.textContent = i18n.t(this._storyMode === "lore" ? "common.back" : "story.enter");
    }
    if (this.el.storySkip) this.el.storySkip.hidden = this._storyMode === "lore";
    const art = document.getElementById("story-art");
    if (art && this.assets) {
      art.style.visibility = "";
      art.src = this.assets.url("keyartWide");
    }
    setTimeout(() => {
      if (this.el.storyEnter) this.el.storyEnter.focus();
    }, 80);
  }

  hideStory() {
    if (this.el.story) this.el.story.hidden = true;
  }

  /* ------------------------------------------------------------------ how -- */

  showHow(source) {
    this._howSource = source || "menu";
    if (this._howSource === "pause" && this.el.pause) this.el.pause.hidden = true;
    if (this.el.how) this.el.how.hidden = false;
  }

  closeHow() {
    if (this.el.how) this.el.how.hidden = true;
    const source = this._howSource;
    this._howSource = null;
    if (source === "pause" && this.game && this.game.state === "paused" && this._pauseData) {
      this.showPause(this._pauseData);
    }
  }

  /* ---------------------------------------------------------------- pause -- */

  showPause(data) {
    this._pauseData = data || {};
    const dreamName = i18n.t("dream." + (data && data.dream ? data.dream : "nursery") + ".name");
    const lv = data && data.levelId ? levelById(data.levelId) : null;
    if (this.el.pauseDream) this.el.pauseDream.textContent = dreamName;
    if (this.el.pauseLevel) this.el.pauseLevel.textContent = lv ? i18n.t("level." + lv.id + ".name") : "";
    if (this.el.pause) this.el.pause.hidden = false;
    this.setMuted(!!(this.game && this.game.save && this.game.save.muted));
    setTimeout(() => {
      const resume = $("pause-resume");
      if (resume) resume.focus();
    }, 80);
  }

  hidePause() {
    if (this.el.pause) this.el.pause.hidden = true;
  }

  /* ------------------------------------------------------------------ win -- */

  showWin(data) {
    this._winData = data || {};
    const d = this._winData;
    const meta = GAME_CONFIG.dreams[d.dream] || GAME_CONFIG.dreams.nursery;
    const familyId = meta.family;
    const familyName = familyId ? i18n.t("family." + familyId + ".name") : "";
    const lv = d.levelId ? levelById(d.levelId) : null;
    if (this.el.win) {
      this.el.win.hidden = false;
      this.el.win.style.setProperty("--accent", meta.accent);
    }
    if (this.el.winKicker) this.el.winKicker.textContent = i18n.t(d.isBoss ? "boss.defeat" : "win.kicker");
    if (this.el.winLevel) this.el.winLevel.textContent = lv ? i18n.t("level." + lv.id + ".name") : "";
    if (this.el.winTitle) {
      this.el.winTitle.textContent = d.isBoss
        ? i18n.t("win.titleBoss")
        : i18n.t("win.title", { name: familyName });
    }

    if (this.el.winStars) {
      this.el.winStars.innerHTML = "";
      for (let i = 0; i < 3; i++) {
        const star = document.createElement("span");
        star.className = "star" + (i < d.stars ? " on" : "");
        star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-star"></use></svg>';
        this.el.winStars.appendChild(star);
      }
      this.el.winStars.setAttribute("aria-label", i18n.t("win.starsEarned", { n: d.stars }));
    }
    if (this.el.winTime) this.el.winTime.textContent = formatTime(d.time);
    if (this.el.winPar) {
      this.el.winPar.textContent =
        i18n.t("win.par", { time: formatTime(d.par) }) +
        (d.newBest ? " · " + i18n.t("toast.newRecord") : "");
    }
    if (this.el.winNotes) this.el.winNotes.textContent = d.isBoss ? "—" : (d.collected || 0) + " / 3";
    if (this.el.winRecord) this.el.winRecord.textContent = "";
    if (this.el.winTotal) {
      this.el.winTotal.textContent = (d.totalStars || 0) + " / " + (GAME_CONFIG.levelCount * 3);
    }
    if (this.el.winStarsEarned) {
      this.el.winStarsEarned.textContent = i18n.t("win.starsEarned", { n: d.stars || 0 });
    }
    if (this.el.winStarhint) this.el.winStarhint.textContent = i18n.t("win.starHint");

    if (this.el.winCompanion) {
      const rescued = d.newlyRescued;
      this.el.winCompanion.hidden = !rescued;
      if (rescued) {
        const name = i18n.t("family." + rescued + ".name");
        const title = i18n.t("family." + rescued + ".title");
        if (this.el.winPortrait) {
          this.el.winPortrait.style.visibility = "";
          this.el.winPortrait.src = this.assets ? this.assets.url("portrait" + cap(rescued)) : "";
          this.el.winPortrait.alt = name;
        }
        if (this.el.winCompanionName) this.el.winCompanionName.textContent = i18n.t("win.companionTitle", { name });
        if (this.el.winCompanionBody) this.el.winCompanionBody.textContent = i18n.t("win.companionBody", { title });
      }
    }

    const row = this.el.win ? this.el.win.querySelector(".blessing-row") : null;
    if (this.el.winBlessing) {
      this.el.winBlessing.hidden = !d.canBlessing;
      this.el.winBlessing.disabled = false;
    }
    if (this.el.winBlessingNote) this.el.winBlessingNote.hidden = !d.blessingReady;
    if (row) row.hidden = !d.canBlessing && !d.blessingReady;

    if (this.el.winNextLabel) {
      this.el.winNextLabel.textContent = i18n.t(d.isBoss ? "win.dawn" : "win.next");
    }
    setTimeout(() => {
      if (this.el.winNext) this.el.winNext.focus();
    }, 120);
  }

  hideWin() {
    if (this.el.win) this.el.win.hidden = true;
  }

  async _watchBlessing() {
    if (!this.game || !this.el.winBlessing) return;
    this.el.winBlessing.disabled = true;
    try {
      await this.game.watchBlessing();
    } finally {
      if (this.el.winBlessing) this.el.winBlessing.disabled = false;
    }
  }

  setBlessingUsed() {
    if (this.el.winBlessing) this.el.winBlessing.hidden = true;
    if (this.el.winBlessingNote) {
      this.el.winBlessingNote.hidden = false;
      this.el.winBlessingNote.textContent = i18n.t("win.blessingOk");
    }
  }

  /* ----------------------------------------------------------------- lose -- */

  showLose(data) {
    this._loseData = data || {};
    if (this.el.lose) this.el.lose.hidden = false;
    if (this.el.loseNotes) this.el.loseNotes.textContent = i18n.t("lose.notes", { n: data.memories || 0 });
    if (this.el.loseHint) {
      this.el.loseHint.textContent = data.hint || "";
      this.el.loseHint.hidden = !data.hint;
    }
    if (this.el.loseRevive) {
      this.el.loseRevive.hidden = !data.canRevive || !!data.revived;
      this.el.loseRevive.disabled = false;
    }
    setTimeout(() => {
      const retry = $("lose-retry");
      if (retry) retry.focus();
    }, 120);
  }

  hideLose() {
    if (this.el.lose) this.el.lose.hidden = true;
  }

  async _revive() {
    if (!this.game || !this.el.loseRevive) return;
    this.el.loseRevive.disabled = true;
    try {
      await this.game.revive();
    } finally {
      if (this.el.loseRevive) this.el.loseRevive.disabled = false;
    }
  }

  /* ------------------------------------------------------------ boss intro -- */

  showBossIntro() {
    if (this.el.bossIntro) this.el.bossIntro.hidden = false;
    setTimeout(() => {
      const face = $("boss-face");
      if (face) face.focus();
    }, 120);
  }

  hideBossIntro() {
    if (this.el.bossIntro) this.el.bossIntro.hidden = true;
  }

  /* --------------------------------------------------------------- ending -- */

  showEnding(data) {
    this.hideWin();
    this.hideLose();
    if (this.el.ending) this.el.ending.hidden = false;
    if (this.el.endingTime) this.el.endingTime.textContent = formatNight(data.night || 0);
    if (this.el.endingStars) this.el.endingStars.textContent = (data.stars || 0) + " / " + (GAME_CONFIG.levelCount * 3);
    if (this.el.endingCleared) this.el.endingCleared.textContent = (data.cleared || 0) + " / " + GAME_CONFIG.levelCount;
    if (this.el.endingFamily && this.assets) {
      const safe = data.family || [];
      this.el.endingFamily.innerHTML = "";
      Object.keys(GAME_CONFIG.family).forEach((id) => {
        const isSafe = safe.indexOf(id) !== -1;
        const name = i18n.t("family." + id + ".name");
        const member = document.createElement("div");
        member.className = "member" + (isSafe ? " is-safe" : " is-unknown");
        member.style.opacity = isSafe ? "1" : "0.35";
        member.innerHTML =
          '<span class="avatar"><img src="' + esc(this.assets.url("portrait" + cap(id))) + '" alt="" /></span>' +
          "<span>" + esc(name) + "</span>";
        const img = member.querySelector("img");
        if (img) img.addEventListener("error", () => { img.style.visibility = "hidden"; });
        this.el.endingFamily.appendChild(member);
      });
    }
    setTimeout(() => {
      const btn = $("ending-share");
      if (btn) btn.focus();
    }, 120);
  }

  hideEnding() {
    if (this.el.ending) this.el.ending.hidden = true;
  }

  /* --------------------------------------------------------------- health -- */

  showHealth() {
    if (this.el.health) this.el.health.hidden = false;
    setTimeout(() => {
      const btn = $("health-continue");
      if (btn) btn.focus();
    }, 80);
  }

  hideHealth() {
    if (this.el.health) this.el.health.hidden = true;
  }

  /* ---------------------------------------------------------------- share -- */

  openShare(data) {
    const payload = data || (this.game ? this.game.shareData() : {});
    this.share.open(payload);
  }

  hideShare() {
    this.share.hide();
  }

  hideAllPanels() {
    this.hideStory();
    if (this.el.how) this.el.how.hidden = true;
    this._howSource = null;
    this.hidePause();
    this.hideWin();
    this.hideLose();
    this.hideBossIntro();
    this.hideEnding();
    this.hideHealth();
    this.hideTutorial();
    if (this.share) this.share.hide();
  }

  /* ------------------------------------------------------------------- ads -- */

  _showAd(text) {
    if (this.el.adLabel) this.el.adLabel.textContent = text || this.adOverlay.label || i18n.t("ads.playing");
    if (this.el.ad) this.el.ad.hidden = false;
  }

  _hideAd() {
    if (this.el.ad) this.el.ad.hidden = true;
  }
}
