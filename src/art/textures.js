import * as THREE from "three";

const cache = new Map();

function canvasTexture(key, size, draw, repeat) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function base(ctx, size, color) {
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, color[0]);
  g.addColorStop(1, color[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

export function woodTexture(theme = "nursery") {
  const palettes = {
    nursery: ["#6b4a33", "#4a3125", "#2a1a15"],
    study: ["#4b3324", "#322018", "#1b120e"],
    garden: ["#3a3b2e", "#25281f", "#151711"],
    attic: ["#5b4028", "#3a2919", "#1f1610"],
    gallery: ["#2a3042", "#191e2e", "#0d101a"],
    weaver: ["#3c2430", "#25141d", "#120a0f"]
  };
  const p = palettes[theme] || palettes.nursery;
  return canvasTexture("wood-" + theme, 512, (ctx, s) => {
    base(ctx, s, p);
    const r = rng(theme.length * 97 + 11);
    const plank = s / 8;
    for (let y = 0; y < s; y += plank) {
      ctx.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.1})`;
      ctx.fillRect(0, y, s, 3);
      ctx.fillStyle = `rgba(255,255,255,${0.015 + r() * 0.03})`;
      ctx.fillRect(0, y + 3, s, 1);
      for (let i = 0; i < 9; i++) {
        ctx.strokeStyle = `rgba(0,0,0,${0.03 + r() * 0.06})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const yy = y + 6 + r() * (plank - 10);
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(s * 0.3, yy + r() * 5, s * 0.7, yy - r() * 5, s, yy + r() * 3);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(0,0,0,.16)";
      const seam = Math.floor(r() * 3) * (s / 3);
      ctx.fillRect(seam, y, 2, plank);
    }
    const gl = ctx.createRadialGradient(s * 0.5, s * 0.4, 20, s * 0.5, s * 0.5, s * 0.7);
    gl.addColorStop(0, "rgba(255,220,160,.10)");
    gl.addColorStop(1, "rgba(0,0,0,.18)");
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, s, s);
  }, [2, 2]);
}

export function wallpaperTexture(theme = "nursery") {
  const data = {
    nursery: { a: "#233f3d", b: "#162c2c", ink: "rgba(224,214,166,.18)", motif: "stars" },
    study: { a: "#32251b", b: "#211811", ink: "rgba(240,191,122,.12)", motif: "lines" },
    garden: { a: "#241d35", b: "#171226", ink: "rgba(201,167,255,.12)", motif: "leaves" },
    attic: { a: "#33271a", b: "#211910", ink: "rgba(255,207,122,.14)", motif: "gears" },
    gallery: { a: "#182136", b: "#0e1424", ink: "rgba(157,199,255,.12)", motif: "diamonds" },
    weaver: { a: "#2b1721", b: "#1a0d14", ink: "rgba(255,185,138,.12)", motif: "webs" }
  }[theme] || {};
  return canvasTexture("wallpaper-" + theme, 512, (ctx, s) => {
    base(ctx, s, [data.a, data.b]);
    ctx.strokeStyle = data.ink;
    ctx.fillStyle = data.ink;
    const r = rng(theme.length * 41 + 3);
    if (data.motif === "stars") {
      for (let i = 0; i < 26; i++) {
        const x = r() * s;
        const y = r() * s;
        const rad = 2 + r() * 5;
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const ang = -Math.PI / 2 + (k * Math.PI * 2) / 5;
          const x1 = x + Math.cos(ang) * rad;
          const y1 = y + Math.sin(ang) * rad;
          const ang2 = ang + Math.PI / 5;
          const x2 = x + Math.cos(ang2) * rad * 0.45;
          const y2 = y + Math.sin(ang2) * rad * 0.45;
          if (k === 0) ctx.moveTo(x1, y1);
          else ctx.lineTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
        ctx.closePath();
        ctx.fill();
      }
      for (let x = 0; x < s; x += 64) {
        ctx.globalAlpha = 0.12;
        ctx.fillRect(x, 0, 1, s);
        ctx.globalAlpha = 1;
      }
    } else if (data.motif === "lines") {
      for (let y = 0; y < s; y += 42) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(s, y);
        ctx.stroke();
      }
      for (let i = 0; i < 16; i++) {
        ctx.globalAlpha = 0.35;
        ctx.fillRect(r() * s, r() * s, 2 + r() * 40, 1);
      }
      ctx.globalAlpha = 1;
    } else if (data.motif === "leaves") {
      for (let i = 0; i < 28; i++) {
        const x = r() * s;
        const y = r() * s;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(r() * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, 0, 6 + r() * 12, 2 + r() * 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (data.motif === "gears") {
      for (let i = 0; i < 8; i++) {
        const x = r() * s;
        const y = r() * s;
        const rad = 12 + r() * 34;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, rad * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
          ctx.lineTo(x + Math.cos(a) * (rad + 5), y + Math.sin(a) * (rad + 5));
          ctx.stroke();
        }
      }
    } else if (data.motif === "diamonds") {
      ctx.lineWidth = 1.2;
      for (let y = -s; y < s * 2; y += 64) {
        for (let x = -s; x < s * 2; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, y + 32);
          ctx.lineTo(x + 32, y);
          ctx.lineTo(x + 64, y + 32);
          ctx.lineTo(x + 32, y + 64);
          ctx.closePath();
          ctx.stroke();
        }
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const cx = r() * s;
        const cy = r() * s;
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * s * 0.35, cy + Math.sin(a) * s * 0.35);
          ctx.stroke();
        }
      }
    }
    const vg = ctx.createLinearGradient(0, 0, 0, s);
    vg.addColorStop(0, "rgba(0,0,0,.24)");
    vg.addColorStop(0.42, "rgba(0,0,0,.02)");
    vg.addColorStop(1, "rgba(0,0,0,.5)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, s, s);
  }, [1, 1]);
}

export function hedgeTexture() {
  return canvasTexture("hedge", 256, (ctx, s) => {
    base(ctx, s, ["#243a2b", "#132117"]);
    const r = rng(77);
    for (let i = 0; i < 380; i++) {
      const x = r() * s;
      const y = r() * s;
      const rad = 2 + r() * 7;
      ctx.fillStyle = `rgba(${70 + r() * 50},${96 + r() * 60},${60 + r() * 40},${0.18 + r() * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    const vg = ctx.createRadialGradient(s * 0.4, s * 0.3, 10, s * 0.5, s * 0.5, s * 0.7);
    vg.addColorStop(0, "rgba(190,255,180,.12)");
    vg.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, s, s);
  }, [2, 2]);
}

export function bookTexture() {
  return canvasTexture("books", 256, (ctx, s) => {
    ctx.fillStyle = "#1c130e";
    ctx.fillRect(0, 0, s, s);
    const r = rng(13);
    const colors = ["#7f4438", "#3f5a4c", "#5b4a72", "#a47746", "#375267", "#7d6a3f"];
    for (let shelf = 0; shelf < 5; shelf++) {
      const y = shelf * (s / 5);
      for (let i = 0; i < 11; i++) {
        const w = 6 + r() * 12;
        const h = s / 5 - 9 - r() * 8;
        ctx.fillStyle = colors[Math.floor(r() * colors.length)];
        ctx.fillRect(i * 22 + 4, y + 6 + (s / 5 - h - 8), w, h);
        ctx.fillStyle = "rgba(240,220,170,.35)";
        ctx.fillRect(i * 22 + 6, y + 12 + (s / 5 - h - 8), w - 4, 2);
      }
      ctx.fillStyle = "#0d0806";
      ctx.fillRect(0, y + s / 5 - 5, s, 6);
    }
  }, [1, 1]);
}

export function rugTexture(colorA = "#2b5450", colorB = "#d9b46a") {
  return canvasTexture("rug-" + colorA, 256, (ctx, s) => {
    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = colorB;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) ctx.strokeRect(16 + i * 10, 16 + i * 10, s - 32 - i * 20, s - 32 - i * 20);
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const rad = s * 0.26 + Math.sin(a * 5) * 8;
      const x = s / 2 + Math.cos(a) * rad;
      const y = s / 2 + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
    const vg = ctx.createRadialGradient(s / 2, s / 2, 20, s / 2, s / 2, s / 2);
    vg.addColorStop(0, "rgba(255,255,255,.05)");
    vg.addColorStop(1, "rgba(0,0,0,.32)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, s, s);
  }, [1, 1]);
}

export function mirrorTexture() {
  return canvasTexture("mirror", 256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, "#566b83");
    g.addColorStop(0.45, "#cfe4f4");
    g.addColorStop(0.6, "#34475e");
    g.addColorStop(1, "#8aa7bd");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(s * 0.1, s * 0.9);
    ctx.lineTo(s * 0.6, s * 0.05);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.15)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s * 0.3, s);
    ctx.lineTo(s * 0.85, s * 0.1);
    ctx.stroke();
  }, [1, 1]);
}

export function webTexture() {
  return canvasTexture("web", 512, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(235,225,210,.32)";
    ctx.lineWidth = 1.4;
    const cx = s / 2;
    const cy = s / 2;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * s * 0.55, cy + Math.sin(a) * s * 0.55);
      ctx.stroke();
    }
    for (let ring = 1; ring < 9; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const sag = ring * 0.03 * Math.sin(a * 8);
        const rad = ring * (s / 18) + sag * s;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [1, 1]);
}

export function glowTexture() {
  return canvasTexture("glow", 128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

export function moonTexture() {
  return canvasTexture("moon", 512, (ctx, s) => {
    const g = ctx.createRadialGradient(s * 0.42, s * 0.38, s * 0.05, s * 0.5, s * 0.5, s * 0.5);
    g.addColorStop(0, "#fff8e6");
    g.addColorStop(0.6, "#f4e3bd");
    g.addColorStop(0.92, "#d9c296");
    g.addColorStop(1, "rgba(217,194,150,0.2)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const r = rng(21);
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = `rgba(150,132,104,${0.05 + r() * 0.1})`;
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 4 + r() * 26, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function starTexture() {
  return canvasTexture("star", 64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,248,220,1)");
    g.addColorStop(0.3, "rgba(255,236,180,.8)");
    g.addColorStop(1, "rgba(255,236,180,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}
