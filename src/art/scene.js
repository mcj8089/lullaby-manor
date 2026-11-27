import * as THREE from "three";
import { GAME_CONFIG } from "../../config/game.config.js";
import { createRoomShell, createBossArena, disposeTree } from "./props.js";
import { createWisp, createMemory } from "./jelly.js";
import { Fx } from "./fx.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Owns the renderer, the camera rig and the diorama currently on screen.
 * The game logic lives in src/game/game.js and talks to this through
 * loadRoom/follow/update.
 */
export class Stage {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(this._w(), this._h());
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.38;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.id = "game-canvas";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#04090d");
    this.scene.fog = new THREE.FogExp2("#04090d", 0.036);

    this.camera = new THREE.PerspectiveCamera(GAME_CONFIG.camera.fov, this._w() / this._h(), 0.1, 80);
    this.camera.position.set(0, 15.5, 11.5);

    this.hemi = new THREE.HemisphereLight(0x9ad6c8, 0x1a120c, 0.9);
    this.scene.add(this.hemi);
    this.soft = new THREE.AmbientLight(0xbcd8d0, 0.3);
    this.scene.add(this.soft);

    this.dir = new THREE.DirectionalLight(0xffe0b0, 2.3);
    this.dir.position.set(7, 15, 9);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(2048, 2048);
    this.dir.shadow.camera.left = -14;
    this.dir.shadow.camera.right = 14;
    this.dir.shadow.camera.top = 14;
    this.dir.shadow.camera.bottom = -14;
    this.dir.shadow.camera.near = 2;
    this.dir.shadow.camera.far = 42;
    this.dir.shadow.bias = -0.0006;
    this.dir.shadow.normalBias = 0.02;
    this.scene.add(this.dir);
    this.scene.add(this.dir.target);

    this.rim = new THREE.DirectionalLight(0x7fb9c0, 0.65);
    this.rim.position.set(-9, 6, -6);
    this.scene.add(this.rim);

    this.fill = new THREE.PointLight(0xffd0a0, 18, 32, 2);
    this.fill.position.set(0, 5.5, 5);
    this.scene.add(this.fill);

    this.fx = new Fx(this.scene);

    this.world = null;
    this.ambient = [];
    this.menuPieces = [];
    this.menuWisp = null;
    this.menuMemories = [];
    this.theme = "nursery";
    this.mode = "menu";
    this.bossMode = false;
    this.bounds = { halfW: 9, halfD: 6.4 };
    this.shakeAmt = 0;
    this._followPos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._menuT = 0;
    this._resize = () => this.resize();
    window.addEventListener("resize", this._resize);
    this.resize();
  }

  _w() {
    return Math.max(320, window.innerWidth || 1280);
  }

  _h() {
    return Math.max(320, window.innerHeight || 720);
  }

  resize() {
    const w = this._w();
    const h = this._h();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(w, h);
  }

  _teardown() {
    if (!this.world) return;
    for (const child of [...this.world.children]) {
      this.world.remove(child);
      disposeTree(child);
    }
    this.scene.remove(this.world);
    this.world = null;
    this.ambient = [];
    this.menuWisp = null;
    this.menuMemories = [];
  }

  _atmosphere(theme) {
    const d = GAME_CONFIG.dreams[theme] || GAME_CONFIG.dreams.nursery;
    const sky = new THREE.Color(d.sky);
    this.scene.background = sky;
    this.scene.fog = new THREE.FogExp2(sky.getHex(), d.fog * 0.68);
    this.theme = theme;
    const accent = new THREE.Color(d.accent);
    this.hemi.color.copy(accent).lerp(new THREE.Color("#cfe4ee"), 0.55);
    this.hemi.groundColor.set(d.ink).lerp(new THREE.Color("#6a4d34"), 0.4);
    this.hemi.intensity = 1.55;
    this.dir.color.copy(new THREE.Color("#ffe6c4")).lerp(accent, 0.16);
    this.dir.intensity = theme === "weaver" ? 2.5 : 3.1;
    this.rim.color.copy(accent);
    this.rim.intensity = 1.15;
    this.fill.color.copy(accent).lerp(new THREE.Color("#fff0cf"), 0.55);
    this.fill.intensity = theme === "weaver" ? 26 : 20;
    this.fx.reset();
  }

  loadRoom(theme) {
    this._teardown();
    this.bossMode = false;
    this.world = new THREE.Group();
    this.world.name = "world";
    this.scene.add(this.world);
    this._atmosphere(theme);
    const shell = createRoomShell(theme);
    this.world.add(shell);
    this.bounds = shell.userData.bounds;
    this.mode = "play";
    for (const child of shell.children) {
      if (child.isPoints && child.userData.update) this.ambient.push(child);
    }
    if (shell.userData.mobile) {
      const mobile = shell.userData.mobile;
      this.ambient.push({
        userData: {
          update: (dt, time) => {
            mobile.rotation.y = time * 0.35;
            mobile.position.y = 4.95 + Math.sin(time * 0.8) * 0.04;
          }
        }
      });
    }
    return shell;
  }

  loadBoss() {
    this._teardown();
    this.bossMode = true;
    this.world = new THREE.Group();
    this.world.name = "world";
    this.scene.add(this.world);
    this._atmosphere("weaver");
    const arena = createBossArena();
    this.world.add(arena);
    this.bounds = arena.userData.bounds;
    this.mode = "play";
    this.ambient.push(arena.userData.dust, arena);
    return arena;
  }

  showMenu(theme = "nursery") {
    this._teardown();
    this.bossMode = false;
    this.world = new THREE.Group();
    this.world.name = "menu";
    this.scene.add(this.world);
    this._atmosphere(theme);
    const shell = createRoomShell(theme);
    this.world.add(shell);
    this.bounds = shell.userData.bounds;
    for (const child of shell.children) {
      if (child.isPoints && child.userData.update) this.ambient.push(child);
    }
    if (shell.userData.mobile) {
      const mobile = shell.userData.mobile;
      this.ambient.push({
        userData: {
          update: (dt, time) => {
            mobile.rotation.y = time * 0.3;
          }
        }
      });
    }

    this.menuWisp = createWisp();
    this.menuWisp.position.set(0, 0, 1.4);
    this.menuWisp.scale.setScalar(1.25);
    this.world.add(this.menuWisp);

    const kinds = ["nursery", "study", "garden", "attic", "gallery"];
    kinds.forEach((kind, i) => {
      const mem = createMemory(kind);
      const a = (i / kinds.length) * Math.PI * 2;
      mem.position.set(Math.cos(a) * 2.7, 0.9, 1.2 + Math.sin(a) * 1.4);
      mem.userData.orbit = { a, r: 2.7, speed: 0.14 + i * 0.01, y: 1.05 + i * 0.12 };
      this.world.add(mem);
      this.menuMemories.push(mem);
    });
    this.mode = "menu";
    this.camera.position.set(0, 11.4, 17.2);
    this.camera.lookAt(0, 2.1, 0);
  }

  _cameraTarget(target, velocity) {
    const c = GAME_CONFIG.camera;
    const narrow = this.camera.aspect < 0.95;
    if (this.bossMode) {
      if (narrow) {
        const x = clamp(target.x * 0.5, -4.6, 4.6);
        return { x, z: -0.4, height: 21, back: 17, lookX: x, lookY: 1.8, lookZ: -0.6 };
      }
      return { x: 0, z: -0.4, height: 16.6, back: 13.8, lookX: 0, lookY: 2.2, lookZ: -0.6 };
    }
    const lead = c.lookAhead;
    const tx = target.x + (velocity ? velocity.x * lead * 0.16 : 0);
    const tz = target.z + (velocity ? velocity.z * lead * 0.12 : 0);
    const cx = narrow ? c.narrowClampX : c.followClampX;
    const cz = narrow ? c.narrowClampZ : c.followClampZ;
    const x = clamp(tx, -cx, cx);
    const z = clamp(tz, -cz, cz);
    return {
      x,
      z,
      height: narrow ? c.narrowHeight : c.height,
      back: narrow ? c.narrowBack : c.back,
      lookX: x + (velocity ? velocity.x * 0.1 : 0),
      lookY: 1.15,
      lookZ: z + (velocity ? velocity.z * 0.08 : 0)
    };
  }

  follow(target, velocity, dt) {
    if (this.mode !== "play") return;
    const c = GAME_CONFIG.camera;
    const t = this._cameraTarget(target, velocity);
    this._followPos.set(t.x, t.height, t.z + t.back);
    const k = 1 - Math.exp(-c.follow * dt);
    this.camera.position.lerp(this._followPos, k);
    this._look.set(t.lookX, t.lookY, t.lookZ);
    this.camera.lookAt(this._look);
  }

  shake(amount) {
    this.shakeAmt = Math.min(0.6, Math.max(this.shakeAmt, amount));
  }

  menuCamera(dt, time) {
    if (this.mode !== "menu") return;
    this._menuT += dt;
    const a = Math.sin(time * 0.16) * 0.3;
    this.camera.position.set(Math.sin(a) * 7.5, 11.2 + Math.sin(time * 0.4) * 0.18, 16.8 - Math.cos(a) * 1.2);
    this.camera.lookAt(0, 2.0, 0.6);
  }

  update(dt, time) {
    this.fx.update(dt, time);
    for (const item of this.ambient) {
      if (item && item.userData && item.userData.update) item.userData.update(dt, time);
    }
    if (this.mode === "menu") {
      if (this.menuWisp) this.menuWisp.userData.update(dt, time, 0);
      for (const mem of this.menuMemories) {
        const o = mem.userData.orbit;
        o.a += dt * o.speed;
        mem.position.set(Math.cos(o.a) * o.r, o.y + Math.sin(time * 0.9 + o.a) * 0.12, 1.2 + Math.sin(o.a) * o.r * 0.55);
        mem.rotation.y = time * 0.7 + o.a;
      }
      this.menuCamera(dt, time);
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.7);
  }

  render() {
    const shake = this.shakeAmt;
    let ox = 0;
    let oy = 0;
    if (shake > 0.001) {
      ox = (Math.random() - 0.5) * shake;
      oy = (Math.random() - 0.5) * shake;
      this.camera.position.x += ox;
      this.camera.position.y += oy;
    }
    this.renderer.render(this.scene, this.camera);
    if (ox || oy) {
      this.camera.position.x -= ox;
      this.camera.position.y -= oy;
    }
  }

  dispose() {
    window.removeEventListener("resize", this._resize);
    this._teardown();
    this.fx.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}
