import * as THREE from "three";
import { glowTexture } from "./textures.js";

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (250.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.02, d);
    a = pow(a, 1.7);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

const CAPACITY = 520;

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "fx";
    scene.add(this.group);

    this.particles = [];
    for (let i = 0; i < CAPACITY; i++) {
      this.particles.push({
        alive: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, max: 1, size: 1, gravity: -2, drag: 1, alpha: 1,
        r: 1, g: 1, b: 1
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(CAPACITY * 3), 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(CAPACITY * 3), 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.group.add(this.points);

    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.82, 1, 48);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: "#ffffff",
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 4;
      this.group.add(m);
      this.rings.push({ mesh: m, life: 0, max: 1, radius: 1, fade: 0.6, grow: 1, delay: 0 });
    }

    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 8, 2);
      l.visible = false;
      this.group.add(l);
      this.lights.push({ light: l, life: 0, max: 1, peak: 1 });
    }

    this.telegraphs = [];
    this.beams = [];
  }

  _color(c) {
    return c && c.isColor ? c : new THREE.Color(c || "#ffffff");
  }

  burst(pos, color, count = 22, opts = {}) {
    const c = this._color(color);
    const speed = opts.speed == null ? 2.2 : opts.speed;
    const spread = opts.spread == null ? 0.18 : opts.spread;
    const life = opts.life == null ? 0.8 : opts.life;
    const size = opts.size == null ? 0.5 : opts.size;
    const gravity = opts.gravity == null ? -2.4 : opts.gravity;
    const up = opts.up == null ? 1.1 : opts.up;
    let spawned = 0;
    for (const p of this.particles) {
      if (spawned >= count) break;
      if (p.alive) continue;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.35 + Math.random() * 0.85);
      p.alive = true;
      p.x = pos.x + (Math.random() - 0.5) * spread;
      p.y = pos.y + (Math.random() - 0.5) * spread + (opts.yOffset || 0);
      p.z = pos.z + (Math.random() - 0.5) * spread;
      p.vx = Math.cos(a) * Math.cos(b) * s;
      p.vy = Math.sin(b) * s + up;
      p.vz = Math.sin(a) * Math.cos(b) * s;
      p.life = p.max = life * (0.65 + Math.random() * 0.7);
      p.size = size * (0.6 + Math.random() * 0.8);
      p.gravity = gravity;
      p.drag = opts.drag == null ? 1.8 : opts.drag;
      p.alpha = opts.alpha == null ? 1 : opts.alpha;
      p.r = c.r;
      p.g = c.g;
      p.b = c.b;
      spawned += 1;
    }
  }

  /** Two coloured puffs, good for footsteps, pickups and dust. */
  sparkle(pos, color, count = 6) {
    this.burst(pos, color, count, { speed: 1.1, up: 0.6, life: 0.55, size: 0.34, gravity: -1.1 });
  }

  /** Flat and vertical waves for the bell / pulse / whistle abilities. */
  pulse(pos, color, radius = 5, opts = {}) {
    this.ring(pos, color, radius, { y: opts.y == null ? 0.12 : opts.y, life: 0.62, fade: 0.75 });
    if (opts.vertical !== false) {
      for (const [axis, rot] of [["x", 0], ["z", 0]]) {
        const slot = this._freeRing();
        if (!slot) break;
        this._startRing(slot, pos, color, radius, { life: 0.55, fade: 0.5, y: 0.75 });
        if (axis === "x") slot.mesh.rotation.set(0, 0, 0);
        else slot.mesh.rotation.set(0, Math.PI / 2, 0);
        void rot;
      }
    }
  }

  ring(pos, color, radius = 3, opts = {}) {
    const slot = this._freeRing();
    if (!slot) return;
    this._startRing(slot, pos, color, radius, opts);
  }

  _freeRing() {
    for (const r of this.rings) if (r.life <= 0) return r;
    return null;
  }

  _startRing(slot, pos, color, radius, opts = {}) {
    slot.mesh.rotation.set(-Math.PI / 2, 0, 0);
    slot.mesh.position.set(pos.x, (opts.y == null ? 0.1 : opts.y), pos.z);
    slot.mesh.material.color.copy(this._color(color));
    slot.mesh.material.opacity = opts.opacity == null ? 0.8 : opts.opacity;
    slot.mesh.scale.setScalar(0.15);
    slot.mesh.visible = true;
    slot.life = slot.max = opts.life == null ? 0.5 : opts.life;
    slot.radius = radius;
    slot.fade = opts.fade == null ? 0.8 : opts.fade;
    slot.grow = opts.grow == null ? 1 : opts.grow;
  }

  flashLight(pos, color, intensity = 2.2, life = 0.3) {
    let slot = null;
    for (const l of this.lights) {
      if (l.life <= 0) {
        slot = l;
        break;
      }
    }
    if (!slot) slot = this.lights[0];
    slot.light.position.copy(pos);
    slot.light.color.copy(this._color(color));
    slot.light.intensity = intensity;
    slot.light.distance = 8;
    slot.light.visible = true;
    slot.life = slot.max = life;
    slot.peak = intensity;
  }

  /** A pulsing floor circle that warns before an attack lands. */
  telegraph(pos, color, radius = 2.2, duration = 1.1, opts = {}) {
    const group = new THREE.Group();
    group.position.set(pos.x, 0.06, pos.z);
    const c = this._color(color);
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    fill.rotation.x = -Math.PI / 2;
    group.add(fill);
    const edge = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 48),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    );
    edge.rotation.x = -Math.PI / 2;
    group.add(edge);
    if (opts.column) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 0.7, 5, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
      );
      col.position.y = 2.5;
      col.name = "column";
      group.add(col);
    }
    this.group.add(group);
    const entry = { group, fill, edge, life: 0, duration, radius, dead: false, opts };
    this.telegraphs.push(entry);
    return {
      group,
      progress: () => Math.min(1, entry.life / entry.duration),
      remove: () => {
        entry.dead = true;
      }
    };
  }

  createBeam(color, width = 0.08) {
    const geo = new THREE.CylinderGeometry(width, width, 1, 8, 1, true);
    geo.translate(0, 0.5, 0);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = 0.2;
    this.group.add(mesh);
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const handle = {
      mesh,
      material,
      set(from, to) {
        dir.subVectors(to, from);
        const len = dir.length();
        mesh.position.copy(from);
        mesh.quaternion.setFromUnitVectors(up, dir.clone().normalize());
        mesh.scale.set(1, Math.max(0.001, len), 1);
      },
      dispose() {
        mesh.parent && mesh.parent.remove(mesh);
        geo.dispose();
        material.dispose();
      }
    };
    this.beams.push(handle);
    return handle;
  }

  clearBeams() {
    for (const b of this.beams) b.dispose();
    this.beams.length = 0;
  }

  update(dt, time = 0) {
    const geo = this.points.geometry;
    const posAttr = geo.attributes.position;
    const colAttr = geo.attributes.aColor;
    const sizeAttr = geo.attributes.aSize;
    const alphaAttr = geo.attributes.aAlpha;
    const pos = posAttr.array;
    const col = colAttr.array;
    const sizes = sizeAttr.array;
    const alphas = alphaAttr.array;
    for (let i = 0; i < CAPACITY; i++) {
      const p = this.particles[i];
      if (!p.alive) {
        alphas[i] = 0;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        alphas[i] = 0;
        continue;
      }
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vz *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.03) {
        p.y = 0.03;
        p.vy *= -0.2;
        p.vx *= 0.7;
        p.vz *= 0.7;
      }
      const f = p.life / p.max;
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      col[i * 3] = p.r;
      col[i * 3 + 1] = p.g;
      col[i * 3 + 2] = p.b;
      sizes[i] = p.size * (0.4 + f * 0.6);
      alphas[i] = Math.min(1, f * 1.5) * p.alpha;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;

    for (const r of this.rings) {
      if (r.life <= 0) {
        r.mesh.visible = false;
        continue;
      }
      r.life -= dt;
      const k = 1 - Math.max(0, r.life) / r.max;
      const s = 0.15 + (r.radius - 0.15) * Math.min(1, k * 1.3);
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = Math.max(0, (1 - k) * r.fade);
      if (r.life <= 0) r.mesh.visible = false;
    }

    for (const l of this.lights) {
      if (l.life <= 0) {
        l.light.visible = false;
        continue;
      }
      l.life -= dt;
      l.light.intensity = l.peak * Math.max(0, l.life / l.max);
      if (l.life <= 0) l.light.visible = false;
    }

    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      if (t.dead) {
        this.group.remove(t.group);
        t.group.traverse((o) => {
          if (o.isMesh) {
            o.geometry.dispose();
            o.material.dispose();
          }
        });
        this.telegraphs.splice(i, 1);
        continue;
      }
      t.life += dt;
      const k = Math.min(1, t.life / t.duration);
      const s = t.radius * (0.25 + k * 0.75);
      t.fill.scale.setScalar(s);
      t.edge.scale.setScalar(s);
      t.fill.material.opacity = 0.06 + k * 0.16 + Math.sin(time * 14) * 0.02;
      t.edge.material.opacity = 0.35 + k * 0.45;
      const column = t.group.getObjectByName("column");
      if (column) {
        column.scale.set(s * 0.7, 1, s * 0.7);
        column.material.opacity = k * 0.12;
      }
      if (k >= 1) {
        this.burst(t.group.position, t.edge.material.color, 18, {
          speed: 2.4,
          up: 2.2,
          life: 0.7,
          size: 0.5,
          spread: 0.6
        });
        t.dead = true;
      }
    }
  }

  reset() {
    for (const p of this.particles) p.alive = false;
    for (const r of this.rings) {
      r.life = 0;
      r.mesh.visible = false;
    }
    for (const l of this.lights) {
      l.life = 0;
      l.light.visible = false;
    }
    for (const t of this.telegraphs) {
      this.group.remove(t.group);
      t.group.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          o.material.dispose();
        }
      });
    }
    this.telegraphs.length = 0;
    this.clearBeams();
  }

  dispose() {
    this.reset();
    this.points.geometry.dispose();
    this.points.material.dispose();
    for (const r of this.rings) {
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
    }
    this.scene.remove(this.group);
  }
}

export { glowTexture };
