import { LOCALES } from "../../config/locales.js";

const ALIASES = {
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  "en-au": "en",
  english: "en",
  zh: "zh",
  "zh-cn": "zh",
  "zh-hans": "zh",
  "zh-sg": "zh",
  cn: "zh",
  chinese: "zh",
  "中文": "zh"
};

function detectLang() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get("lang") || params.get("locale") || "").trim().toLowerCase();
    if (raw && ALIASES[raw]) return ALIASES[raw];
    if (raw) {
      const base = raw.split(/[-_]/)[0];
      if (ALIASES[base]) return ALIASES[base];
    }
  } catch (e) {
    /* default to English */
  }
  return "en";
}

export class I18n {
  constructor() {
    this.lang = detectLang();
    this.dict = LOCALES[this.lang] || LOCALES.en;
    this.fallback = LOCALES.en;
  }

  t(key, vars) {
    let s = this.dict[key] != null ? this.dict[key] : this.fallback[key];
    if (s == null) {
      if (typeof console !== "undefined") console.warn("[i18n] missing key:", key);
      return key;
    }
    if (vars) {
      for (const k in vars) s = s.split("{" + k + "}").join(String(vars[k]));
    }
    return s;
  }

  has(key) {
    return this.dict[key] != null || this.fallback[key] != null;
  }

  num(n) {
    return (Math.round(n) || 0).toLocaleString(this.lang === "zh" ? "zh-CN" : "en-US");
  }

  applyToDom(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = this.t(el.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", this.t(el.getAttribute("data-i18n-title")));
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", this.t(el.getAttribute("data-i18n-aria")));
    });
    document.documentElement.lang = this.t("html.lang");
    document.title = this.t("brand.title");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", this.t("meta.desc"));
    const kw = document.querySelector('meta[name="keywords"]');
    if (kw) kw.setAttribute("content", this.t("meta.keywords"));
  }
}

export const i18n = new I18n();
