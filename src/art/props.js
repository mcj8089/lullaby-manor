import * as THREE from "three";
import {
  woodTexture,
  wallpaperTexture,
  hedgeTexture,
  bookTexture,
  rugTexture,
  mirrorTexture,
  webTexture,
  glowTexture,
  moonTexture,
  starTexture
} from "./textures.js";
import { CELL } from "../../config/levels.js";

const paintCache = new Map();
const skyCache = new Map();

function paint(color, opts = {}) {
  const key = color + "|" + (opts.map ? opts.map.uuid : "") + "|" + JSON.stringify(opts);
  if (paintCache.has(key)) return paintCache.get(key);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.06,
    ...opts
  });
  mat.userData.shared = true;
  paintCache.set(key, mat);
  return mat;
}

function emissive(color, intensity = 0.8) {
  return paint(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.5 });
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(rTop, rBot, h, mat, x = 0, y = 0, z = 0, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}

function sphere(r, mat, x = 0, y = 0, z = 0, seg = 14) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 2)), mat);
  m.position.set(x, y, z);
  return m;
}

function sprite(color, opacity, scale, map = glowTexture()) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  s.scale.set(scale, scale, 1);
  return s;
}

function shade(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return root;
}

export function disposeTree(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.isMesh || o.isPoints || o.isSprite) {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) {
        if (!mat) continue;
        if (mat.userData && mat.userData.shared) continue;
        if (mat.map && !mat.map.userData.shared) {
          // textures are generated once in textures.js; never dispose the cache
        }
        mat.dispose();
      }
    }
  });
}

/* ------------------------------------------------------------------ sky --- */

const SKIES = {
  nursery: { top: "#04141b", mid: "#0a2b2e", low: "#123f3d", hill: "#05161a", tint: "#8fe3cf" },
  study: { top: "#0a0705", mid: "#22160e", low: "#382415", hill: "#0d0805", tint: "#f0bf7a" },
  garden: { top: "#070414", mid: "#1c1332", low: "#2f2350", hill: "#0a0616", tint: "#c9a7ff" },
  attic: { top: "#0c0703", mid: "#2b1c0f", low: "#42301b", hill: "#0f0905", tint: "#ffcf7a" },
  gallery: { top: "#040915", mid: "#111a2f", low: "#1d2a48", hill: "#050a15", tint: "#9dc7ff" },
  weaver: { top: "#0a0308", mid: "#24101b", low: "#3a1a28", hill: "#0b0409", tint: "#ffb98a" }
};

function skyTexture(theme) {
  if (skyCache.has(theme)) return skyCache.get(theme);
  const pal = SKIES[theme] || SKIES.nursery;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.55, pal.mid);
  g.addColorStop(1, pal.low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);

  let s = 90210 + theme.length * 311;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 220; i++) {
    const x = rand() * 1024;
    const y = rand() * 360;
    const r = rand() * 1.6 + 0.3;
    ctx.fillStyle = `rgba(255,246,220,${0.15 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // cloud banks
  for (let i = 0; i < 7; i++) {
    const x = rand() * 1024;
    const y = 90 + rand() * 190;
    const rx = 80 + rand() * 160;
    const ry = 12 + rand() * 22;
    const cg = ctx.createRadialGradient(x, y, 2, x, y, rx);
    cg.addColorStop(0, `rgba(190,200,230,${0.05 + rand() * 0.05})`);
    cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // distant silhouette
  ctx.fillStyle = pal.hill;
  ctx.beginPath();
  ctx.moveTo(0, 512);
  ctx.lineTo(0, 400);
  for (let x = 0; x <= 1024; x += 32) {
    ctx.lineTo(x, 400 - Math.sin(x * 0.008 + 1.4) * 26 - Math.sin(x * 0.021) * 12);
  }
  ctx.lineTo(1024, 512);
  ctx.closePath();
  ctx.fill();

  // far manor towers
  ctx.fillStyle = pal.hill;
  const towers = theme === "garden" ? [[140, 360, 40, 140], [190, 330, 26, 170], [710, 340, 46, 160], [770, 372, 30, 120]] : [[780, 356, 34, 140], [826, 380, 24, 100]];
  for (const [x, y, w, h] of towers) {
    ctx.fillRect(x, y, w, h);
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + w / 2, y - 46);
    ctx.lineTo(x + w + 8, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,214,150,.5)`;
    ctx.fillRect(x + w * 0.32, y + 28, 7, 10);
    ctx.fillStyle = pal.hill;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  skyCache.set(theme, tex);
  return tex;
}

/* --------------------------------------------------------------- shapes --- */

function archShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true);
  s.lineTo(w / 2, 0);
  s.lineTo(-w / 2, 0);
  return s;
}

function archWindow(w, h, accent) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.ShapeGeometry(archShape(w, h), 20),
    new THREE.MeshStandardMaterial({
      color: "#0a1420",
      emissive: accent,
      emissiveIntensity: 0.16,
      roughness: 0.35,
      metalness: 0.3,
      transparent: true,
      opacity: 0.92
    })
  );
  glass.position.z = 0.02;
  g.add(glass);

  const frameMat = paint("#6b5636", { metalness: 0.4, roughness: 0.5 });
  for (const side of [-1, 1]) {
    const bar = box(0.09, h - w / 2, 0.12, frameMat, side * (w / 2 + 0.03), (h - w / 2) / 2, 0.06);
    g.add(bar);
  }
  const sill = box(w + 0.3, 0.1, 0.26, frameMat, 0, -0.02, 0.1);
  g.add(sill);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(w / 2 + 0.03, 0.055, 8, 28, Math.PI), frameMat);
  arch.position.set(0, h - w / 2, 0.06);
  g.add(arch);
  const mullion = box(0.05, h - 0.15, 0.09, frameMat, 0, (h - 0.15) / 2, 0.06);
  g.add(mullion);
  const cross = box(w - 0.06, 0.05, 0.09, frameMat, 0, h * 0.52, 0.06);
  g.add(cross);

  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: moonTexture(),
      color: "#fff0cf",
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    })
  );
  moon.scale.set(w * 0.66, w * 0.66, 1);
  moon.position.set(w * 0.1, h * 0.56, 0.16);
  g.add(moon);

  const halo = sprite(accent, 0.2, w * 1.7);
  halo.position.set(0, h * 0.55, 0.2);
  g.add(halo);
  return g;
}

function makeFrame(w, h, accent, art) {
  const g = new THREE.Group();
  const frameMat = paint("#7d6238", { metalness: 0.5, roughness: 0.4 });
  g.add(box(w + 0.24, h + 0.24, 0.08, frameMat, 0, 0, 0));
  const inner = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color: art, roughness: 0.9, emissive: art, emissiveIntensity: 0.14 })
  );
  inner.position.z = 0.05;
  g.add(inner);
  const bar = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.7, h * 0.06),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending })
  );
  bar.position.set(0, h * 0.24, 0.07);
  bar.rotation.z = -0.12;
  g.add(bar);
  return g;
}

/* ----------------------------------------------------------- room shell --- */

const RUG = {
  nursery: ["#244f4a", "#d9b46a"],
  study: ["#3a2a1d", "#c99a58"],
  garden: ["#2c2444", "#c9a7ff"],
  attic: ["#382817", "#e0b06a"],
  gallery: ["#1c2740", "#9dc7ff"],
  weaver: ["#341824", "#ffb98a"]
};

export function createRoomShell(theme) {
  const pal = SKIES[theme] || SKIES.nursery;
  const group = new THREE.Group();
  const W = 11 * CELL;
  const D = 8 * CELL;
  const accent = pal.tint;

  const floor = box(W + 0.5, 0.42, D + 0.5, paint("#3a2c1f", { map: woodTexture(theme), roughness: 0.9 }), 0, -0.21, 0);
  floor.castShadow = false;
  floor.receiveShadow = true;
  group.add(floor);

  const rimMat = paint("#17110c", { roughness: 0.7, metalness: 0.15 });
  group.add(box(W + 0.9, 0.26, 0.22, rimMat, 0, -0.16, D / 2 + 0.32));
  group.add(box(W + 0.9, 0.26, 0.22, rimMat, 0, -0.16, -D / 2 - 0.32));

  const rugColors = RUG[theme] || RUG.nursery;
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(4.9, 3.3),
    new THREE.MeshStandardMaterial({ map: rugTexture(rugColors[0], rugColors[1]), roughness: 0.95 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, 0.5);
  rug.receiveShadow = true;
  group.add(rug);

  const wallMat = paint("#34312b", { map: wallpaperTexture(theme), roughness: 0.92 });
  const back = box(W + 0.5, 5.4, 0.3, wallMat, 0, 2.7, -D / 2 - 0.15);
  back.castShadow = false;
  group.add(back);

  const wainscot = paint("#2c2118", { map: woodTexture(theme), roughness: 0.7 });
  group.add(box(W + 0.6, 0.95, 0.4, wainscot, 0, 0.475, -D / 2 + 0.03));
  const rail = box(W + 0.7, 0.08, 0.46, paint("#8a6a3c", { metalness: 0.4, roughness: 0.45 }), 0, 0.95, -D / 2 + 0.02);
  group.add(rail);
  group.add(box(W + 0.7, 0.16, 0.46, paint("#241a12"), 0, 5.34, -D / 2 + 0.02));
  group.add(box(W + 0.8, 0.1, 0.5, paint("#8a6a3c", { metalness: 0.45, roughness: 0.4 }), 0, 5.26, -D / 2 + 0.03));

  for (const side of [-1, 1]) {
    group.add(box(0.34, 0.55, D + 0.4, wainscot, side * (W / 2 + 0.12), -0.02, 0));
    group.add(box(0.34, 0.08, D + 0.4, paint("#8a6a3c", { metalness: 0.4 }), side * (W / 2 + 0.12), 0.26, 0));
  }

  // sky card behind the diorama
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 19),
    new THREE.MeshBasicMaterial({ map: skyTexture(theme), fog: false })
  );
  sky.position.set(0, 7.6, -13.5);
  group.add(sky);
  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: moonTexture(),
      color: "#fff4da",
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    })
  );
  moon.scale.set(6.2, 6.2, 1);
  moon.position.set(7.2, 9.4, -13.2);
  group.add(moon);
  const moonHalo = sprite(accent, 0.16, 11);
  moonHalo.position.set(7.2, 9.4, -13.3);
  group.add(moonHalo);

  const dust = createDust(accent, 70);
  group.add(dust);

  // theme-specific back wall dressing
  const win = archWindow(2.15, 3.1, accent);
  win.position.set(theme === "gallery" ? -4.8 : -3.1, 1.55, -D / 2 + 0.04);
  group.add(win);

  const trimGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.4, 0.035),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending })
  );
  trimGlow.position.set(0, 0.96, -D / 2 + 0.27);
  group.add(trimGlow);

  if (theme === "nursery") {
    for (const [x, y, s] of [[3.6, 3.9, 2.6], [5.6, 2.3, 2.0]]) {
      const f = makeFrame(1.35 * s * 0.5, 1.0 * s * 0.5, accent, "#2d5c56");
      f.position.set(x, y, -D / 2 + 0.03);
      group.add(f);
    }
    const garland = new THREE.Group();
    for (let i = 0; i < 11; i++) {
      const st = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: starTexture(), color: "#ffe3a0", transparent: true, opacity: 0.8, depthWrite: false })
      );
      st.scale.set(0.34, 0.34, 1);
      st.position.set(-5.6 + i * 1.1, 4.25 - Math.sin((i / 10) * Math.PI) * 0.5, -D / 2 + 0.3);
      garland.add(st);
    }
    group.add(garland);
    const mobile = new THREE.Group();
    mobile.position.set(4.2, 4.95, -2.5);
    mobile.add(cyl(0.02, 0.02, 1.2, paint("#8a6a3c"), 0, 0.6, 0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 6, 24), paint("#b98d4e", { metalness: 0.6 }));
    ring.rotation.x = Math.PI / 2;
    mobile.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const s = sphere(0.13, emissive(["#8fe3cf", "#ffd98a", "#c9a7ff", "#ffb0c8"][i], 0.5), Math.cos(a) * 0.62, -0.35, Math.sin(a) * 0.62, 10);
      s.scale.set(1, 1.3, 0.4);
      mobile.add(s);
      mobile.add(cyl(0.008, 0.008, 0.45, paint("#b98d4e"), Math.cos(a) * 0.62, -0.12, Math.sin(a) * 0.62, 5));
    }
    mobile.userData.spin = true;
    group.add(mobile);
    group.userData.mobile = mobile;
  } else if (theme === "study") {
    const shelf = new THREE.Group();
    shelf.position.set(3.4, 0, -D / 2 + 0.42);
    const shelfMat = paint("#3a281a", { map: woodTexture("study") });
    shelf.add(box(4.0, 2.65, 0.5, shelfMat, 0, 1.35, 0));
    const books = new THREE.Mesh(
      new THREE.PlaneGeometry(3.7, 2.2),
      new THREE.MeshStandardMaterial({ map: bookTexture(), roughness: 0.9 })
    );
    books.position.set(0, 1.38, 0.27);
    shelf.add(books);
    group.add(shelf);
    const lamp = new THREE.PointLight(0xffb060, 1.2, 7, 2);
    lamp.position.set(-5.2, 3.2, -4.6);
    group.add(lamp);
    group.add(sprite("#ffb060", 0.5, 1.2).translateX(-5.2).translateY(3.2).translateZ(-4.55));
    const candle = cilLamp(-5.2, 3.0, -4.6);
    group.add(candle);
    const f = makeFrame(1.7, 1.2, accent, "#4a3622");
    f.position.set(5.9, 3.7, -D / 2 + 0.03);
    group.add(f);
  } else if (theme === "garden") {
    const trellis = new THREE.Group();
    trellis.position.set(-3.1, 1.2, -D / 2 + 0.28);
    const vineMat = paint("#2f4a2c");
    for (let i = 0; i < 7; i++) {
      const v = box(0.06, 3.6 + Math.sin(i) * 0.5, 0.06, vineMat, -1.8 + i * 0.6, 1.4, 0);
      v.rotation.z = Math.sin(i * 1.7) * 0.1;
      trellis.add(v);
    }
    for (let i = 0; i < 20; i++) {
      const leaf = sphere(0.15, paint(i % 3 ? "#38553a" : "#4b6b45"), -2 + Math.random() * 4, 0.5 + Math.random() * 3.2, 0.12, 7);
      leaf.scale.set(1.3, 0.4, 0.3);
      leaf.rotation.z = Math.random() * 3;
      trellis.add(leaf);
    }
    group.add(trellis);
    for (const x of [-6.6, 5.6]) {
      const pot = new THREE.Group();
      pot.position.set(x, 0, -D / 2 + 0.75);
      pot.add(cyl(0.34, 0.24, 0.55, paint("#4a3524"), 0, 0.28, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        pot.add(sphere(0.26, paint(["#3c5c3a", "#4a6c44", "#33512f"][i % 3]), Math.cos(a) * 0.22, 0.72 + Math.sin(i * 2) * 0.16, Math.sin(a) * 0.22, 9));
      }
      group.add(pot);
    }
    const f = makeFrame(1.5, 2.0, accent, "#33284f");
    f.position.set(5.6, 3.4, -D / 2 + 0.03);
    group.add(f);
  } else if (theme === "attic") {
    const beamMat = paint("#382616", { map: woodTexture("attic") });
    for (const x of [-6.4, -1.6, 3.2]) {
      group.add(box(0.26, 3.0, 0.22, beamMat, x, 3.7, -D / 2 + 0.3));
    }
    group.add(box(8.4, 0.24, 0.24, beamMat, 0, 4.6, -D / 2 + 0.3));
    const bulb = new THREE.PointLight(0xffb264, 1.5, 8, 2);
    bulb.position.set(2.4, 3.4, -2.2);
    group.add(bulb);
    group.add(cyl(0.012, 0.012, 1.9, paint("#161616"), 2.4, 4.35, -2.2, 5));
    group.add(sphere(0.11, emissive("#ffc880", 1.4), 2.4, 3.4, -2.2, 8));
    group.add(sprite("#ffb264", 0.6, 1.3).translateX(2.4).translateY(3.4).translateZ(-2.2));
    const f = makeFrame(1.3, 1.7, accent, "#453120");
    f.position.set(-4.8, 3.5, -D / 2 + 0.03);
    f.rotation.z = 0.04;
    group.add(f);
  } else if (theme === "gallery") {
    for (const [x, col] of [[3.2, "#2c4466"], [5.9, "#4a3a5e"]]) {
      const f = makeFrame(1.8, 2.4, accent, col);
      f.position.set(x, 3.1, -D / 2 + 0.03);
      group.add(f);
    }
    const ropeMat = paint("#7c2f38", { roughness: 0.9 });
    for (const x of [-5.8, 5.8]) {
      group.add(cyl(0.045, 0.045, 1.05, paint("#8a6a3c", { metalness: 0.7 }), x, 0.52, -D / 2 + 0.9, 8));
      group.add(sphere(0.07, paint("#8a6a3c", { metalness: 0.7 }), x, 1.06, -D / 2 + 0.9, 8));
    }
    const rope = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-5.8, 1.05, -6.1),
          new THREE.Vector3(0, 0.62, -6.0),
          new THREE.Vector3(5.8, 1.05, -6.1)
        ]),
        24,
        0.03,
        6,
        false
      ),
      ropeMat
    );
    group.add(rope);
    const spot = new THREE.PointLight(0x9dc7ff, 1.05, 8, 2);
    spot.position.set(0, 4.3, -4.2);
    group.add(spot);
    group.add(sprite("#9dc7ff", 0.35, 4.2).translateY(0.12).translateZ(-6.4));
  } else if (theme === "weaver") {
    const web = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 4.6),
      new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    web.position.set(0, 3.1, -D / 2 + 0.32);
    group.add(web);
    for (const x of [-5.6, -2.8, 2.8, 5.6]) {
      const cocoon = new THREE.Group();
      cocoon.position.set(x, 0, -D / 2 + 0.85);
      cocoon.add(cyl(0.2, 0.28, 0.7, paint("#3a1d2a"), 0, 0.35, 0));
      const sac = sphere(0.46, paint("#e8dcc8", { roughness: 0.95 }), 0, 1.05, 0, 12);
      sac.scale.set(0.85, 1.5, 0.85);
      cocoon.add(sac);
      for (let i = 0; i < 3; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 5, 16), paint("#bdb2a0"));
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.75 + i * 0.28;
        band.scale.set(1 - i * 0.08, 1 - i * 0.08, 1);
        cocoon.add(band);
      }
      group.add(cocoon);
    }
    const rose = new THREE.PointLight(0xffb98a, 1.4, 9, 2);
    rose.position.set(0, 3.6, -3.4);
    group.add(rose);
    group.add(sprite("#ffb98a", 0.3, 5).translateY(0.2).translateZ(-6.5));
  }

  group.userData.theme = theme;
  group.userData.accent = accent;
  group.userData.bounds = { halfW: W / 2 - 0.4, halfD: D / 2 - 0.4 };
  return group;
}

function cilLamp(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.add(cyl(0.05, 0.07, 0.26, paint("#c9b48c"), 0, 0, 0, 8));
  g.add(sphere(0.045, emissive("#ffd28a", 1.4), 0, 0.17, 0, 6));
  return g;
}

export function createDust(color, count = 60) {
  const pos = new Float32Array(count * 3);
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 17;
    const y = 0.4 + Math.random() * 4.2;
    const z = (Math.random() - 0.5) * 12;
    pos.set([x, y, z], i * 3);
    seeds.push({ x, y, z, sp: 0.1 + Math.random() * 0.25, ph: Math.random() * 10 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 0.05,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    map: glowTexture(),
    sizeAttenuation: true
  });
  const points = new THREE.Points(geo, mat);
  let t = 0;
  points.userData.update = (dt) => {
    t += dt;
    const arr = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      arr[i * 3] = s.x + Math.sin(t * 0.22 + s.ph) * 0.55;
      arr[i * 3 + 1] = s.y + Math.sin(t * s.sp + s.ph) * 0.3;
      arr[i * 3 + 2] = s.z + Math.cos(t * 0.18 + s.ph) * 0.4;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return points;
}

/* -------------------------------------------------------------- obstacles --- */

function crib(accent) {
  const g = new THREE.Group();
  const wood = paint("#8a6642", { roughness: 0.65 });
  const light = paint("#c8a06a", { roughness: 0.6 });
  for (const x of [-0.62, 0.62]) {
    for (const z of [-0.45, 0.45]) g.add(cyl(0.06, 0.06, 1.0, wood, x, 0.5, z, 8));
  }
  for (const z of [-0.45, 0.45]) {
    g.add(box(1.24, 0.09, 0.09, light, 0, 0.96, z));
    g.add(box(1.24, 0.09, 0.09, light, 0, 0.15, z));
    for (let i = 0; i < 7; i++) g.add(cyl(0.022, 0.022, 0.72, light, -0.54 + i * 0.18, 0.56, z, 5));
  }
  g.add(box(1.3, 0.16, 1.0, paint("#6e4f34"), 0, 0.78, 0));
  const blanket = box(0.9, 0.07, 0.72, paint(accent, { roughness: 0.95 }), 0, 0.88, 0.02);
  g.add(blanket);
  g.add(sphere(0.16, paint("#f2e6cf"), -0.24, 0.96, -0.1, 10));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.028, 6, 24), paint("#d9b46a", { metalness: 0.5 }));
  ring.position.set(0, 1.02, 0.4);
  g.add(ring);
  return g;
}

function toyChest() {
  const g = new THREE.Group();
  const wood = paint("#75502f", { roughness: 0.7 });
  g.add(box(1.25, 0.62, 0.85, wood, 0, 0.31, 0));
  const lid = box(1.28, 0.25, 0.88, paint("#8a6039"), 0, 0.72, -0.02);
  lid.rotation.x = -0.16;
  g.add(lid);
  g.add(box(0.18, 0.16, 0.06, paint("#d9b46a", { metalness: 0.7, roughness: 0.3 }), 0, 0.56, 0.44));
  g.add(box(1.3, 0.07, 0.9, paint("#3a281a"), 0, 0.06, 0));
  return g;
}

function blocks() {
  const g = new THREE.Group();
  const colors = ["#c97a6a", "#6a9a8a", "#c9a76a"];
  for (let i = 0; i < 3; i++) {
    const b = box(0.42, 0.42, 0.42, paint(colors[i]), (i - 1) * 0.3, 0.21 + i * 0.36, (i % 2) * 0.18);
    b.rotation.y = i * 0.4;
    g.add(b);
    const letter = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.2),
      new THREE.MeshBasicMaterial({ color: "#fff3d4", transparent: true, opacity: 0.8 })
    );
    letter.position.set((i - 1) * 0.3, 0.21 + i * 0.36, (i % 2) * 0.18 + 0.215);
    letter.rotation.y = i * 0.4;
    g.add(letter);
  }
  return g;
}

function rockingHorse() {
  const g = new THREE.Group();
  const wood = paint("#a97c47", { roughness: 0.6 });
  for (const s of [-1, 1]) {
    const rocker = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.045, 6, 22, Math.PI * 0.62), wood);
    rocker.rotation.z = Math.PI * 0.19;
    rocker.position.set(0, 0.1, s * 0.26);
    rocker.rotation.x = Math.PI / 2;
    g.add(rocker);
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.46, 6, 10), wood);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.64;
  g.add(body);
  const neck = box(0.16, 0.42, 0.16, wood, 0.34, 0.86, 0);
  neck.rotation.z = -0.32;
  g.add(neck);
  g.add(sphere(0.16, wood, 0.47, 1.05, 0, 10));
  g.add(box(0.2, 0.09, 0.11, paint("#7a5530"), 0.57, 0.99, 0));
  for (const [x, z] of [[-0.26, -0.16], [-0.26, 0.16], [0.26, -0.16], [0.26, 0.16]]) {
    g.add(cyl(0.032, 0.032, 0.34, wood, x, 0.44, z, 6));
  }
  const mane = paint("#5a3c25");
  for (let i = 0; i < 4; i++) g.add(box(0.06, 0.14, 0.1, mane, 0.28 - i * 0.07, 0.9 - i * 0.06, 0));
  return g;
}

function dresser() {
  const g = new THREE.Group();
  const wood = paint("#6d4a2e", { roughness: 0.65 });
  g.add(box(1.25, 1.15, 0.66, wood, 0, 0.575, 0));
  for (let i = 0; i < 3; i++) {
    g.add(box(1.1, 0.28, 0.05, paint("#8a6039"), 0, 0.28 + i * 0.34, 0.35));
    for (const s of [-1, 1]) g.add(sphere(0.04, paint("#d9b46a", { metalness: 0.8, roughness: 0.25 }), s * 0.26, 0.28 + i * 0.34, 0.39, 8));
  }
  g.add(box(1.3, 0.06, 0.7, paint("#3d2a1b"), 0, 1.17, 0));
  g.add(box(0.26, 0.2, 0.18, paint("#9d7a4c"), -0.34, 1.3, 0));
  g.add(sphere(0.13, paint("#d9b46a"), 0.3, 1.28, 0, 10));
  return g;
}

function teddy() {
  const g = new THREE.Group();
  const fur = paint("#b58a63", { roughness: 0.95 });
  const torso = sphere(0.38, fur, 0, 0.45, 0, 14);
  torso.scale.set(1, 1.05, 0.85);
  g.add(torso);
  const head = sphere(0.29, fur, 0, 0.98, 0.02, 14);
  g.add(head);
  for (const s of [-1, 1]) {
    g.add(sphere(0.12, fur, s * 0.22, 1.16, 0, 10));
    g.add(sphere(0.06, paint("#e0c9a8"), s * 0.22, 1.16, 0.09, 8));
    g.add(sphere(0.04, paint("#20140c"), s * 0.1, 1.02, 0.27, 8));
    g.add(sphere(0.18, fur, s * 0.42, 0.6, 0, 10));
    g.add(sphere(0.17, fur, s * 0.2, 0.13, 0.14, 10));
  }
  g.add(sphere(0.11, paint("#e0c9a8"), 0, 0.9, 0.26, 10));
  g.add(sphere(0.045, paint("#20140c"), 0, 0.95, 0.36, 8));
  g.add(box(0.42, 0.06, 0.05, paint(accentStitch(), { roughness: 0.9 }), 0, 0.52, 0.31));
  return g;
}

function accentStitch() {
  return "#8fe3cf";
}

function bookshelf() {
  const g = new THREE.Group();
  const wood = paint("#382618", { roughness: 0.8 });
  g.add(box(1.42, 2.3, 0.62, wood, 0, 1.15, 0));
  const books = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.95),
    new THREE.MeshStandardMaterial({ map: bookTexture(), roughness: 0.9 })
  );
  books.position.set(0, 1.15, 0.32);
  g.add(books);
  for (let i = 0; i < 3; i++) g.add(box(1.5, 0.07, 0.68, paint("#231810"), 0, 0.36 + i * 0.66, 0));
  g.add(box(1.5, 0.1, 0.7, paint("#5c4227"), 0, 2.34, 0));
  return g;
}

function desk() {
  const g = new THREE.Group();
  const wood = paint("#4a3320", { roughness: 0.7 });
  g.add(box(1.4, 0.1, 0.92, wood, 0, 0.78, 0));
  for (const [x, z] of [[-0.58, -0.36], [0.58, -0.36], [-0.58, 0.36], [0.58, 0.36]]) {
    g.add(cyl(0.045, 0.05, 0.76, wood, x, 0.38, z, 6));
  }
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.36), new THREE.MeshStandardMaterial({ color: "#e8dcc0", roughness: 0.9 }));
  page.rotation.x = -Math.PI / 2;
  page.rotation.z = 0.2;
  page.position.set(0.16, 0.84, 0.06);
  g.add(page);
  g.add(box(0.16, 0.08, 0.22, paint("#c9b48c"), -0.3, 0.87, 0));
  g.add(cyl(0.03, 0.03, 0.2, paint("#e6d8b8"), -0.3, 1.0, 0, 6));
  g.add(sphere(0.035, emissive("#ffd28a", 1.4), -0.3, 1.12, 0, 6));
  g.add(box(0.4, 0.22, 0.3, paint("#5b3a26"), 0.44, 0.9, -0.2));
  return g;
}

function globe() {
  const g = new THREE.Group();
  g.add(cyl(0.28, 0.34, 0.08, paint("#5a4028"), 0, 0.04, 0, 12));
  g.add(cyl(0.04, 0.05, 0.5, paint("#6d5333"), 0, 0.3, 0, 8));
  const globeMesh = sphere(0.3, paint("#3f6b74", { roughness: 0.5, metalness: 0.2 }), 0, 0.72, 0, 18);
  g.add(globeMesh);
  const land = paint("#7d8a55", { roughness: 0.7 });
  for (let i = 0; i < 5; i++) {
    const p = sphere(0.1 + Math.random() * 0.05, land, 0, 0.72, 0, 8);
    const a = Math.random() * 6.28;
    const b = Math.random() * 2 - 1;
    p.position.set(Math.cos(a) * 0.27, 0.72 + b * 0.24, Math.sin(a) * 0.27);
    p.scale.set(1.2, 0.7, 1.2);
    g.add(p);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 6, 24), paint("#b08d52", { metalness: 0.7 }));
  ring.rotation.x = 0.3;
  ring.position.y = 0.72;
  g.add(ring);
  return g;
}

function armchair() {
  const g = new THREE.Group();
  const cloth = paint("#5e3f3a", { roughness: 0.95 });
  g.add(box(0.9, 0.24, 0.86, cloth, 0, 0.4, 0));
  g.add(box(0.9, 0.8, 0.18, cloth, 0, 0.78, -0.36));
  for (const s of [-1, 1]) {
    g.add(box(0.16, 0.4, 0.86, paint("#6b4a43", { roughness: 0.95 }), s * 0.44, 0.62, 0));
    g.add(box(0.12, 0.32, 0.14, paint("#4a3020"), s * 0.42, 0.19, 0.32));
    g.add(box(0.12, 0.32, 0.14, paint("#4a3020"), s * 0.42, 0.19, -0.32));
  }
  g.add(box(0.7, 0.12, 0.6, paint("#7a5d45", { roughness: 0.9 }), 0, 0.55, 0.06));
  return g;
}

function bookStack() {
  const g = new THREE.Group();
  const colors = ["#7a3d33", "#3c5a4a", "#5d4a72", "#a5784a"];
  for (let i = 0; i < 5; i++) {
    const b = box(0.72 - i * 0.04, 0.13, 0.5 - i * 0.02, paint(colors[i % 4], { roughness: 0.9 }), (i % 2) * 0.04 - 0.02, 0.065 + i * 0.135, 0);
    b.rotation.y = (i % 2 ? -1 : 1) * 0.14;
    g.add(b);
  }
  return g;
}

function grandfatherClock() {
  const g = new THREE.Group();
  const wood = paint("#4b3421", { roughness: 0.6 });
  g.add(box(0.6, 1.7, 0.38, wood, 0, 0.85, 0));
  g.add(box(0.5, 0.5, 0.06, paint("#1a120c"), 0, 1.45, 0.2));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), paint("#e5d8ba", { roughness: 0.5 }));
  face.position.set(0, 1.45, 0.24);
  g.add(face);
  const hand = box(0.02, 0.16, 0.015, paint("#251a10"), 0, 1.5, 0.255);
  g.add(hand);
  const hand2 = box(0.02, 0.11, 0.015, paint("#251a10"), 0.05, 1.45, 0.255);
  hand2.rotation.z = -1.1;
  g.add(hand2);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.85), new THREE.MeshStandardMaterial({ color: "#1c160e", metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.7 }));
  glass.position.set(0, 0.68, 0.2);
  g.add(glass);
  const pendulum = box(0.03, 0.55, 0.02, paint("#c9a35a", { metalness: 0.8 }), 0, 0.92, 0.08);
  pendulum.geometry.translate(0, -0.24, 0);
  pendulum.position.y = 1.08;
  pendulum.rotation.z = 0.24;
  pendulum.userData.swing = true;
  g.add(pendulum);
  g.userData.swing = pendulum;
  return g;
}

function hedge() {
  const g = new THREE.Group();
  const leaf = paint("#39543a", { map: hedgeTexture(), roughness: 0.95 });
  g.add(box(1.35, 1.0, 1.2, leaf, 0, 0.5, 0));
  for (let i = 0; i < 6; i++) {
    const b = sphere(0.28 + Math.random() * 0.14, leaf, (Math.random() - 0.5) * 1.1, 1.05 + Math.random() * 0.2, (Math.random() - 0.5) * 0.9, 9);
    b.scale.y = 0.75;
    g.add(b);
  }
  return g;
}

function statue() {
  const g = new THREE.Group();
  const stone = paint("#7f8074", { roughness: 0.92 });
  g.add(box(0.8, 0.5, 0.8, paint("#555a50", { roughness: 0.95 }), 0, 0.25, 0));
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.0, 10), stone);
  robe.position.y = 1.05;
  g.add(robe);
  g.add(sphere(0.19, stone, 0, 1.66, 0, 12));
  g.add(cyl(0.055, 0.065, 0.5, stone, -0.26, 1.28, 0.03, 6));
  g.add(cyl(0.055, 0.065, 0.5, stone, 0.26, 1.28, 0.03, 6));
  const wing = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 4), stone);
  wing.scale.set(1, 1, 0.18);
  wing.position.set(-0.3, 1.5, -0.2);
  wing.rotation.z = 0.5;
  g.add(wing);
  const wing2 = wing.clone();
  wing2.position.x = 0.3;
  wing2.rotation.z = -0.5;
  g.add(wing2);
  return g;
}

function fountain() {
  const g = new THREE.Group();
  const stone = paint("#6d7068", { roughness: 0.9 });
  g.add(cyl(0.66, 0.74, 0.3, stone, 0, 0.15, 0, 16));
  g.add(cyl(0.56, 0.62, 0.12, paint("#4f5c5e", { roughness: 0.4 }), 0, 0.34, 0, 16));
  g.add(cyl(0.1, 0.13, 0.6, stone, 0, 0.65, 0, 10));
  g.add(cyl(0.34, 0.12, 0.18, stone, 0, 1.0, 0, 14));
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.44, 18),
    new THREE.MeshStandardMaterial({ color: "#7ab7ba", transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.3, emissive: "#2b5a5c", emissiveIntensity: 0.3 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.38;
  g.add(water);
  const jet = cyl(0.03, 0.05, 0.5, new THREE.MeshBasicMaterial({ color: "#bfe8e2", transparent: true, opacity: 0.5 }), 0, 1.32, 0, 8);
  g.add(jet);
  for (let i = 0; i < 5; i++) {
    const s = sprite("#bfe8e2", 0.3, 0.5);
    s.position.set(Math.sin(i * 1.9) * 0.3, 1.1 + Math.random() * 0.3, Math.cos(i * 1.9) * 0.3);
    g.add(s);
  }
  return g;
}

function flowerBed() {
  const g = new THREE.Group();
  g.add(box(1.2, 0.32, 1.0, paint("#39352a", { roughness: 1 }), 0, 0.16, 0));
  const stem = paint("#41623c");
  const colors = ["#c9a7ff", "#ffd0e0", "#ffe39a", "#bcdcff"];
  for (let i = 0; i < 9; i++) {
    const x = (Math.random() - 0.5) * 0.95;
    const z = (Math.random() - 0.5) * 0.72;
    const h = 0.28 + Math.random() * 0.24;
    g.add(cyl(0.012, 0.016, h, stem, x, 0.32 + h / 2, z, 5));
    g.add(sphere(0.075 + Math.random() * 0.035, emissive(colors[i % 4], 0.35), x, 0.34 + h, z, 8));
  }
  return g;
}

function gardenBench() {
  const g = new THREE.Group();
  const stone = paint("#767b6d", { roughness: 0.95 });
  g.add(box(1.3, 0.12, 0.44, stone, 0, 0.44, 0));
  g.add(box(1.3, 0.34, 0.1, stone, 0, 0.72, -0.2));
  for (const s of [-1, 1]) g.add(box(0.14, 0.42, 0.4, stone, s * 0.5, 0.21, 0));
  return g;
}

function topiary() {
  const g = new THREE.Group();
  g.add(cyl(0.26, 0.3, 0.36, paint("#4a3927"), 0, 0.18, 0, 10));
  const leaf = paint("#3c5a3c", { map: hedgeTexture(), roughness: 0.95 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.25, 12), leaf);
  cone.position.y = 0.95;
  g.add(cone);
  g.add(sphere(0.3, leaf, 0, 1.58, 0, 10));
  return g;
}

function crate() {
  const g = new THREE.Group();
  const wood = paint("#6d5133", { roughness: 0.85 });
  g.add(box(1.15, 1.0, 1.05, wood, 0, 0.5, 0));
  for (const s of [-1, 1]) {
    g.add(box(1.18, 0.1, 1.08, paint("#4a3722"), s * 0.28, 0.5, 0));
    g.add(box(1.18, 1.0, 0.1, paint("#4a3722"), 0, 0.5, s * 0.54));
  }
  const straw = paint("#b49a6a", { roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const s = box(0.5, 0.03, 0.04, straw, (Math.random() - 0.5) * 0.6, 1.02, (Math.random() - 0.5) * 0.7);
    s.rotation.z = Math.random();
    g.add(s);
  }
  return g;
}

function trunk() {
  const g = new THREE.Group();
  const leather = paint("#4c3326", { roughness: 0.75 });
  g.add(box(1.25, 0.62, 0.8, leather, 0, 0.31, 0));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.24, 14, 1, false, 0, Math.PI), leather);
  lid.rotation.z = Math.PI / 2;
  lid.position.set(0, 0.62, -0.4);
  g.add(lid);
  for (const x of [-0.5, 0.5]) {
    g.add(box(0.12, 0.68, 0.84, paint("#2f1f15"), x, 0.32, 0));
    g.add(box(0.16, 0.12, 0.1, paint("#c2a35c", { metalness: 0.7, roughness: 0.3 }), x, 0.44, 0.42));
  }
  return g;
}

function dressForm() {
  const g = new THREE.Group();
  const cloth = paint("#b9ae99", { roughness: 1 });
  g.add(cyl(0.22, 0.28, 0.1, paint("#403020"), 0, 0.05, 0, 12));
  g.add(cyl(0.03, 0.04, 0.8, paint("#5b4229"), 0, 0.42, 0, 8));
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.42, 8, 12), cloth);
  body.position.y = 1.12;
  body.scale.set(1, 1, 0.72);
  g.add(body);
  g.add(cyl(0.14, 0.2, 0.2, cloth, 0, 1.56, 0, 10));
  g.add(cyl(0.08, 0.12, 0.12, cloth, 0, 1.7, 0, 8));
  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.025, 6, 20), paint("#8d5b4d"));
  ribbon.rotation.x = Math.PI / 2;
  ribbon.position.y = 1.24;
  g.add(ribbon);
  return g;
}

function hatBoxes() {
  const g = new THREE.Group();
  const colors = ["#7b5a72", "#5a6b72", "#8a6a4a"];
  for (let i = 0; i < 3; i++) {
    const r = 0.38 - i * 0.06;
    g.add(cyl(r, r, 0.24, paint(colors[i], { roughness: 0.9 }), (i % 2) * 0.1 - 0.05, 0.12 + i * 0.25, 0, 14));
    g.add(cyl(r + 0.02, r + 0.02, 0.03, paint("#d9c9a8"), (i % 2) * 0.1 - 0.05, 0.25 + i * 0.25, 0, 14));
  }
  return g;
}

function sheetedChair() {
  const g = new THREE.Group();
  const sheet = paint("#cfc7b4", { roughness: 1 });
  const blanket = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.3, 8), sheet);
  blanket.position.y = 0.65;
  g.add(blanket);
  const crown = sphere(0.32, sheet, 0, 1.16, 0, 10);
  crown.scale.set(1, 0.8, 1);
  g.add(crown);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 4, 16), paint("#a99f8c"));
  seam.rotation.x = Math.PI / 2;
  seam.position.y = 0.72;
  g.add(seam);
  return g;
}

function birdcage() {
  const g = new THREE.Group();
  const metal = paint("#5c5142", { metalness: 0.7, roughness: 0.4 });
  g.add(cyl(0.34, 0.38, 0.08, metal, 0, 0.04, 0, 12));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bar = cyl(0.012, 0.012, 0.95, metal, Math.cos(a) * 0.28, 0.55, Math.sin(a) * 0.28, 4);
    g.add(bar);
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal);
  dome.position.y = 1.02;
  g.add(dome);
  const swing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.01, 4, 12, Math.PI), metal);
  swing.position.set(0, 0.72, 0);
  swing.rotation.x = Math.PI / 2;
  g.add(swing);
  g.add(sphere(0.06, paint("#d9b46a"), 0, 0.62, 0, 8));
  return g;
}

function galleryPlinth() {
  const g = new THREE.Group();
  const stone = paint("#8d8b80", { roughness: 0.85 });
  g.add(box(0.72, 0.9, 0.72, stone, 0, 0.45, 0));
  g.add(box(0.86, 0.1, 0.86, paint("#63645c"), 0, 0.9, 0));
  g.add(box(0.62, 0.16, 0.62, paint("#b8b3a2"), 0, 0.98, 0));
  const bust = new THREE.Group();
  bust.position.y = 1.06;
  bust.add(cyl(0.16, 0.26, 0.34, paint("#d7d2c2", { roughness: 0.7 }), 0, 0.17, 0, 12));
  bust.add(sphere(0.19, paint("#e2ddcc", { roughness: 0.6 }), 0, 0.48, 0.02, 14));
  const hair = sphere(0.2, paint("#8b8780", { roughness: 0.9 }), 0, 0.52, -0.04, 12);
  hair.scale.set(1.05, 0.8, 1);
  bust.add(hair);
  g.add(bust);
  return g;
}

function urn() {
  const g = new THREE.Group();
  const stone = paint("#7e7c70", { roughness: 0.85 });
  g.add(cyl(0.3, 0.4, 0.14, stone, 0, 0.07, 0, 14));
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 12), stone);
  body.scale.set(1, 1.15, 1);
  body.position.y = 0.55;
  g.add(body);
  g.add(cyl(0.16, 0.3, 0.24, stone, 0, 0.92, 0, 12));
  g.add(cyl(0.22, 0.18, 0.08, stone, 0, 1.06, 0, 12));
  for (const s of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 14, Math.PI), stone);
    handle.position.set(s * 0.34, 0.6, 0);
    handle.rotation.z = s * Math.PI / 2;
    g.add(handle);
  }
  return g;
}

function column() {
  const g = new THREE.Group();
  const stone = paint("#8b8778", { roughness: 0.88 });
  g.add(box(0.6, 0.14, 0.6, stone, 0, 0.07, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(cyl(0.055, 0.065, 1.7, stone, Math.cos(a) * 0.2, 0.95, Math.sin(a) * 0.2, 6));
  }
  g.add(cyl(0.3, 0.3, 0.12, stone, 0, 1.84, 0, 16));
  g.add(box(0.66, 0.1, 0.66, stone, 0, 1.95, 0));
  g.add(cyl(0.26, 0.26, 1.25, paint("#6f6c60", { roughness: 0.95 }), 0, 0.82, 0, 14));
  return g;
}

function leaningFrames() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const f = makeFrame(0.6, 0.8, ["#9dc7ff", "#d9b46a", "#c9a7ff"][i], ["#25334d", "#3d3222", "#2c2444"][i]);
    f.position.set(-0.3 + i * 0.3, 0.5, -0.1 + i * 0.18);
    f.rotation.z = -0.18 + i * 0.16;
    f.rotation.x = -0.14;
    g.add(f);
  }
  return g;
}

function webPillar() {
  const g = new THREE.Group();
  const stone = paint("#3a2630", { roughness: 0.75 });
  g.add(cyl(0.4, 0.5, 0.24, stone, 0, 0.12, 0, 12));
  const col = cyl(0.26, 0.34, 2.2, stone, 0, 1.2, 0, 12);
  g.add(col);
  for (let i = 0; i < 5; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.31 + Math.sin(i) * 0.03, 0.03, 5, 16), paint("#6b4a52", { metalness: 0.4 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.3 + i * 0.45;
    g.add(band);
  }
  const web = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 1.0),
    new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, opacity: 0.4, depthWrite: false })
  );
  web.position.set(0, 1.7, 0.34);
  g.add(web);
  return g;
}

function candelabra() {
  const g = new THREE.Group();
  const metal = paint("#b08d52", { metalness: 0.8, roughness: 0.35 });
  g.add(cyl(0.24, 0.3, 0.08, metal, 0, 0.04, 0, 12));
  g.add(cyl(0.04, 0.05, 1.1, metal, 0, 0.6, 0, 8));
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 5, 12, Math.PI / 2), metal);
    arm.position.set(s * 0.2, 1.05, 0);
    arm.rotation.z = s > 0 ? 0 : Math.PI;
    g.add(arm);
    g.add(cyl(0.02, 0.03, 0.14, paint("#e8dcc0"), s * 0.42, 1.1, 0, 6));
    g.add(sphere(0.04, emissive("#ffd28a", 1.6), s * 0.42, 1.2, 0, 6));
    const glow = sprite("#ffb264", 0.5, 0.7);
    glow.position.set(s * 0.42, 1.2, 0);
    g.add(glow);
  }
  const glow = new THREE.PointLight(0xffb264, 1.0, 6, 2);
  glow.position.set(0, 1.3, 0);
  g.add(glow);
  return g;
}

const SETS = {
  nursery: [crib, toyChest, blocks, rockingHorse, dresser, teddy, toyChest, blocks],
  study: [bookshelf, desk, globe, armchair, bookStack, grandfatherClock, bookshelf, desk],
  garden: [hedge, statue, fountain, flowerBed, gardenBench, topiary, hedge, statue],
  attic: [crate, trunk, dressForm, hatBoxes, sheetedChair, birdcage, crate, trunk],
  gallery: [galleryPlinth, urn, column, leaningFrames, armchair, galleryPlinth, urn, column],
  weaver: [webPillar, candelabra, webPillar, crate, webPillar, urn, webPillar, crate]
};

export function createObstacle(theme, variant, accent) {
  const set = SETS[theme] || SETS.nursery;
  const factory = set[variant % set.length];
  const g = new THREE.Group();
  const prop = factory(accent);
  g.add(prop);
  g.rotation.y = ((variant * 37) % 13) * 0.07 - 0.42;
  const radii = {
    nursery: 0.66,
    study: 0.64,
    garden: 0.7,
    attic: 0.64,
    gallery: 0.6,
    weaver: 0.62
  };
  g.userData.colliderRadius = radii[theme] || 0.64;
  return shade(g);
}

/* ------------------------------------------------------------------ door --- */

export function createExitDoor(theme, accent) {
  const g = new THREE.Group();
  const stone = paint("#7d6844", { metalness: 0.35, roughness: 0.55 });
  const inner = new THREE.Mesh(
    new THREE.ShapeGeometry(archShape(1.35, 2.15), 20),
    new THREE.MeshStandardMaterial({
      color: "#0d1117",
      emissive: accent,
      emissiveIntensity: 0.22,
      metalness: 0.2,
      roughness: 0.4,
      transparent: true,
      opacity: 0.95
    })
  );
  inner.position.set(0, 0.05, 0.01);
  g.add(inner);

  const backGlow = sprite(accent, 0.28, 2.0);
  backGlow.position.set(0, 1.2, 0.02);
  g.add(backGlow);

  for (const s of [-1, 1]) {
    const post = box(0.16, 1.78, 0.3, stone, s * 0.76, 1.02, 0.05);
    g.add(post);
    const foot = box(0.34, 0.16, 0.42, paint("#5b4a33"), s * 0.76, 0.08, 0.05);
    g.add(foot);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.08, 8, 26, Math.PI), stone);
  arch.position.set(0, 1.9, 0.05);
  g.add(arch);
  const bolt = sphere(0.09, paint(accent, { emissive: accent, emissiveIntensity: 1.1, metalness: 0.6, roughness: 0.25 }), 0, 1.62, 0.19, 10);
  g.add(bolt);
  const boltGlow = sprite(accent, 0.5, 0.7);
  boltGlow.position.set(0, 1.62, 0.24);
  g.add(boltGlow);
  const light = new THREE.PointLight(new THREE.Color(accent), 0.7, 6, 2);
  light.position.set(0, 1.3, 0.6);
  g.add(light);

  let open = false;
  g.userData.open = false;
  g.userData.setOpen = (value) => {
    open = !!value;
    g.userData.open = open;
  };
  g.userData.update = (dt, time) => {
    const target = open ? 1 : 0.22;
    const pulse = 0.5 + Math.sin(time * 2.2) * 0.5;
    inner.material.emissiveIntensity += (target * (open ? 1.5 + pulse * 0.4 : 0.4) - inner.material.emissiveIntensity) * Math.min(1, dt * 4);
    backGlow.material.opacity = 0.18 + (open ? 0.5 : 0.1) * (0.6 + pulse * 0.4);
    backGlow.scale.setScalar(1.5 + (open ? 0.8 : 0.2) * pulse);
    light.intensity = open ? 1.6 + pulse * 0.5 : 0.45 + pulse * 0.2;
    bolt.material.emissiveIntensity = 0.8 + pulse * 0.7;
    boltGlow.material.opacity = 0.35 + pulse * 0.4;
    bolt.position.y = open ? 1.92 : 1.62;
    g.rotation.y = Math.sin(time * 0.4 + g.position.x) * 0.03;
  };
  g.userData.inner = inner;
  return g;
}

/* ----------------------------------------------------------------- gates --- */

export function createThornGate(accent) {
  const g = new THREE.Group();
  const thorn = new THREE.MeshStandardMaterial({
    color: "#4a3358",
    roughness: 0.85,
    emissive: accent,
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 1
  });
  const glow = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.55
  });
  for (let i = 0; i < 7; i++) {
    const h = 1.2 + Math.random() * 0.8;
    const vine = cyl(0.035, 0.06, h, thorn, (Math.random() - 0.5) * 0.95, h / 2, (Math.random() - 0.5) * 0.95, 6);
    vine.rotation.z = (Math.random() - 0.5) * 0.8;
    vine.rotation.x = (Math.random() - 0.5) * 0.7;
    g.add(vine);
    for (let k = 0; k < 4; k++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 5), thorn);
      spike.position.copy(vine.position);
      spike.position.y = 0.25 + k * 0.26;
      spike.position.x += Math.sin(k * 1.7 + i) * 0.16;
      spike.position.z += Math.cos(k * 1.3 + i) * 0.16;
      spike.rotation.z = Math.random() * 3;
      g.add(spike);
    }
  }
  for (let i = 0; i < 4; i++) {
    const bud = sphere(0.08, glow, (Math.random() - 0.5) * 0.9, 0.8 + Math.random() * 0.9, (Math.random() - 0.5) * 0.9, 8);
    g.add(bud);
  }
  const halo = sprite(accent, 0.25, 2.6);
  halo.position.y = 1.1;
  g.add(halo);

  let openT = 0;
  let open = false;
  g.userData.colliderRadius = 0.62;
  g.userData.setOpen = (value) => {
    open = !!value;
  };
  g.userData.update = (dt, time) => {
    openT += ((open ? 1 : 0) - openT) * Math.min(1, dt * 5);
    const s = 1 - openT;
    g.scale.set(0.6 + s * 0.4, s, 0.6 + s * 0.4);
    thorn.opacity = s;
    glow.opacity = 0.55 * s;
    halo.material.opacity = 0.25 * s + Math.sin(time * 3) * 0.04 * s;
    g.position.y = openT * 0.5;
  };
  return g;
}

export function createCreak(accent) {
  const g = new THREE.Group();
  const plank = box(0.95, 0.04, 0.34, paint("#5b4230", { roughness: 0.9 }), 0, 0.02, 0);
  g.add(plank);
  const lineMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.035), lineMat);
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.055;
  g.add(line);
  const ring = sprite(accent, 0.25, 0.8);
  ring.position.y = 0.09;
  g.add(ring);
  let pulse = 0;
  g.userData.update = (dt, time, active) => {
    pulse += ((active ? 1 : 0) - pulse) * Math.min(1, dt * 6);
    lineMat.opacity = 0.15 + pulse * 0.6;
    ring.material.opacity = 0.08 + pulse * 0.35;
    ring.scale.setScalar(0.7 + pulse * 0.5 + Math.sin(time * 4) * 0.05 * pulse);
    plank.position.y = 0.02 + pulse * Math.sin(time * 18) * 0.01;
  };
  return g;
}

export function createMirror(accent) {
  const g = new THREE.Group();
  const frame = paint("#6b5636", { metalness: 0.6, roughness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({
    map: mirrorTexture(),
    color: "#cfe6ff",
    emissive: accent,
    emissiveIntensity: 0.18,
    metalness: 0.85,
    roughness: 0.08
  });
  const oval = new THREE.Mesh(new THREE.CircleGeometry(0.55, 28), glassMat);
  oval.scale.set(0.8, 1.25, 1);
  oval.position.y = 1.25;
  oval.position.z = 0.06;
  g.add(oval);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 30), frame);
  ring.scale.set(0.8, 1.25, 1);
  ring.position.y = 1.25;
  g.add(ring);
  g.add(cyl(0.06, 0.1, 0.75, frame, 0, 0.38, 0, 8));
  g.add(cyl(0.3, 0.36, 0.08, frame, 0, 0.05, 0, 12));
  const halo = sprite(accent, 0.16, 1.7);
  halo.position.y = 1.25;
  halo.position.z = 0.12;
  g.add(halo);
  const glint = new THREE.Mesh(
    new THREE.PlaneGeometry(0.06, 0.9),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending })
  );
  glint.position.set(-0.12, 1.32, 0.15);
  glint.rotation.z = 0.32;
  g.add(glint);
  g.userData.colliderRadius = 0.34;
  g.userData.update = (dt, time) => {
    halo.material.opacity = 0.1 + Math.sin(time * 1.7) * 0.05;
    glassMat.emissiveIntensity = 0.12 + Math.sin(time * 2.4) * 0.06;
    glint.material.opacity = 0.12 + Math.sin(time * 2 + g.position.x) * 0.1;
  };
  return g;
}

export function pendulumAngle(time, phase) {
  return time * 0.95 + phase;
}

export function createPendulum(accent) {
  const g = new THREE.Group();
  const metal = paint("#5e4a2f", { metalness: 0.7, roughness: 0.4 });
  const brass = paint("#b08d52", { metalness: 0.85, roughness: 0.28 });
  g.add(cyl(0.34, 0.44, 0.18, metal, 0, 0.09, 0, 12));
  g.add(cyl(0.1, 0.14, 1.5, metal, 0, 0.85, 0, 10));
  g.add(sphere(0.16, brass, 0, 1.62, 0, 10));
  const arm = new THREE.Group();
  arm.position.y = 1.62;
  g.add(arm);
  const rod = box(0.07, 0.06, 1.5, metal, 0, 0, 0.75);
  arm.add(rod);
  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 4), brass);
  blade.rotation.x = Math.PI / 2;
  blade.rotation.z = Math.PI / 4;
  blade.position.set(0, 0, 1.62);
  arm.add(blade);
  const counter = box(0.12, 0.12, 0.5, metal, 0, 0, -0.3);
  arm.add(counter);
  const glow = sprite(accent, 0.25, 1.4);
  glow.position.set(0, -0.12, 1.62);
  arm.add(glow);
  const phase = Math.random() * Math.PI * 2;
  const light = new THREE.PointLight(new THREE.Color(accent), 0.5, 5, 2);
  light.position.set(0, 1.4, 0);
  g.add(light);
  g.userData.phase = phase;
  g.userData.length = 1.64;
  g.userData.colliderRadius = 0.42;
  g.userData.update = (dt, time) => {
    const a = pendulumAngle(time, phase);
    arm.rotation.y = a;
    glow.material.opacity = 0.18 + Math.sin(time * 5) * 0.06;
  };
  return g;
}

/* --------------------------------------------------------------- boss set --- */

export function createBossArena() {
  const g = new THREE.Group();
  const W = 20;
  const D = 15;
  const baseMat = new THREE.MeshStandardMaterial({
    color: "#2a1722",
    roughness: 0.9,
    metalness: 0.05
  });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(10.2, 10.6, 0.5, 40), baseMat);
  floor.position.y = -0.25;
  floor.receiveShadow = true;
  g.add(floor);

  const web = new THREE.Mesh(
    new THREE.CircleGeometry(9.7, 48),
    new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  web.rotation.x = -Math.PI / 2;
  web.position.y = 0.03;
  g.add(web);

  const rune = new THREE.Mesh(
    new THREE.RingGeometry(6.3, 6.5, 64),
    new THREE.MeshBasicMaterial({ color: "#ffb98a", transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.04;
  g.add(rune);
  const rune2 = new THREE.Mesh(
    new THREE.RingGeometry(3.1, 3.2, 48),
    new THREE.MeshBasicMaterial({ color: "#ffdcb0", transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  rune2.rotation.x = -Math.PI / 2;
  rune2.position.y = 0.04;
  g.add(rune2);

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 22),
    new THREE.MeshBasicMaterial({ map: skyTexture("weaver"), fog: false })
  );
  sky.position.set(0, 8.5, -16);
  g.add(sky);

  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: moonTexture(), color: "#ffd9b0", transparent: true, opacity: 0.9, depthWrite: false })
  );
  moon.scale.set(7, 7, 1);
  moon.position.set(-7, 9.5, -15.4);
  g.add(moon);
  const halo = sprite("#ffb98a", 0.18, 12);
  halo.position.set(-7, 9.5, -15.5);
  g.add(halo);

  const pillars = [];
  const positions = [
    [-8.1, -5.2],
    [8.1, -5.2],
    [-8.1, 5.6],
    [8.1, 5.6]
  ];
  for (const [x, z] of positions) {
    const p = webPillar();
    p.position.set(x, 0, z);
    p.scale.set(1.4, 1.5, 1.4);
    g.add(p);
    pillars.push({ x, z, r: 0.72 });
  }
  for (const [x, z] of [[-6.4, 0], [6.4, 0], [0, -6.4]]) {
    const cand = candelabra();
    cand.position.set(x, 0, z);
    cand.scale.set(1.35, 1.35, 1.35);
    g.add(cand);
  }
  const nest = new THREE.Group();
  nest.position.set(0, 0, -6.8);
  for (let i = 0; i < 7; i++) {
    const sac = sphere(0.55, paint("#e6d8c2", { roughness: 1 }), (Math.random() - 0.5) * 3.6, 0.75 + Math.random() * 0.4, (Math.random() - 0.5) * 0.7, 12);
    sac.scale.set(0.8, 1.3, 0.8);
    nest.add(sac);
  }
  for (let i = 0; i < 4; i++) {
    const silk = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 5.2),
      new THREE.MeshBasicMaterial({ color: "#d8c8b0", transparent: true, opacity: 0.25 })
    );
    silk.position.set(-3 + i * 2, 3.4, -6.3);
    silk.rotation.z = 0.1 - i * 0.06;
    g.add(silk);
  }
  g.add(nest);

  const dust = createDust("#ffb98a", 100);
  g.add(dust);
  const light = new THREE.PointLight(0xffb98a, 1.6, 16, 2);
  light.position.set(0, 5, 0);
  g.add(light);

  g.userData.pillars = pillars;
  g.userData.rune = rune;
  g.userData.rune2 = rune2;
  g.userData.dust = dust;
  g.userData.update = (dt, time) => {
    rune.rotation.z = time * 0.08;
    rune2.rotation.z = -time * 0.12;
    rune.material.opacity = 0.35 + Math.sin(time * 1.4) * 0.1;
    dust.userData.update(dt);
    web.rotation.z = 0;
  };
  g.userData.bounds = { halfW: 9.4, halfD: 7.0 };
  return g;
}
