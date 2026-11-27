/**
 * Thin ad facade.
 *
 * The shared SDK owns provider adapters and usage limits when it is present.
 * This wrapper keeps the game playable with no SDK (or with ads switched off)
 * and exposes the exact calls the UI needs: canShow / showRewarded /
 * showInterstitial / resetRun / onLevelCleared.
 */
export class Ads {
  constructor(config, sdk) {
    this.config = config;
    this.sdk = sdk || (typeof window !== "undefined" ? window.GameSDK : null);
    this.overlay = null;
    this.onStart = null;
    this.onEnd = null;
    this.playCount = 0;
    this.levelCount = 0;
    this._usage = {};
    this._lastShown = {};
    this._mockTimers = new Set();
  }

  get enabled() {
    return !!(this.config && this.config.enabled && this.config.provider !== "none");
  }

  get ready() {
    if (!this.enabled) return false;
    if (this._sdkAdsEnabled()) return !!this.sdk.ads.ready;
    return true;
  }

  _sdkAdsEnabled() {
    return !!(this.sdk && this.sdk.ads && this.sdk.ads.enabled);
  }

  bindOverlay(overlay) {
    this.overlay = overlay;
    if (this._sdkAdsEnabled()) this.sdk.ads.bindOverlay(overlay);
  }

  setHandlers(onStart, onEnd) {
    this.onStart = onStart;
    this.onEnd = onEnd;
    if (this._sdkAdsEnabled()) {
      this.sdk.ads.onAdStart = () => onStart && onStart();
      this.sdk.ads.onAdEnd = () => onEnd && onEnd();
    }
  }

  resetRun() {
    this.playCount += 1;
    this.levelCount = 0;
    this._usage = {};
    if (this.sdk && this.sdk.ads) this.sdk.ads.resetRun();
  }

  onLevelCleared() {
    this.levelCount += 1;
    if (this.sdk && this.sdk.ads) this.sdk.ads.onLevelCleared();
  }

  canShow(name) {
    if (!this.enabled) return false;
    if (this._sdkAdsEnabled()) return this.sdk.ads.canShow(name);
    if (!this.sdk) {
      // No SDK: still honour the configured provider by using the local mock.
    }
    const p = this.config.placements[name];
    if (!p || p.enabled === false) return false;
    if ((this._usage[name] || 0) >= (p.maxPerRun == null ? 99 : p.maxPerRun)) return false;
    if (p.cooldownMs && Date.now() - (this._lastShown[name] || 0) < p.cooldownMs) return false;
    if (p.format === "interstitial" && p.everyNLevels) {
      if (!this.levelCount || this.levelCount % p.everyNLevels !== 0) return false;
    }
    if (p.format === "interstitial" && p.everyNPlays) {
      if (!this.playCount || this.playCount % p.everyNPlays !== 0) return false;
    }
    return true;
  }

  async showRewarded(name) {
    if (!this.canShow(name)) return false;
    this._usage[name] = (this._usage[name] || 0) + 1;
    this._lastShown[name] = Date.now();
    this._fireStart();
    try {
      if (this._sdkAdsEnabled()) return await this.sdk.ads.showRewarded(name);
      await this._mock();
      return true;
    } catch (e) {
      console.warn("[Ads] rewarded failed", e);
      return false;
    } finally {
      this._fireEnd();
    }
  }

  async showInterstitial(name, ctx) {
    if (!this.canShow(name)) return false;
    this._usage[name] = (this._usage[name] || 0) + 1;
    this._lastShown[name] = Date.now();
    this._fireStart();
    try {
      if (this._sdkAdsEnabled()) return await this.sdk.ads.showInterstitial(name, ctx);
      await this._mock();
      return true;
    } catch (e) {
      console.warn("[Ads] interstitial failed", e);
      return false;
    } finally {
      this._fireEnd();
    }
  }

  _fireStart() {
    if (this.onStart) this.onStart();
  }

  _fireEnd() {
    if (this.onEnd) this.onEnd();
  }

  _mock() {
    const ms = (this.config.global && this.config.global.simulateMs) || 1400;
    const text = (this.overlay && this.overlay.label) || "";
    return new Promise((resolve) => {
      if (this.overlay) this.overlay.show(text);
      const t = setTimeout(() => {
        this._mockTimers.delete(t);
        if (this.overlay) this.overlay.hide();
        resolve(true);
      }, ms);
      this._mockTimers.add(t);
    });
  }
}
