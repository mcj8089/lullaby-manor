/**
 * Lullaby Manor — ad placements.
 *
 * Ads are OFF until an ad account exists. Flip `enabled` to true and set the
 * provider + placement ids; the SDK handles the rest. Nothing else changes.
 *
 *   enabled    : master switch. false = every canShow() answers false.
 *   provider   : none | mock | poki | crazygames | custom
 *   testMode   : true keeps mock fills even when enabled.
 *
 * Placements wired into the UI:
 *   revive            rewarded   — one extra lantern heart after a failed dream
 *   guardianBlessing  rewarded   — next level starts with one extra guard spark
 *   levelClear        interstitial — between dreams every N clears
 *   gameOver          interstitial — disabled by default (retry stays instant)
 */
export const ADS_CONFIG = {
  enabled: false,
  provider: "mock",
  testMode: true,
  global: {
    pauseGameDuringAd: true,
    muteAudioDuringAd: true,
    fillTimeoutMs: 9000,
    simulateMs: 1400
  },
  placements: {
    revive: { format: "rewarded", id: "", enabled: true, maxPerRun: 1, cooldownMs: 0, sdk: "" },
    guardianBlessing: { format: "rewarded", id: "", enabled: true, maxPerRun: 1, cooldownMs: 0, sdk: "" },
    levelClear: { format: "interstitial", id: "", enabled: true, everyNLevels: 4, cooldownMs: 60000, sdk: "" },
    gameOver: { format: "interstitial", id: "", enabled: false, everyNPlays: 3, cooldownMs: 60000, sdk: "" }
  },
  providerConfig: {
    poki: { sdkUrl: "https://game-cdn.poki.com/scripts/v2/poki-sdk.js", gameId: "" },
    crazygames: { sdkUrl: "https://sdk.crazygames.com/crazygames-sdk-v3.js" },
    custom: { scriptUrl: "", adapterGlobal: "LullabyAdAdapter" }
  },
  mockText: "ADVERTISEMENT"
};
