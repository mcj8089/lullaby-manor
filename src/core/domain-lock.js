/**
 * Domain check fallback. Used only when window.GameSDK is unavailable.
 * An unlisted host sees the lock card, waits redirectDelayMs, then replaces
 * the location with the licensed site.
 */
export class DomainLock {
  constructor(config) {
    this.config = config;
    this.result = null;
    this._timer = null;
  }

  static normalize(host) {
    return String(host || "").toLowerCase().replace(/\.$/, "");
  }

  static matchHost(host, pattern) {
    const h = DomainLock.normalize(host);
    let p = DomainLock.normalize(pattern);
    if (!h || !p) return false;
    if (p.startsWith("*.")) p = p.slice(2);
    return h === p || h.endsWith("." + p);
  }

  inspect() {
    const proto = location.protocol;
    const host = location.hostname;
    let allowed;
    if (proto === "file:") {
      allowed = !!this.config.allowFileProtocol;
    } else {
      allowed = (this.config.allowedHosts || []).some((p) => DomainLock.matchHost(host, p));
    }
    this.result = { allowed, host, protocol: proto, reason: allowed ? "ok" : "host-not-allowed" };
    if (this.config.debug) {
      console.log("[DomainLock]", allowed ? "authorised" : "blocked", "host=" + (host || "(file)"), proto);
    }
    return this.result;
  }

  enforce(cb) {
    const r = this.result || this.inspect();
    if (r.allowed) return false;
    const delay = Math.max(0, this.config.redirectDelayMs || 0);
    if (cb && typeof cb.onLock === "function") cb.onLock(delay);
    const started = Date.now();
    this._timer = setInterval(() => {
      const left = Math.max(0, delay - (Date.now() - started));
      if (cb && typeof cb.onTick === "function") cb.onTick(left);
      if (left <= 0) {
        clearInterval(this._timer);
        this.redirect();
      }
    }, 150);
    setTimeout(() => this.redirect(), delay + 400);
    return true;
  }

  redirect() {
    const url = this.config.redirectUrl;
    if (!url) return;
    try {
      if (window.top && window.top !== window.self && !this.config.allowIframe) {
        window.top.location.href = url;
        return;
      }
    } catch (e) {
      /* cross-origin iframe: fall through */
    }
    location.replace(url);
  }
}
