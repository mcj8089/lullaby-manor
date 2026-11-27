import * as THREE from "three";
import { glowTexture, starTexture, webTexture } from "./textures.js";
import { createWisp } from "./jelly.js";

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.04, ...opts });
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function sphere(r, material, x = 0, y = 0, z = 0, seg = 14) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 2)), material);
  m.position.set(x, y, z);
  return m;
}

function cone(r, h, material, x = 0, y = 0, z = 0, seg = 8) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), material);
  m.position.set(x, y, z);
  return m;
}

function cyl(rTop, rBot, h, material, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), material);
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

function starSprite(color, scale) {
  return sprite(color, 0.85, scale, starTexture());
}

function setShadows(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

function common(g, accent, headY) {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.44, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);

  const flash = sprite("#fff7e0", 0, 2.4);
  flash.position.y = headY;
  g.add(flash);

  const stars = new THREE.Group();
  stars.position.y = headY + 0.35;
  stars.visible = false;
  const list = [];
  for (let i = 0; i < 3; i++) {
    const s = starSprite(accent, 0.26);
    stars.add(s);
    list.push(s);
  }
  g.add(stars);

  let flashT = 0;
  let stun = false;
  g.userData.hit = () => {
    flashT = 0.2;
  };
  g.userData.flash = () => {
    flashT = 0.2;
  };
  g.userData.setStunned = (value) => {
    stun = !!value;
    stars.visible = stun;
    shadow.material.opacity = stun ? 0.38 : 0.32;
  };
  g.userData.isStunned = () => stun;
  g.userData.tickCommon = (dt, time) => {
    flashT = Math.max(0, flashT - dt);
    flash.material.opacity = flashT * 2.6;
    flash.scale.setScalar(1.6 + (0.2 - flashT) * 3.2);
    if (stun) {
      list.forEach((s, i) => {
        const a = time * 2.4 + (i / 3) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.52, Math.sin(a * 2) * 0.06, Math.sin(a) * 0.52);
        s.material.opacity = 0.5 + Math.sin(time * 5 + i) * 0.3;
      });
    }
  };
  g.userData.headY = headY;
  return shadow;
}

/* --------------------------------------------------------------- hushling --- */

function hushling(accent) {
  const g = new THREE.Group();
  common(g, accent, 0.9);
  const body = new THREE.Group();
  g.add(body);

  const fur = mat("#1a2029", { roughness: 0.98 });
  const dark = mat("#10151c", { roughness: 1 });
  const core = sphere(0.4, fur, 0, 0.52, 0, 18);
  core.scale.set(1, 0.94, 0.86);
  body.add(core);

  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const tuft = cone(0.08, 0.2, dark, Math.cos(a) * 0.34, 0.5 + Math.sin(i * 2.1) * 0.2, Math.sin(a) * 0.3, 5);
    tuft.rotation.z = Math.cos(a) * 0.9;
    tuft.rotation.x = Math.sin(a) * 0.9;
    body.add(tuft);
  }

  const ears = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.19, 0.84, 0);
    ear.rotation.z = side * 0.22;
    const outer = cone(0.12, 0.5, fur, 0, 0.25, 0, 8);
    outer.scale.z = 0.6;
    ear.add(outer);
    const inner = cone(0.07, 0.34, mat(accent, { emissive: accent, emissiveIntensity: 0.16, roughness: 0.7 }), 0, 0.23, 0.035, 8);
    inner.scale.z = 0.4;
    ear.add(inner);
    body.add(ear);
    ears.push(ear);
  }

  const eyeWhite = mat("#efe6d2", { roughness: 0.4 });
  const eye = sphere(0.155, eyeWhite, 0, 0.6, 0.32, 16);
  eye.scale.set(1.1, 1.25, 0.6);
  body.add(eye);
  const irisMat = mat(accent, { emissive: accent, emissiveIntensity: 0.8, roughness: 0.3 });
  const iris = sphere(0.1, irisMat, 0, 0.6, 0.4, 12);
  iris.scale.set(1, 1.15, 0.4);
  body.add(iris);
  const pupil = sphere(0.046, mat("#081014"), 0, 0.6, 0.445, 10);
  pupil.scale.set(0.7, 1.1, 0.3);
  body.add(pupil);
  const glint = sprite(accent, 0.7, 0.55);
  glint.position.set(0, 0.62, 0.47);
  body.add(glint);

  const lid = sphere(0.17, fur, 0, 0.7, 0.32, 14);
  lid.scale.set(1.05, 0.55, 0.6);
  lid.visible = false;
  body.add(lid);

  const feet = [];
  for (const side of [-1, 1]) {
    const foot = sphere(0.1, dark, side * 0.19, 0.12, 0.12, 8);
    foot.scale.set(1, 0.7, 1.2);
    g.add(foot);
    feet.push(foot);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = sphere(0.09, fur, side * 0.36, 0.42, 0.12, 8);
    arm.scale.set(0.8, 1.3, 0.8);
    body.add(arm);
    arms.push(arm);
  }
  const tail = cone(0.1, 0.36, dark, 0, 0.34, -0.32, 6);
  tail.rotation.x = -0.9;
  body.add(tail);

  const aura = sprite(accent, 0.14, 1.6);
  aura.position.y = 0.55;
  g.add(aura);

  let t = Math.random() * 10;
  let alertT = 0;
  let hitScale = 0;
  const eyeBase = new THREE.Color(accent);
  const eyeHot = new THREE.Color("#ff9a7a");

  g.userData.kind = "hushling";
  g.userData.update = (dt, time, state = {}) => {
    t += dt;
    const moving = state.moving ? 1 : 0;
    const alert = state.alerted ? 1 : 0;
    alertT += (alert - alertT) * Math.min(1, dt * 4);
    irisMat.emissive.copy(eyeBase).lerp(eyeHot, alertT);
    irisMat.color.copy(irisMat.emissive);
    irisMat.emissiveIntensity = 0.6 + alertT * 1.1 + Math.sin(time * 4) * 0.1;
    glint.material.color.copy(irisMat.emissive);
    aura.material.color.copy(irisMat.emissive);
    aura.material.opacity = 0.12 + alertT * 0.16;
    const hop = moving ? Math.abs(Math.sin(time * 7.5)) * 0.14 : 0;
    body.position.y = hop + Math.sin(t * 2) * 0.03;
    body.rotation.z = moving ? Math.sin(time * 7.5) * 0.09 : Math.sin(t * 1.4) * 0.03;
    body.rotation.x = -hop * 0.5;
    ears[0].rotation.z = 0.22 + Math.sin(t * 2.6) * 0.1 + alertT * 0.3;
    ears[1].rotation.z = -0.22 - Math.sin(t * 2.6 + 1) * 0.1 - alertT * 0.3;
    feet[0].position.y = 0.11 + Math.max(0, Math.sin(time * 7.5)) * 0.1;
    feet[1].position.y = 0.11 + Math.max(0, -Math.sin(time * 7.5)) * 0.1;
    arms[0].rotation.x = Math.sin(time * 7.5) * 0.4 * moving;
    arms[1].rotation.x = -Math.sin(time * 7.5) * 0.4 * moving;
    const stun = g.userData.isStunned();
    if (stun) {
      body.rotation.z = Math.sin(time * 9) * 0.16;
      body.position.y = 0.02;
    }
    lid.visible = stun;
    if (stun) {
      iris.position.y = 0.52;
      pupil.position.y = 0.52;
    } else {
      iris.position.y = 0.6;
      pupil.position.y = 0.6;
    }
    hitScale = Math.max(0, hitScale - dt * 5);
    g.scale.setScalar(1 + Math.sin(hitScale * 20) * hitScale * 0.2);
    g.userData.tickCommon(dt, time);
  };
  g.userData.hit = () => {
    hitScale = 1;
    g.userData.flash();
  };
  return setShadows(g);
}

/* -------------------------------------------------------------------- eel --- */

function inkEel(accent) {
  const g = new THREE.Group();
  common(g, accent, 0.8);
  const body = new THREE.Group();
  g.add(body);
  const ink = mat("#16202c", { roughness: 0.35, metalness: 0.35 });
  const sheen = mat("#2c4a55", { roughness: 0.25, metalness: 0.5, emissive: "#0e2a30", emissiveIntensity: 0.5 });
  const eyeMat = mat(accent, { emissive: accent, emissiveIntensity: 1.1, roughness: 0.25 });

  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.62);
  body.add(head);
  const skull = sphere(0.3, ink, 0, 0, 0, 16);
  skull.scale.set(1.1, 0.9, 1.35);
  head.add(skull);
  const jaw = cone(0.16, 0.34, sheen, 0, -0.14, 0.3, 8);
  jaw.rotation.x = 1.9;
  head.add(jaw);
  const eyes = [];
  for (const side of [-1, 1]) {
    const e = sphere(0.07, eyeMat, side * 0.13, 0.08, 0.26, 10);
    head.add(e);
    eyes.push(e);
  }
  for (let i = 0; i < 3; i++) {
    const spine = cone(0.06, 0.3, sheen, 0, 0.24 - i * 0.03, -0.1 - i * 0.12, 5);
    spine.rotation.x = -0.5;
    head.add(spine);
  }
  const glow = sprite(accent, 0.35, 1.0);
  glow.position.set(0, 0.06, 0.25);
  head.add(glow);

  const segments = [];
  for (let i = 0; i < 7; i++) {
    const r = 0.28 - i * 0.027;
    const seg = sphere(r, i % 2 ? ink : sheen, 0, 0.0, -i * 0.3, 12);
    seg.scale.set(1, 0.9, 1.15);
    body.add(seg);
    segments.push(seg);
  }
  const fin = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.6, 4),
    mat("#3a6a6c", { transparent: true, opacity: 0.8, roughness: 0.4, emissive: accent, emissiveIntensity: 0.2 })
  );
  fin.scale.set(0.2, 1, 1);
  fin.rotation.x = -Math.PI / 2;
  fin.position.set(0, 0.05, -2.15);
  body.add(fin);
  const tailFin = fin.clone();
  tailFin.scale.set(0.2, 1.4, 0.6);
  tailFin.rotation.z = Math.PI / 2;
  tailFin.position.set(0, 0.35, -2.05);
  body.add(tailFin);

  for (let i = 0; i < 4; i++) {
    const drop = sprite(accent, 0.2, 0.4);
    drop.position.set((i - 1.5) * 0.18, 0.1 + (i % 2) * 0.2, -0.4 - i * 0.3);
    body.add(drop);
  }

  const ripples = [];
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3 + i * 0.18, 0.34 + i * 0.18, 20),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.position.z = 0.4;
    g.add(ring);
    ripples.push(ring);
  }

  let submerge = 0;
  let hitT = 0;
  let t = Math.random() * 8;
  const baseEye = new THREE.Color(accent);

  g.userData.kind = "eel";
  g.userData.setSubmerged = (v) => {
    submerge = v ? 1 : 0;
  };
  g.userData.update = (dt, time, state = {}) => {
    t += dt;
    const target = state.submerged ? 1 : 0;
    submerge += (target - submerge) * Math.min(1, dt * 2.5);
    body.position.y = 0.35 - submerge * 0.65 + Math.sin(t * 2.4) * 0.05;
    body.visible = submerge < 0.94;
    head.position.y = 0.5 + Math.sin(t * 2.4 + 0.7) * 0.08;
    head.rotation.x = Math.sin(t * 1.7) * 0.08 - (state.alerted ? 0.12 : 0);
    head.rotation.z = Math.sin(t * 1.1) * 0.1;
    segments.forEach((seg, i) => {
      seg.position.z = -i * 0.32;
      seg.position.x = Math.sin(t * 2.2 + i * 0.7) * (0.1 + i * 0.025);
      seg.position.y = Math.sin(t * 1.9 + i * 0.8) * 0.06;
      seg.rotation.y = Math.sin(t * 2.2 + i * 0.7) * 0.2;
    });
    eyeMat.emissiveIntensity = state.alerted ? 1.6 + Math.sin(time * 6) * 0.35 : 0.8;
    eyeMat.color.copy(baseEye);
    glow.material.opacity = 0.25 + (state.alerted ? 0.2 : 0) + Math.sin(time * 3) * 0.06;
    ripples.forEach((r, i) => {
      const s = 1 + ((time * 0.6 + i * 0.5) % 1) * 0.7;
      r.scale.setScalar(s);
      r.material.opacity = Math.max(0, 0.25 - ((time * 0.6 + i * 0.5) % 1) * 0.25) * (1 - submerge * 0.4);
    });
    const stun = g.userData.isStunned();
    if (stun) head.rotation.z = Math.sin(time * 10) * 0.2;
    hitT = Math.max(0, hitT - dt * 6);
    g.scale.setScalar(1 + hitT * 0.06);
    g.userData.tickCommon(dt, time);
  };
  g.userData.hit = () => {
    hitT = 1;
    g.userData.flash();
  };
  return setShadows(g);
}

/* ------------------------------------------------------------------ hound --- */

function thornHound(accent) {
  const g = new THREE.Group();
  common(g, accent, 0.95);
  const body = new THREE.Group();
  g.add(body);
  const hide = mat("#241c30", { roughness: 0.9 });
  const dark = mat("#161020", { roughness: 1 });
  const thorn = mat("#4a3c63", { roughness: 0.8 });
  const eyeMat = mat(accent, { emissive: accent, emissiveIntensity: 1.1, roughness: 0.2 });

  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.62, 8, 12), hide);
  chest.rotation.x = Math.PI / 2;
  chest.position.set(0, 0.62, -0.05);
  body.add(chest);

  const head = new THREE.Group();
  head.position.set(0, 0.82, 0.56);
  body.add(head);
  const skull = sphere(0.25, hide, 0, 0, 0, 14);
  skull.scale.set(1, 0.9, 1.1);
  head.add(skull);
  const snout = box(0.2, 0.16, 0.3, dark, 0, -0.06, 0.26);
  head.add(snout);
  head.add(sphere(0.06, paintNose(), 0, -0.02, 0.42, 8));
  const jaw = box(0.16, 0.06, 0.22, dark, 0, -0.16, 0.28);
  head.add(jaw);
  for (const side of [-1, 1]) {
    const ear = cone(0.09, 0.26, hide, side * 0.16, 0.22, -0.02, 6);
    ear.rotation.z = side * 0.35;
    head.add(ear);
    const eye = sphere(0.045, eyeMat, side * 0.11, 0.06, 0.22, 8);
    head.add(eye);
  }
  for (let i = 0; i < 5; i++) {
    const spike = cone(0.07, 0.26, thorn, 0, 0.26, 0.28 - i * 0.16, 5);
    spike.rotation.x = -0.3 - i * 0.08;
    head.add(spike);
  }

  const legs = [];
  for (const [x, z, off] of [[-0.19, 0.32, 0], [0.19, 0.32, Math.PI], [-0.19, -0.36, Math.PI], [0.19, -0.36, 0]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.56, z);
    const upper = cyl(0.055, 0.045, 0.34, hide, 0, -0.16, 0, 6);
    leg.add(upper);
    const lower = cyl(0.04, 0.035, 0.26, dark, 0, -0.42, 0.02, 6);
    leg.add(lower);
    leg.add(sphere(0.075, dark, 0, -0.55, 0.04, 8));
    leg.userData.off = off;
    body.add(leg);
    legs.push(leg);
  }

  for (let i = 0; i < 6; i++) {
    const spike = cone(0.08, 0.3, thorn, 0, 0.84, -0.32 + i * 0.14, 5);
    spike.rotation.z = (i % 2 ? 1 : -1) * 0.2;
    spike.rotation.x = -0.18;
    body.add(spike);
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.7, -0.46);
  const vine = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.08, 0.14, -0.24),
        new THREE.Vector3(0.22, 0.3, -0.46),
        new THREE.Vector3(0.34, 0.5, -0.6)
      ]),
      16,
      0.035,
      5,
      false
    ),
    thorn
  );
  tail.add(vine);
  for (let i = 0; i < 3; i++) {
    const bud = sphere(0.05, mat(accent, { emissive: accent, emissiveIntensity: 0.6 }), 0.1 + i * 0.08, 0.16 + i * 0.16, -0.3 - i * 0.08, 6);
    tail.add(bud);
  }
  body.add(tail);

  const aura = sprite(accent, 0.12, 1.5);
  aura.position.y = 0.6;
  g.add(aura);

  let hitT = 0;
  let t = Math.random() * 8;
  g.userData.kind = "hound";
  g.userData.update = (dt, time, state = {}) => {
    t += dt;
    const moving = state.moving ? 1 : 0;
    const alert = state.alerted ? 1 : 0;
    const stun = g.userData.isStunned();
    body.position.y = Math.sin(time * 9) * 0.03 * moving;
    body.rotation.z = stun ? 0.34 : 0;
    legs.forEach((leg, i) => {
      const phase = leg.userData.off;
      leg.rotation.x = stun ? 0.7 : Math.sin(time * 11 + phase) * 0.55 * moving;
      leg.position.y = 0.56 - (stun ? 0.1 : Math.abs(Math.sin(time * 11 + phase)) * 0.03 * moving);
    });
    head.rotation.x = alert ? -0.18 : Math.sin(t * 1.4) * 0.05;
    head.rotation.z = Math.sin(t * 2.2) * 0.06 + (stun ? Math.sin(time * 9) * 0.2 : 0);
    jaw.position.y = -0.16 - (alert ? Math.abs(Math.sin(time * 8)) * 0.06 : 0);
    eyeMat.emissiveIntensity = 0.9 + alert * 0.8 + Math.sin(time * (alert ? 8 : 2)) * 0.2;
    tail.rotation.y = Math.sin(time * 2.2) * 0.4;
    tail.rotation.z = Math.sin(time * 1.7) * 0.2;
    aura.material.opacity = 0.1 + alert * 0.12;
    hitT = Math.max(0, hitT - dt * 6);
    g.scale.setScalar(1 + hitT * 0.07);
    g.userData.tickCommon(dt, time);
  };
  g.userData.hit = () => {
    hitT = 1;
    g.userData.flash();
  };
  return setShadows(g);
}

function paintNose() {
  return mat("#0a080c");
}

/* --------------------------------------------------------------- sentinel --- */

function cuckooSentinel(accent) {
  const g = new THREE.Group();
  common(g, accent, 1.35);
  const body = new THREE.Group();
  body.position.y = 0.35;
  g.add(body);
  const brass = mat("#8a6a3a", { metalness: 0.8, roughness: 0.35 });
  const darkBrass = mat("#5c4525", { metalness: 0.7, roughness: 0.45 });
  const cream = mat("#e9dcc0", { roughness: 0.6 });
  const eyeMat = mat(accent, { emissive: accent, emissiveIntensity: 1.0 });

  const gear = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.07, 6, 22), darkBrass);
  gear.position.set(0, 0.55, -0.32);
  body.add(gear);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const tooth = box(0.1, 0.12, 0.1, darkBrass, Math.cos(a) * 0.55, 0.55 + Math.sin(a) * 0.55, -0.32);
    tooth.rotation.z = a;
    body.add(tooth);
  }

  const clockBody = cyl(0.4, 0.44, 0.34, brass, 0, 0.55, 0, 20);
  clockBody.rotation.x = Math.PI / 2;
  body.add(clockBody);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.35, 24), cream);
  face.position.set(0, 0.55, 0.18);
  body.add(face);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 24), brass);
  ring.position.set(0, 0.55, 0.2);
  body.add(ring);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tick = box(0.018, 0.04, 0.01, darkBrass, Math.sin(a) * 0.29, 0.55 + Math.cos(a) * 0.29, 0.21);
    tick.rotation.z = -a;
    body.add(tick);
  }
  const hand = box(0.022, 0.16, 0.012, darkBrass, 0, 0.61, 0.22);
  body.add(hand);
  const hand2 = box(0.018, 0.11, 0.012, darkBrass, 0.03, 0.59, 0.225);
  hand2.rotation.z = -1.2;
  body.add(hand2);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 20),
    new THREE.MeshStandardMaterial({ color: "#cfe6ff", transparent: true, opacity: 0.18, metalness: 0.4, roughness: 0.05 })
  );
  glass.position.set(0, 0.55, 0.235);
  body.add(glass);

  const roof = cone(0.42, 0.34, brass, 0, 1.05, 0, 8);
  body.add(roof);
  body.add(sphere(0.07, eyeMat, 0, 1.26, 0, 8));

  const beak = cone(0.07, 0.26, mat("#c99a4a", { metalness: 0.6, roughness: 0.35 }), 0, 0.72, 0.46, 6);
  beak.rotation.x = Math.PI / 2;
  body.add(beak);
  for (const side of [-1, 1]) {
    const eye = sphere(0.045, eyeMat, side * 0.1, 0.78, 0.32, 8);
    body.add(eye);
  }

  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.38, 0.6, 0);
    const feathers = [];
    for (let i = 0; i < 3; i++) {
      const f = box(0.34 - i * 0.06, 0.07, 0.16, i % 2 ? brass : darkBrass, side * (0.16 - i * 0.02), -i * 0.07, -i * 0.03);
      wing.add(f);
      feathers.push(f);
    }
    body.add(wing);
    wings.push(wing);
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.35, -0.4);
  for (let i = 0; i < 3; i++) {
    const f = box(0.1, 0.05, 0.4, i % 2 ? brass : darkBrass, (i - 1) * 0.1, -i * 0.03, -0.2);
    f.rotation.y = (i - 1) * 0.24;
    tail.add(f);
  }
  body.add(tail);

  const glow = sprite(accent, 0.25, 1.4);
  glow.position.set(0, 0.7, 0.2);
  body.add(glow);

  let hitT = 0;
  g.userData.kind = "sentinel";
  g.userData.update = (dt, time, state = {}) => {
    const stun = g.userData.isStunned();
    const tick = Math.abs(Math.sin(time * Math.PI * 2 * 0.9));
    body.position.y = 0.35 + Math.sin(time * 1.7) * 0.06 + (stun ? -0.25 : 0);
    body.rotation.z = Math.sin(time * 1.3) * 0.05 + (stun ? 0.4 : 0);
    body.rotation.y = state.alerted ? Math.sin(time * 3) * 0.1 : 0;
    wings[0].rotation.z = 0.15 + Math.sin(time * (stun ? 2 : 12)) * (stun ? 0.05 : 0.55);
    wings[1].rotation.z = -0.15 - Math.sin(time * (stun ? 2 : 12)) * (stun ? 0.05 : 0.55);
    wingFlutter(wings, time, stun);
    hand.rotation.z = -time * 0.6;
    hand2.rotation.z = -time * 1.6;
    gear.rotation.z = time * 0.4;
    beak.position.z = 0.46 + tick * 0.08;
    eyeMat.emissiveIntensity = 0.8 + (state.alerted ? 0.8 : 0) + tick * 0.3;
    glow.material.opacity = 0.16 + tick * 0.16;
    hitT = Math.max(0, hitT - dt * 6);
    g.scale.setScalar(1 + hitT * 0.06);
    g.userData.tickCommon(dt, time);
  };
  g.userData.hit = () => {
    hitT = 1;
    g.userData.flash();
  };
  return setShadows(g);
}

function wingFlutter(wings, time, stun) {
  const a = stun ? 0.1 : Math.sin(time * 12) * 0.25;
  wings[0].rotation.x = a;
  wings[1].rotation.x = a;
}

/* ----------------------------------------------------------------- shadow --- */

function shadowJune(accent) {
  const g = new THREE.Group();
  const wisp = createWisp({ dark: true });
  wisp.scale.setScalar(1.02);
  g.add(wisp);

  const ribbons = [];
  const ribbonMat = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(0.12, 1.3, 1, 8);
    const ribbon = new THREE.Mesh(geo, ribbonMat);
    ribbon.position.set((i - 1) * 0.18, 0.35, -0.3 - i * 0.06);
    ribbon.rotation.z = (i - 1) * 0.2;
    g.add(ribbon);
    ribbons.push(ribbon);
  }
  const shards = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09, 0),
      new THREE.MeshStandardMaterial({
        color: "#cfe6ff",
        emissive: accent,
        emissiveIntensity: 0.8,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.8
      })
    );
    shard.scale.set(0.5, 1.4, 0.3);
    shards.add(shard);
  }
  g.add(shards);
  const aura = sprite(accent, 0.22, 1.9);
  aura.position.y = 0.6;
  g.add(aura);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 22),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.36, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  g.add(shadow);

  const stars = new THREE.Group();
  stars.position.y = 1.45;
  stars.visible = false;
  const starList = [];
  for (let i = 0; i < 3; i++) {
    const s = starSprite(accent, 0.26);
    stars.add(s);
    starList.push(s);
  }
  g.add(stars);

  const flash = sprite("#ffffff", 0, 2.2);
  flash.position.y = 0.8;
  g.add(flash);

  let stun = false;
  let flashT = 0;
  let hitT = 0;
  g.userData.kind = "shadow";
  g.userData.hit = () => {
    flashT = 0.2;
    hitT = 1;
  };
  g.userData.setStunned = (v) => {
    stun = !!v;
    stars.visible = stun;
  };
  g.userData.isStunned = () => stun;
  g.userData.update = (dt, time, state = {}) => {
    wisp.userData.update(dt, time, state.moving ? 1 : 0);
    ribbons.forEach((r, i) => {
      r.rotation.x = Math.sin(time * 2 + i * 0.8) * 0.5;
      r.rotation.y = Math.sin(time * 1.4 + i) * 0.3;
      r.position.x = (i - 1) * 0.18 + Math.sin(time * 2.4 + i) * 0.06;
      r.material.opacity = 0.18 + Math.sin(time * 3 + i) * 0.08;
    });
    shards.children.forEach((s, i) => {
      const a = time * 1.6 + (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.62, 0.62 + Math.sin(a * 2) * 0.2, Math.sin(a) * 0.62);
      s.rotation.y = time * 2 + i;
      s.rotation.z = time + i;
    });
    aura.material.opacity = 0.16 + Math.sin(time * 2.2) * 0.06 + (state.alerted ? 0.12 : 0);
    shadow.material.opacity = stun ? 0.45 : 0.3;
    if (stun) {
      wisp.userData.body.rotation.z = Math.sin(time * 8) * 0.2;
      starList.forEach((s, i) => {
        const a = time * 2.4 + (i / 3) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.5, Math.sin(a * 2) * 0.06, Math.sin(a) * 0.5);
        s.material.opacity = 0.5 + Math.sin(time * 5 + i) * 0.3;
      });
    }
    flashT = Math.max(0, flashT - dt);
    flash.material.opacity = flashT * 2.6;
    flash.scale.setScalar(1.6 + (0.2 - flashT) * 3.2);
    hitT = Math.max(0, hitT - dt * 6);
    g.scale.setScalar(1.02 + hitT * 0.06);
  };
  g.userData.headY = 1.0;
  return g;
}

/* ----------------------------------------------------------------- weaver --- */

function weaverBoss(accent) {
  const g = new THREE.Group();
  const base = new THREE.Group();
  base.position.y = 0.1;
  g.add(base);

  const plum = mat("#2a1420", { roughness: 0.8 });
  const silk = mat("#6e4a58", { roughness: 0.65, metalness: 0.15 });
  const porcelain = mat("#e9ddc8", { roughness: 0.35, metalness: 0.15 });
  const gold = mat("#b08d52", { metalness: 0.75, roughness: 0.35 });
  const eyeMat = mat(accent, { emissive: accent, emissiveIntensity: 1.3, roughness: 0.2 });

  const abdomen = sphere(1.28, plum, 0, 2.15, -0.55, 24);
  abdomen.scale.set(1, 1.08, 1.18);
  base.add(abdomen);
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(1.12 - i * 0.09, 0.028, 6, 30),
      mat(i % 2 ? "#6e4a58" : "#3d2230", { roughness: 0.7 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 1.55 + i * 0.42, -0.55);
    band.scale.set(1, 1.1, 1);
    base.add(band);
  }
  const pattern = new THREE.Mesh(
    new THREE.CircleGeometry(1.08, 26),
    new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  pattern.position.set(0, 2.2, 0.72);
  base.add(pattern);

  const thorax = cyl(0.62, 0.95, 1.15, plum, 0, 3.42, -0.15, 16);
  base.add(thorax);
  const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.13, 8, 24), silk);
  ruff.rotation.x = Math.PI / 2;
  ruff.position.set(0, 3.95, -0.1);
  base.add(ruff);

  const head = new THREE.Group();
  head.position.set(0, 4.45, 0.12);
  base.add(head);
  const mask = sphere(0.62, porcelain, 0, 0, 0, 22);
  mask.scale.set(1, 1.12, 0.82);
  head.add(mask);
  const mouth = box(0.24, 0.03, 0.04, mat("#3a1e28"), 0, -0.28, 0.49);
  head.add(mouth);
  for (let i = 0; i < 4; i++) {
    const a = [[-0.22, 0.16], [0.22, 0.16], [-0.13, 0.02], [0.13, 0.02]][i];
    const eye = sphere(i < 2 ? 0.085 : 0.065, eyeMat, a[0], a[1], 0.47, 10);
    eye.scale.set(1.25, 1, 0.5);
    head.add(eye);
  }
  const crown = new THREE.Group();
  crown.position.y = 0.5;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const needle = cone(0.035, 0.4 + Math.sin(i * 2) * 0.2, gold, Math.cos(a) * 0.38, 0.14, Math.sin(a) * 0.38, 5);
    needle.rotation.z = Math.cos(a) * 0.4;
    needle.rotation.x = Math.sin(a) * 0.4;
    crown.add(needle);
  }
  head.add(crown);
  const hair = [];
  for (let i = 0; i < 5; i++) {
    const strand = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 1.4),
      new THREE.MeshBasicMaterial({ color: "#cbb8a2", transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    );
    strand.position.set((i - 2) * 0.12, 0.1, -0.52);
    strand.rotation.x = -0.2;
    head.add(strand);
    hair.push(strand);
  }

  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.75, 3.5, 0);
    const upper = cyl(0.09, 0.11, 1.1, plum, side * 0.18, 0.45, 0.1, 8);
    upper.rotation.z = side * 0.5;
    arm.add(upper);
    const fore = cyl(0.07, 0.09, 1.0, silk, side * 0.55, 0.9, 0.3, 8);
    fore.rotation.z = side * 0.2;
    fore.rotation.x = -0.4;
    arm.add(fore);
    const hand = new THREE.Group();
    hand.position.set(side * 0.66, 1.25, 0.6);
    for (let i = 0; i < 4; i++) {
      const finger = cyl(0.018, 0.03, 0.42, gold, (i - 1.5) * 0.07, 0.14, 0, 5);
      finger.rotation.z = (i - 1.5) * 0.18;
      hand.add(finger);
    }
    arm.add(hand);
    arm.add(sphere(0.1, gold, side * 0.66, 1.22, 0.6, 8));
    base.add(arm);
    arms.push(arm);
  }

  const legs = [];
  const legSettings = [
    [-0.4, 3.0, -0.2],
    [0.4, 3.0, -0.2],
    [-0.55, 2.6, -0.5],
    [0.55, 2.6, -0.5],
    [-0.6, 2.2, -0.8],
    [0.6, 2.2, -0.8]
  ];
  for (const [x, y, z] of legSettings) {
    const side = Math.sign(x);
    const leg = new THREE.Group();
    leg.position.set(x, y, z);
    const hip = sphere(0.16, plum, 0, 0, 0, 10);
    leg.add(hip);
    const thigh = cyl(0.07, 0.1, 1.1, plum, side * 0.34, -0.4, 0.1, 8);
    thigh.rotation.z = side * 0.6;
    thigh.rotation.x = 0.2;
    leg.add(thigh);
    const knee = sphere(0.11, silk, side * 0.6, -0.85, 0.22, 8);
    leg.add(knee);
    const shin = cyl(0.035, 0.06, 1.1, silk, side * 0.8, -1.3, 0.3, 6);
    shin.rotation.z = side * 0.28;
    shin.rotation.x = -0.1;
    leg.add(shin);
    const tip = cone(0.05, 0.3, gold, side * 0.92, -1.85, 0.35, 5);
    leg.add(tip);
    base.add(leg);
    legs.push(leg);
  }

  const loom = new THREE.Group();
  loom.position.set(0, 3.1, -1.8);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.06, 6, 40), gold);
  loom.add(ring);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const spoke = box(0.02, 0.02, 2.4, gold, 0, 0, 0);
    spoke.rotation.z = a;
    loom.add(spoke);
  }
  for (let i = 0; i < 6; i++) {
    const thread = new THREE.Mesh(
      new THREE.PlaneGeometry(0.02, 4.6),
      new THREE.MeshBasicMaterial({ color: "#d8c8b0", transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    thread.position.set((i - 2.5) * 0.7, -1.6, 0.02);
    loom.add(thread);
  }
  base.add(loom);

  const aura = sprite(accent, 0.2, 7);
  aura.position.y = 2.6;
  g.add(aura);
  const core = new THREE.PointLight(new THREE.Color(accent), 1.8, 12, 2);
  core.position.set(0, 3.4, 0.7);
  g.add(core);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.0, 30),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  g.add(shadow);

  const stars = new THREE.Group();
  stars.position.y = 5.0;
  stars.visible = false;
  for (let i = 0; i < 4; i++) stars.add(starSprite(accent, 0.4));
  g.add(stars);

  const flash = sprite("#fff4e0", 0, 6);
  flash.position.y = 3.2;
  g.add(flash);

  let phase = 1;
  let flashT = 0;
  let stun = false;
  let hitT = 0;
  const colors = { 1: new THREE.Color("#ffb98a"), 2: new THREE.Color("#ff8a9e"), 3: new THREE.Color("#ffd98a") };

  g.userData.kind = "weaver";
  g.userData.headY = 4.4;
  g.userData.setPhase = (p) => {
    phase = p;
    eyeMat.color.copy(colors[p] || colors[1]);
    eyeMat.emissive.copy(colors[p] || colors[1]);
    aura.material.color.copy(colors[p] || colors[1]);
    core.color.copy(colors[p] || colors[1]);
  };
  g.userData.setStunned = (v) => {
    stun = !!v;
    stars.visible = stun;
  };
  g.userData.isStunned = () => stun;
  g.userData.hit = () => {
    flashT = 0.3;
    hitT = 1;
  };
  g.userData.update = (dt, time, state = {}) => {
    const rage = phase >= 3 ? 1.6 : phase === 2 ? 1.2 : 1;
    base.position.y = 0.1 + Math.sin(time * 1.2) * 0.14;
    base.rotation.z = Math.sin(time * 0.8) * 0.015;
    head.rotation.z = Math.sin(time * 0.9) * 0.06 + (stun ? Math.sin(time * 8) * 0.2 : 0);
    head.rotation.y = Math.sin(time * 0.55) * 0.14;
    mask.position.y = Math.sin(time * 1.8) * 0.03;
    arms.forEach((arm, i) => {
      arm.rotation.x = Math.sin(time * 1.4 + i * Math.PI) * 0.15;
      arm.rotation.z = Math.sin(time * 0.9 + i) * 0.08;
    });
    legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(time * 1.6 + i * 0.8) * 0.1 * rage;
      leg.rotation.z = Math.sin(time * 1.1 + i) * 0.05;
    });
    hair.forEach((h, i) => {
      h.rotation.z = Math.sin(time * 2 + i) * 0.2;
      h.material.opacity = 0.18 + Math.sin(time * 2.2 + i) * 0.1;
    });
    loom.rotation.z = Math.sin(time * 0.4) * 0.1;
    eyeMat.emissiveIntensity = (1.0 + Math.sin(time * 3 * rage) * 0.35) * (stun ? 0.3 : 1);
    aura.material.opacity = 0.14 + Math.sin(time * 1.5) * 0.05 + (phase - 1) * 0.04;
    pattern.material.opacity = 0.2 + Math.sin(time * 1.8) * 0.1;
    core.intensity = 1.4 + Math.sin(time * 2.4) * 0.4;
    flashT = Math.max(0, flashT - dt);
    flash.material.opacity = flashT * 2.4;
    flash.scale.setScalar(4 + (0.3 - flashT) * 8);
    hitT = Math.max(0, hitT - dt * 4);
    g.scale.setScalar(1 + hitT * 0.02);
    if (stun) {
      stars.children.forEach((s, i) => {
        const a = time * 2 + (i / 4) * Math.PI * 2;
        s.position.set(Math.cos(a) * 1.1, Math.sin(a * 2) * 0.08, Math.sin(a) * 1.1);
      });
    }
  };
  g.userData.parts = { head, arms, legs, loom, mask, eyeMat };
  return setShadows(g);
}

/* -------------------------------------------------------------- factory --- */

const BUILDERS = {
  hushling,
  eel: inkEel,
  hound: thornHound,
  sentinel: cuckooSentinel,
  shadow: shadowJune,
  weaver: weaverBoss
};

export function createEnemy(kind, accent) {
  const builder = BUILDERS[kind] || hushling;
  const enemy = builder(accent || "#8fe3cf");
  enemy.userData.kind = kind;
  return enemy;
}
