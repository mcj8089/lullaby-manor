import * as THREE from "three";
import { GAME_CONFIG } from "../../config/game.config.js";
import { glowTexture, starTexture } from "../art/textures.js";

function charmMesh(id, accent) {
  const g = new THREE.Group();
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color: accent,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  glow.scale.set(0.8, 0.8, 1);
  g.add(glow);

  const gold = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.7,
    metalness: 0.5,
    roughness: 0.3
  });

  if (id === "ollie") {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 0.07 : 0.16;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }), gold);
    star.rotation.x = -0.5;
    g.add(star);
  } else if (id === "theo") {
    const plane = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 3), gold);
    plane.rotation.z = Math.PI / 2;
    plane.rotation.y = 0.4;
    g.add(plane);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.2), gold);
    wing.position.set(0, 0.04, -0.03);
    wing.rotation.z = 0.3;
    g.add(wing);
  } else if (id === "biscuit") {
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6), gold);
    bone.rotation.z = Math.PI / 2;
    g.add(bone);
    for (const s of [-1, 1]) {
      for (const y of [-1, 1]) {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), gold);
        knob.position.set(s * 0.1, y * 0.035, 0);
        g.add(knob);
      }
    }
  } else if (id === "clara") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 14), gold);
    g.add(ring);
    for (let i = 0; i < 6; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), gold);
      const a = (i / 6) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * 0.115, Math.sin(a) * 0.115, 0);
      tooth.rotation.z = a;
      g.add(tooth);
    }
  } else {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), gold);
    shard.scale.set(0.55, 1.3, 0.35);
    g.add(shard);
  }
  const spark = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starTexture(),
      color: "#fff3cf",
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  spark.scale.set(0.22, 0.22, 1);
  spark.position.set(0.09, 0.12, 0);
  g.add(spark);
  g.userData.glow = glow;
  g.userData.spark = spark;
  g.userData.accent = accent;
  return g;
}

/**
 * The rescued family floor around June. Every charm is one free hit; when it
 * shatters the charm is gone until the next stage starts.
 */
export class Swarm {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.name = "swarm";
    parent.add(this.group);
    this.members = [];
    this.remaining = 0;
    this.time = 0;
    this._pos = new THREE.Vector3();
    this._target = new THREE.Vector3();
  }

  setMembers(ids, extra = 0) {
    for (const m of this.members) {
      this.group.remove(m.mesh);
      m.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.members = [];
    const list = (ids || []).slice();
    for (let i = 0; i < extra; i++) list.push("spark");
    list.forEach((id, i) => {
      const info = GAME_CONFIG.family[id] || { accent: "#ffd98a" };
      const mesh = charmMesh(id, info.accent || "#ffe0a0");
      mesh.userData.baseAngle = (i / Math.max(1, list.length)) * Math.PI * 2;
      mesh.userData.phase = i * 1.7;
      this.group.add(mesh);
      this.members.push({ id, mesh, active: true, absorb: 0 });
    });
    this.remaining = this.members.length;
  }

  hasGuards() {
    return this.remaining > 0;
  }

  /** Break the closest charm and return its world position (for the hit FX). */
  shatter(pos) {
    if (!this.members.length) return null;
    let best = null;
    let bestD = Infinity;
    for (const m of this.members) {
      if (!m.active) continue;
      const d = pos ? m.mesh.position.distanceToSquared(pos) : 0;
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    if (!best) return null;
    best.active = false;
    best.absorb = 1;
    best.mesh.visible = false;
    this.remaining = Math.max(0, this.remaining - 1);
    return { position: best.mesh.position.clone(), accent: best.mesh.userData.accent };
  }

  restore() {
    for (const m of this.members) {
      m.active = true;
      m.absorb = 0;
      m.mesh.visible = true;
      m.mesh.scale.setScalar(1);
    }
    this.remaining = this.members.length;
  }

  update(dt, time, target, moving) {
    this.time += dt;
    this._pos.lerp(target, Math.min(1, dt * 8));
    const sway = moving ? 1 : 0.55;
    this.members.forEach((m, i) => {
      const mesh = m.mesh;
      if (!m.active) return;
      const a = mesh.userData.baseAngle + time * 0.85 * sway + Math.sin(time * 0.7 + i) * 0.12;
      const radius = 1.02 + Math.sin(time * 1.1 + i * 1.4) * 0.08;
      this._target.set(
        target.x + Math.cos(a) * radius,
        0.82 + Math.sin(time * 1.8 + mesh.userData.phase) * 0.1,
        target.z + Math.sin(a) * radius
      );
      mesh.position.lerp(this._target, Math.min(1, dt * 6));
      mesh.rotation.y = time * 1.2 + i;
      mesh.rotation.z = Math.sin(time * 1.6 + i) * 0.2;
      const pulse = 0.4 + Math.sin(time * 2.4 + i) * 0.12;
      mesh.userData.glow.material.opacity = pulse;
      mesh.userData.spark.material.opacity = 0.4 + Math.sin(time * 3 + i) * 0.2;
      mesh.scale.setScalar(1 + Math.sin(time * 2 + i) * 0.04);
    });
  }

  dispose() {
    for (const m of this.members) {
      m.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.members = [];
    this.group.parent && this.group.parent.remove(this.group);
  }
}
