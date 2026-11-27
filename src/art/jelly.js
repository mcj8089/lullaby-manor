import * as THREE from "three";
import { glowTexture, starTexture } from "./textures.js";

/**
 * The player is June's dream shape: a translucent jelly wisp carrying a
 * lantern. The body is a small GLSL wobble shader; the lantern is real light.
 */
const VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  void main() {
    vec3 p = position;
    float w = sin(p.y * 8.0 + uTime * 2.1) * 0.018;
    w += sin(p.x * 10.0 + uTime * 1.6) * 0.015;
    w += sin(p.z * 9.0 - uTime * 2.6) * 0.013;
    p += normal * w;
    vPos = p;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uCore;
  uniform float uAlpha;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  void main() {
    float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.2);
    vec3 col = mix(uColorA, uColorB, fres);
    float heart = smoothstep(0.22, 0.0, length(vPos - vec3(0.0, -0.05, 0.06)));
    float pulse = 0.5 + 0.5 * sin(uTime * 2.3);
    col += uCore * (heart * (0.55 + pulse * 0.25));
    col += uCore * fres * 0.28;
    gl_FragColor = vec4(col, uAlpha * (0.82 + fres * 0.18));
  }
`;

function radialSprite(color, opacity, scale) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

export function createWisp(opts = {}) {
  const dark = !!opts.dark;
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.62;
  group.add(body);

  const uniforms = {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(dark ? "#171425" : "#5fe0cf") },
    uColorB: { value: new THREE.Color(dark ? "#181b35" : "#d9fff6") },
    uCore: { value: new THREE.Color(dark ? "#6d5cff" : "#ffd98a") },
    uAlpha: { value: dark ? 0.95 : 0.94 }
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: true
  });
  const jelly = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 24), mat);
  jelly.scale.set(1, 1.08, 0.94);
  body.add(jelly);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 16, 12),
    new THREE.MeshBasicMaterial({
      color: dark ? "#7f6bff" : "#ffe9ae",
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  core.position.set(0, -0.02, 0.08);
  body.add(core);

  const eyeMat = new THREE.MeshBasicMaterial({ color: dark ? "#d9d1ff" : "#0c2024" });
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), eyeMat);
    eye.scale.set(0.9, 1.25, 0.5);
    eye.position.set(side * 0.145, 0.09, 0.36);
    body.add(eye);
    eyes.push(eye);
    if (!dark) {
      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 8, 8),
        new THREE.MeshBasicMaterial({ color: "#ffffff" })
      );
      glint.position.set(side * 0.12, 0.14, 0.405);
      body.add(glint);
    }
  }

  // scarf / collar
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.045, 8, 28),
    new THREE.MeshStandardMaterial({
      color: dark ? "#3a2b55" : "#f0b45f",
      roughness: 0.55,
      metalness: 0.15,
      emissive: dark ? "#150f25" : "#5a2c10",
      emissiveIntensity: 0.4
    })
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = -0.2;
  collar.scale.set(1, 1, 0.7);
  body.add(collar);
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.52, 8, 1, true),
    new THREE.MeshStandardMaterial({
      color: dark ? "#261c3d" : "#d89c4e",
      roughness: 0.7,
      side: THREE.DoubleSide
    })
  );
  tail.position.set(0.1, -0.34, -0.22);
  tail.rotation.z = -0.4;
  tail.rotation.x = 0.5;
  body.add(tail);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  shadow.scale.set(1, 0.7, 1);
  group.add(shadow);

  const aura = radialSprite(dark ? "#392f70" : "#76e5d3", 0.35, 1.55);
  aura.position.y = 0.62;
  group.add(aura);

  let lantern = null;
  let lanternLight = null;
  let handle = null;
  if (!dark) {
    lantern = new THREE.Group();
    lantern.position.set(0.46, -0.08, 0.06);
    body.add(lantern);

    const cage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 0.26, 8, 1, true),
      new THREE.MeshStandardMaterial({
        color: "#c79a55",
        roughness: 0.35,
        metalness: 0.75,
        side: THREE.DoubleSide
      })
    );
    cage.position.y = -0.05;
    lantern.add(cage);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.11, 8),
      new THREE.MeshStandardMaterial({ color: "#8c6734", roughness: 0.4, metalness: 0.7 })
    );
    cap.position.y = 0.12;
    lantern.add(cap);
    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.11, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: "#8c6734", roughness: 0.4, metalness: 0.7 })
    );
    bottom.position.y = -0.2;
    lantern.add(bottom);
    const fire = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#ffe0a0" })
    );
    fire.position.y = -0.03;
    lantern.add(fire);
    const fireGlow = radialSprite("#ffc66b", 0.85, 0.7);
    fireGlow.position.y = -0.03;
    lantern.add(fireGlow);
    handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.018, 6, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: "#b08545", roughness: 0.4, metalness: 0.8 })
    );
    handle.position.y = 0.18;
    lantern.add(handle);
    lanternLight = new THREE.PointLight(0xffc37a, 4.8, 11.5, 1.5);
    lanternLight.position.set(0, 0, 0);
    lantern.add(lanternLight);
  }

  const star = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starTexture(),
      color: dark ? "#7f6bff" : "#ffe7ae",
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  star.scale.set(0.3, 0.3, 1);
  star.position.set(-0.12, 0.36, 0.34);
  body.add(star);

  let t = Math.random() * 10;
  let blink = 0;
  let nextBlink = 2.6;

  group.userData.update = (dt, time, speed = 0) => {
    t += dt;
    uniforms.uTime.value = t;
    const bob = Math.sin(t * 2.1) * 0.045 + (speed > 0.2 ? Math.sin(t * 9) * 0.02 : 0);
    body.position.y = 0.66 + bob;
    body.rotation.z = Math.sin(t * 1.3) * 0.035 - (speed > 0.2 ? Math.sin(t * 7) * 0.03 : 0);
    body.scale.set(1 + Math.sin(t * 2.4) * 0.012, 1 - Math.sin(t * 2.4) * 0.014, 1 + Math.cos(t * 2.1) * 0.01);
    star.material.opacity = 0.35 + Math.sin(t * 3.1) * 0.2;
    if (lantern) {
      lantern.rotation.z = Math.sin(t * 2.6) * 0.16;
      lantern.rotation.x = Math.sin(t * 2.1 + 1) * 0.07;
      const flicker = 4.4 + Math.sin(t * 11.3) * 0.4 + Math.sin(t * 23.7) * 0.18;
      if (lanternLight) lanternLight.intensity = flicker;
    }
    blink -= dt;
    if (blink <= 0) {
      blink = nextBlink;
      nextBlink = 2.4 + Math.random() * 3.8;
    }
    const closed = blink > 2.18 ? Math.max(0.08, 1 - (blink - 2.18) * 9) : 1;
    for (const eye of eyes) eye.scale.y = 1.25 * closed;
  };

  group.userData.aura = aura;
  group.userData.body = body;
  group.userData.lantern = lantern;
  return group;
}

export function createMemory(kind) {
  const group = new THREE.Group();
  const accent = {
    nursery: "#ffe39a",
    study: "#f6e9c8",
    garden: "#e8f3ff",
    attic: "#ffcf7a",
    gallery: "#bcdcff",
    weaver: "#fff0c0"
  }[kind] || "#ffe39a";
  const glow = radialSprite(accent, 0.9, 1.6);
  group.add(glow);
  const matGold = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.2,
    metalness: 0.4,
    roughness: 0.25
  });

  if (kind === "nursery") {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), matGold);
    head.scale.set(1.2, 1, 0.55);
    head.rotation.z = -0.4;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), matGold);
    stem.position.set(0.12, 0.16, 0);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.02), matGold);
    flag.position.set(0.23, 0.34, 0);
    flag.rotation.z = -0.35;
    group.add(head, stem, flag);
  } else if (kind === "study") {
    const page = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.02, 0.44),
      new THREE.MeshStandardMaterial({ color: accent, emissive: "#5a4b32", emissiveIntensity: 0.4, roughness: 0.9 })
    );
    page.rotation.z = 0.12;
    page.rotation.x = 0.08;
    const page2 = page.clone();
    page2.position.y = 0.03;
    page2.rotation.z = -0.18;
    group.add(page, page2);
  } else if (kind === "garden") {
    const boneMat = new THREE.MeshStandardMaterial({ color: "#f2efe3", emissive: "#6b7c8f", emissiveIntensity: 0.6, roughness: 0.5 });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.38, 8), boneMat);
    bar.rotation.z = Math.PI / 2;
    group.add(bar);
    for (const s of [-1, 1]) {
      for (const y of [-1, 1]) {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), boneMat);
        knob.position.set(s * 0.19, y * 0.06, 0);
        group.add(knob);
      }
    }
  } else if (kind === "attic") {
    const gear = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.05, 8, 20),
      new THREE.MeshStandardMaterial({ color: "#d8a351", emissive: "#8b5a1c", emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.3 })
    );
    group.add(gear);
    for (let i = 0; i < 8; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), gear.material);
      const a = (i / 8) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0);
      tooth.rotation.z = a;
      group.add(tooth);
    }
  } else if (kind === "gallery") {
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({
        color: "#cfe6ff",
        emissive: "#7fa8e0",
        emissiveIntensity: 0.8,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.92
      })
    );
    shard.scale.set(0.7, 1.5, 0.35);
    group.add(shard);
  } else {
    const mote = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 14, 12),
      new THREE.MeshBasicMaterial({ color: "#fff4c4" })
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.014, 6, 24),
      new THREE.MeshBasicMaterial({ color: "#ffd98a", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
    );
    halo.rotation.x = 0.7;
    group.add(mote, halo);
  }

  group.userData.baseY = 0.85;
  group.userData.spin = Math.random() * Math.PI * 2;
  return group;
}
