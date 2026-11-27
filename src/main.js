import { GAME_CONFIG } from "../config/game.config.js";
import { DOMAIN_CONFIG } from "../config/domains.config.js";
import { ADS_CONFIG } from "../config/ads.config.js";
import { i18n } from "./core/i18n.js";
import { Assets, IMAGES, AUDIO } from "./core/assets.js";
import { AudioManager } from "./core/audio.js";
import { SaveStore } from "./core/save.js";
import { Ads } from "./core/ads.js";
import { DomainLock } from "./core/domain-lock.js";
import { Stage } from "./art/scene.js";
import { UI } from "./ui/ui.js";
import { Game } from "./game/game.js";

const bootStart = performance.now();

function byId(id) {
  return document.getElementById(id);
}

function initSdk() {
  const sdk = typeof window !== "undefined" ? window.GameSDK : null;
  if (!sdk || !sdk.init) return sdk || null;
  try {
    sdk.init({
      appId: GAME_CONFIG.appId,
      appName: "Lullaby Manor",
      version: "1.0.0",
      domain: DOMAIN_CONFIG,
      ads: ADS_CONFIG
    });
  } catch (e) {
    console.warn("[Main] SDK init failed, continuing standalone", e);
  }
  return sdk;
}

function guardDomain(sdk, ui) {
  if (!DOMAIN_CONFIG.enabled) return false;
  const handlers = {
    onLock: (delay) => {
      ui.showDomain(delay);
      document.body.dataset.domainLock = "1";
      sdk?.trackCustom?.("domainLock", { host: location.hostname, protocol: location.protocol });
    },
    onTick: (left) => ui.domainTick(left)
  };
  const sdkDomain = sdk && sdk.config && sdk.config.domain;
  if (sdk && sdk.protect && sdk.protect.guardDomain && sdkDomain && sdkDomain.enabled) {
    return sdk.protect.guardDomain(handlers);
  }
  const gate = new DomainLock(DOMAIN_CONFIG);
  gate.inspect();
  return gate.enforce(handlers);
}

async function boot() {
  const assets = new Assets();
  const ui = new UI(assets);

  let stage;
  try {
    stage = new Stage(byId("stage-root"));
    stage.showMenu("nursery");
  } catch (e) {
    console.error("[Main] renderer could not start", e);
    ui.bootFail();
    return;
  }

  const sdk = initSdk();
  const audio = new AudioManager(GAME_CONFIG.audio);
  const save = new SaveStore(sdk);
  save.verify();
  const ads = new Ads(ADS_CONFIG, sdk);
  const game = new Game({ stage, ui, audio, save, ads, sdk });

  ui.bindGame(game);
  ads.bindOverlay(ui.adOverlay);
  ads.setHandlers(
    () => game.onAdStart(),
    () => game.onAdEnd()
  );
  audio.setMuted(save.muted);

  const qa = {
    version: "1.0.0",
    lang: i18n.lang,
    ready: false,
    domainLocked: false,
    sdk: sdk || null,
    game,
    stage,
    ui,
    save,
    audio,
    assets,
    enter() {
      if (qa.ready && !qa.domainLocked) ui.onEnter && ui.onEnter();
    },
    menu() {
      game.showMenu();
    },
    start(id) {
      return game.debugStart(id);
    },
    win() {
      game.debugWin();
    },
    lose() {
      game.debugLose();
    },
    collectAll() {
      return game.debugCollectAll();
    },
    damage() {
      game.debugDamage();
    },
    charge() {
      game.debugCharge();
    },
    killBoss() {
      game.debugKillBoss();
    },
    phase(n) {
      game.debugPhase(n);
    },
    teleport(x, z) {
      game.debugTeleport(x, z);
    },
    unlockAll() {
      game.debugUnlockAll();
      game.showMenu();
    },
    summary() {
      return game.debugSummary();
    },
    shareData() {
      return game.shareData();
    },
    openShare() {
      ui.openShare(game.shareData());
    },
    previewDomain() {
      ui.showDomain(3000);
    },
    assetsReport() {
      return {
        images: Object.keys(assets.images).length,
        imagesTotal: Object.keys(IMAGES).length,
        audio: Object.keys(audio.buffers).length,
        audioTotal: Object.keys(AUDIO).length,
        missingImages: Object.keys(IMAGES).filter((k) => !assets.images[k]),
        missingAudio: Object.keys(AUDIO).filter((k) => !audio.buffers[k])
      };
    },
    domainCheck() {
      const gate = new DomainLock(DOMAIN_CONFIG);
      return gate.inspect();
    }
  };
  window.LULLABY_MANOR = qa;

  let ready = false;
  const watchdog = setTimeout(() => {
    if (!ready) {
      console.warn("[Main] asset boot timed out");
      ui.bootFail();
    }
  }, 45000);

  ui.bootProgress("boot.stage.engine", 0.06);
  await assets.loadImages((frac) => {
    ui.bootProgress("boot.stage.art", 0.06 + frac * 0.62);
  });

  ui.bootProgress("boot.stage.audio", 0.7);
  await audio.load(assets.audioMap(), (frac) => {
    ui.bootProgress("boot.stage.audio", 0.7 + frac * 0.28);
  });
  audio.setMuted(save.muted);
  ui.bootProgress("boot.stage.ready", 1);
  clearTimeout(watchdog);
  ready = true;

  sdk?.trackLoad?.({
    images: Object.keys(assets.images).length,
    audio: Object.keys(audio.buffers).length,
    ms: Math.round(performance.now() - bootStart)
  });

  const locked = guardDomain(sdk, ui);
  qa.domainLocked = !!locked;
  if (locked) {
    console.log("[Main] unlicensed host — showing lock card before redirect");
    return;
  }

  ui.bootReady();
  qa.ready = true;
  document.body.dataset.ready = "1";

  ui.onEnter = async () => {
    audio.unlock();
    audio.setMuted(save.muted);
    ui.hideBoot();
    game.showMenu();
    sdk?.trackCustom?.("enter", { lang: i18n.lang });
    if (audio.ctx && audio.ctx.state === "suspended") {
      try {
        await audio.ctx.resume();
        if (audio.pendingMusic) {
          const track = audio.pendingMusic;
          audio.pendingMusic = "";
          audio.playMusic(track);
        }
      } catch (e) {
        /* user gesture may still be pending; menu stays silent but playable */
      }
    }
  };

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    game.update(dt, now / 1000);
    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  console.error("[Main] boot failed", e);
  const fail = byId("boot-fail");
  const play = byId("boot-play");
  if (fail) fail.hidden = false;
  if (play) play.hidden = true;
  if (window.LULLABY_MANOR) window.LULLABY_MANOR.ready = false;
});
