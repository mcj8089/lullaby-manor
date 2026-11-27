import { GAME_CONFIG } from "../../config/game.config.js";
import { i18n } from "../core/i18n.js";

const FAMILY = ["ollie", "theo", "biscuit", "clara", "june"];
const FAMILY_ACCENT = {
  ollie: "#8fe3cf",
  theo: "#f0bf7a",
  biscuit: "#c9a7ff",
  clara: "#ffcf7a",
  june: "#9dc7ff"
};
const CARD = 1080;
const FONT_DISPLAY = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Songti SC", "Microsoft YaHei", serif';
const FONT_SANS = '"Gill Sans", "Avenir Next", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

function cap(id) {
  return id ? id.charAt(0).toUpperCase() + id.slice(1) : "";
}

function formatNight(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  return m + ":" + String(s).padStart(2, "0");
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = line + " " + words[i];
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

function drawCover(ctx, img, x, y, w, h, fx = 0.5, fy = 0.5) {
  if (!img || !img.naturalWidth) return false;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
  return true;
}

function drawSpaced(ctx, text, x, y, spacing) {
  let cx = x;
  const chars = Array.from(String(text || ""));
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - x;
}

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.44;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Square share card + the outbound social flows. The card is painted locally so
 * sharing works offline; every network button is a plain URL intent.
 */
export class ShareKit {
  constructor(assets, handlers) {
    this.assets = assets;
    this.handlers = handlers || {};
    this.canvas = document.getElementById("share-canvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    this.layer = document.getElementById("share");
    this.input = document.getElementById("share-name");
    this.hintEl = document.getElementById("share-hint");
    this.data = {};
    this.name = "";
    this._lastBlob = null;
    this._drawQueued = false;
    this._bind();
  }

  _bind() {
    const on = (id, ev, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(ev, fn);
    };
    on("share-download", "click", () => {
      this.download();
    });
    on("share-copy", "click", () => {
      this.copyInvite();
    });
    on("share-native", "click", () => {
      this.nativeShare();
    });
    document.querySelectorAll("[data-share]").forEach((btn) => {
      btn.addEventListener("click", () => this.social(btn.getAttribute("data-share")));
    });
    if (this.input) {
      this.input.addEventListener("input", () => {
        this.name = this.input.value.slice(0, 16);
        this.queueDraw();
      });
      this.input.addEventListener("change", () => this.saveName());
    }
    const close = document.querySelector('[data-action="share-close"]');
    if (close) close.addEventListener("click", () => this.close());
  }

  saveName() {
    if (this.handlers.onName) this.handlers.onName(this.name.trim());
  }

  open(data) {
    this.data = data || {};
    this.name = String(this.data.name || "").slice(0, 16);
    if (this.input) this.input.value = this.name;
    if (this.hintEl) this.hintEl.textContent = "";
    if (this.layer) this.layer.hidden = false;
    this._lastBlob = null;
    this.draw();
    const close = this.layer && this.layer.querySelector(".panel-x");
    if (close) setTimeout(() => close.focus(), 60);
    if (this.handlers.onOpen) this.handlers.onOpen();
  }

  hide() {
    if (this.layer) this.layer.hidden = true;
  }

  close() {
    this.saveName();
    this.hide();
  }

  hint(text) {
    if (this.hintEl) this.hintEl.textContent = text || "";
  }

  track(channel) {
    if (this.handlers.onTrack) this.handlers.onTrack(channel);
  }

  queueDraw() {
    if (this._drawQueued) return;
    this._drawQueued = true;
    requestAnimationFrame(() => {
      this._drawQueued = false;
      this.draw();
    });
  }

  /* ------------------------------------------------------------- painting -- */

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const c = this.canvas;
    const imgs = this.assets ? this.assets.images : {};
    const n = Math.max(0, Math.min(5, Number(this.data.dreams) || 0));
    const stars = Math.max(0, Number(this.data.stars) || 0);
    const name = this.name.trim();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CARD, CARD);
    ctx.save();

    // Deep base + art.
    const base = ctx.createLinearGradient(0, 0, 0, CARD);
    base.addColorStop(0, "#0a2326");
    base.addColorStop(0.55, "#061518");
    base.addColorStop(1, "#030b0d");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, CARD, CARD);

    const art = imgs.keyartWide || imgs.keyart;
    if (art) {
      ctx.save();
      ctx.globalAlpha = 0.92;
      drawCover(ctx, art, 0, 0, CARD, CARD, 0.56, 0.42);
      ctx.restore();
    }

    const shade = ctx.createLinearGradient(0, 0, 0, CARD);
    shade.addColorStop(0, "rgba(4,16,18,0.30)");
    shade.addColorStop(0.32, "rgba(4,16,18,0.42)");
    shade.addColorStop(0.58, "rgba(4,16,18,0.82)");
    shade.addColorStop(0.75, "rgba(3,12,14,0.96)");
    shade.addColorStop(1, "rgba(3,10,12,0.995)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, CARD, CARD);

    const glow = ctx.createRadialGradient(870, 170, 10, 870, 170, 520);
    glow.addColorStop(0, "rgba(247,215,157,0.22)");
    glow.addColorStop(0.5, "rgba(143,227,207,0.06)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD, CARD);

    // Paper grain.
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * CARD;
      const y = Math.random() * CARD;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    ctx.restore();

    // Gold frame + corner ticks.
    ctx.strokeStyle = "rgba(233,185,111,0.44)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(46.5, 46.5, CARD - 93, CARD - 93);
    ctx.strokeStyle = "rgba(247,236,216,0.12)";
    ctx.strokeRect(58.5, 58.5, CARD - 117, CARD - 117);

    ctx.save();
    ctx.strokeStyle = "rgba(233,185,111,0.8)";
    ctx.lineWidth = 2;
    const corners = [
      [46, 46, 1, 1],
      [CARD - 46, 46, -1, 1],
      [46, CARD - 46, 1, -1],
      [CARD - 46, CARD - 46, -1, -1]
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + 40 * sy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 40 * sx, cy);
      ctx.stroke();
    }
    ctx.restore();

    // Header.
    const emblem = imgs.emblem;
    if (emblem) {
      ctx.save();
      ctx.shadowColor = "rgba(143,227,207,0.55)";
      ctx.shadowBlur = 34;
      ctx.drawImage(emblem, 90, 88, 84, 84);
      ctx.restore();
    }

    ctx.fillStyle = "#f7ecd8";
    ctx.font = "500 33px " + FONT_DISPLAY;
    ctx.textBaseline = "alphabetic";
    drawSpaced(ctx, i18n.t("brand.name"), 200, 132, 5.5);

    ctx.fillStyle = "rgba(247,236,216,0.48)";
    ctx.font = "600 15px " + FONT_SANS;
    drawSpaced(ctx, i18n.t("brand.kicker").toUpperCase(), 202, 158, 2.6);

    // Stars tally top right.
    ctx.save();
    ctx.fillStyle = "#f7d79d";
    drawStar(ctx, 916, 120, 15);
    ctx.fill();
    ctx.font = "500 30px " + FONT_SANS;
    ctx.fillStyle = "rgba(247,236,216,0.86)";
    ctx.textAlign = "left";
    ctx.fillText(stars + " / 48", 946, 130);
    ctx.restore();

    // Headline.
    ctx.fillStyle = "#fbf3e3";
    ctx.font = "500 82px " + FONT_DISPLAY;
    const headline = i18n.t("share.cardHeadline", { n });
    const lines = wrapLines(ctx, headline, 820).slice(0, 3);
    let y = 610 - (lines.length - 1) * 46;
    for (const line of lines) {
      ctx.fillText(line, 88, y);
      y += 94;
    }

    ctx.fillStyle = "#e9b96f";
    ctx.font = "italic 46px " + FONT_DISPLAY;
    ctx.fillText(i18n.t("share.cardSub"), 92, y + 8);

    // Family portraits.
    const members = FAMILY.slice(0, 5);
    const px = 674;
    const py = 812;
    const size = 66;
    const gap = 12;
    members.forEach((id, i) => {
      const cx = px + i * (size + gap);
      const safe = i < n;
      const img = imgs["portrait" + cap(id)];
      ctx.save();
      ctx.globalAlpha = safe ? 1 : 0.26;
      ctx.beginPath();
      ctx.arc(cx + size / 2, py + size / 2, size / 2 + 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(5,18,20,0.7)";
      ctx.fill();
      ctx.strokeStyle = safe ? FAMILY_ACCENT[id] : "rgba(247,236,216,0.22)";
      ctx.lineWidth = safe ? 2.5 : 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + size / 2, py + size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.clip();
      if (img && img.naturalWidth) {
        drawCover(ctx, img, cx, py, size, size, 0.5, 0.42);
      } else {
        ctx.fillStyle = "rgba(247,236,216,0.12)";
        ctx.fillRect(cx, py, size, size);
      }
      if (!safe) {
        ctx.fillStyle = "rgba(3,12,14,0.55)";
        ctx.fillRect(cx, py, size, size);
      }
      ctx.restore();
    });

    // Name + tag.
    ctx.fillStyle = "rgba(247,236,216,0.66)";
    ctx.font = "600 21px " + FONT_SANS;
    drawSpaced(ctx, i18n.t("share.cardTag").toUpperCase(), 90, 862, 2.2);

    if (name) {
      ctx.fillStyle = "#f7d79d";
      ctx.font = "italic 38px " + FONT_DISPLAY;
      ctx.fillText(name, 90, 914);
    } else {
      ctx.fillStyle = "rgba(247,236,216,0.34)";
      ctx.font = "italic 30px " + FONT_DISPLAY;
      ctx.fillText(i18n.t("share.anonymous"), 90, 906);
    }

    if (this.data.night) {
      ctx.fillStyle = "rgba(247,236,216,0.42)";
      ctx.font = "500 21px " + FONT_SANS;
      ctx.textAlign = "right";
      ctx.fillText(i18n.t("share.cardTime", { time: formatNight(this.data.night) }), 990, 914);
      ctx.textAlign = "left";
    }

    // Footer.
    ctx.strokeStyle = "rgba(233,185,111,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(90, 964);
    ctx.lineTo(990, 964);
    ctx.stroke();

    ctx.fillStyle = "rgba(247,236,216,0.52)";
    ctx.font = "600 19px " + FONT_SANS;
    drawSpaced(ctx, GAME_CONFIG.share.site.toUpperCase(), 90, 1002, 2.4);

    ctx.fillStyle = "rgba(233,185,111,0.8)";
    ctx.font = "italic 21px " + FONT_DISPLAY;
    ctx.textAlign = "right";
    ctx.fillText(GAME_CONFIG.share.hashtag, 990, 1001);
    ctx.textAlign = "left";

    ctx.restore();
  }

  /* -------------------------------------------------------------- actions -- */

  inviteText() {
    const n = Math.max(0, Math.min(5, Number(this.data.dreams) || 0));
    return i18n.t("share.text", {
      name: this.name.trim() || i18n.t("share.anonymous"),
      n,
      url: GAME_CONFIG.share.url
    });
  }

  toBlob() {
    return new Promise((resolve) => {
      if (!this.canvas) return resolve(null);
      try {
        this.canvas.toBlob((blob) => resolve(blob), "image/png");
      } catch (e) {
        resolve(null);
      }
    });
  }

  download(showHint = true) {
    this.saveName();
    this.draw();
    return this.toBlob().then((blob) => {
      if (!blob) {
        this.hint(i18n.t("share.failed"));
        return null;
      }
      this._lastBlob = blob;
      const slug = this.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = "lullaby-manor" + (slug ? "-" + slug : "") + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      if (showHint) this.hint(i18n.t("share.hintDownload"));
      this.track("download");
      return blob;
    });
  }

  async copyInvite() {
    this.saveName();
    const text = this.inviteText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        this._legacyCopy(text);
      }
      this.hint(i18n.t("share.hintCopy"));
      this.track("copy");
    } catch (e) {
      try {
        this._legacyCopy(text);
        this.hint(i18n.t("share.hintCopy"));
      } catch (err) {
        this.hint(i18n.t("share.hintFallback"));
      }
    }
  }

  _legacyCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand && document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("copy-failed");
  }

  async nativeShare() {
    this.saveName();
    const text = this.inviteText();
    const title = i18n.t("brand.name");
    try {
      if (!navigator.share) {
        const blob = await this.download(false);
        this.hint(blob ? i18n.t("share.hintDownload") : i18n.t("share.failed"));
        return;
      }
      let sharedWithFiles = false;
      if (navigator.canShare && this.canvas) {
        const blob = this._lastBlob || (await this.toBlob());
        this._lastBlob = blob;
        if (blob && typeof File !== "undefined") {
          const file = new File([blob], "lullaby-manor.png", { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text, title });
            sharedWithFiles = true;
          }
        }
      }
      if (!sharedWithFiles) await navigator.share({ text, url: GAME_CONFIG.share.url, title });
      this.hint(i18n.t("share.nativeDone"));
      this.track("native");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      this.hint(i18n.t("share.failed"));
    }
  }

  social(channel) {
    this.saveName();
    const url = GAME_CONFIG.share.url;
    if (channel === "fb") {
      const href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url);
      window.open(href, "_blank", "noopener,noreferrer,width=640,height=560");
      this.hint(i18n.t("share.hintFB"));
      this.track("facebook");
      return;
    }
    if (channel === "reddit") {
      const href =
        "https://www.reddit.com/submit?url=" +
        encodeURIComponent(url) +
        "&title=" +
        encodeURIComponent(i18n.t("brand.name") + " — " + i18n.t("share.cardTag"));
      window.open(href, "_blank", "noopener,noreferrer,width=760,height=680");
      this.hint(i18n.t("share.hintReddit"));
      this.track("reddit");
      return;
    }
    const hintKey = channel === "ig" ? "share.hintIG" : channel === "yt" ? "share.hintYT" : "share.hintTT";
    const channelName = channel === "ig" ? "instagram" : channel === "yt" ? "youtube" : "tiktok";
    this.hint(i18n.t(hintKey));
    this.track(channelName);
    this.download(false).then((blob) => {
      if (!blob) this.hint(i18n.t("share.failed"));
    });
  }
}
