/**
 * Keyboard + touch input.
 * Movement is a single normalised vector; tiptoe is a modifier, and the E
 * ability is edge-triggered so holding the key never fires twice.
 */
export class Input {
  constructor(hooks) {
    this.hooks = hooks || {};
    this.keys = new Set();
    this.vec = { x: 0, z: 0 };
    this.quiet = false;
    this.enabled = false;
    this.touch = { active: false, pointerId: null, x: 0, y: 0 };
    this._actionQueued = false;
    this._quietToggle = false;
    this._joystick = null;
    this._knob = null;
    this._bound = false;
  }

  bind() {
    if (this._bound) return;
    this._bound = true;
    window.addEventListener("keydown", (e) => this._onKey(e, true));
    window.addEventListener("keyup", (e) => this._onKey(e, false));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.quiet = false;
      this._setTouchVector(0, 0);
    });
  }

  _typingTarget(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }

  _onKey(e, down) {
    if (this._typingTarget(e)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const handled = [
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ",
      "w", "a", "s", "d", "W", "A", "S", "D", "e", "E",
      "Shift", "p", "P", "Escape", "m", "M"
    ];
    if (handled.includes(k) || handled.includes(e.key)) e.preventDefault();
    if (e.repeat && down) return;

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (down) {
      this.keys.add(key);
      if (key === "e" && this.enabled && this.hooks.onAbility) this.hooks.onAbility();
      if ((key === "p" || key === "Escape") && this.hooks.onPause) this.hooks.onPause();
      if (key === "m" && this.hooks.onMute) this.hooks.onMute();
      if (key === "Shift") {
        this.quiet = true;
        if (this.hooks.onQuiet) this.hooks.onQuiet(true);
      }
    } else {
      this.keys.delete(key);
      if (key === "Shift") {
        this.quiet = false;
        if (this.hooks.onQuiet) this.hooks.onQuiet(false);
      }
    }
  }

  attachJoystick(base, knob) {
    if (!base) return;
    this._joystick = base;
    this._knob = knob;
    const active = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.touch.active = true;
      this.touch.pointerId = e.pointerId;
      base.setPointerCapture?.(e.pointerId);
      this._moveStick(e);
    };
    const move = (e) => {
      if (!this.touch.active || e.pointerId !== this.touch.pointerId) return;
      e.preventDefault();
      this._moveStick(e);
    };
    const end = (e) => {
      if (e.pointerId !== this.touch.pointerId) return;
      this.touch.active = false;
      this.touch.pointerId = null;
      base.classList.remove("active");
      if (this._knob) this._knob.style.transform = "translate(-50%, -50%)";
      this._setTouchVector(0, 0);
    };
    base.addEventListener("pointerdown", active);
    base.addEventListener("pointermove", move);
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);
    base.addEventListener("pointerleave", (e) => {
      if (this.touch.active && e.pointerId === this.touch.pointerId) end(e);
    });
  }

  _moveStick(e) {
    const r = this._joystick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = r.width * 0.36;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    if (this._knob) this._knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this._joystick.classList.add("active");
    this._setTouchVector(dx / max, dy / max);
  }

  _setTouchVector(x, y) {
    this.touch.x = x;
    this.touch.y = y;
  }

  attachAction(btn) {
    if (!btn) return;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.triggerAbility();
    });
  }

  attachQuiet(btn) {
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      this._quietToggle = !this._quietToggle;
      this.quiet = this._quietToggle;
      btn.classList.toggle("on", this.quiet);
      if (this.hooks.onQuiet) this.hooks.onQuiet(this.quiet);
    });
  }

  triggerAbility() {
    if (!this.enabled) return;
    if (this.hooks.onAbility) this.hooks.onAbility();
  }

  setQuietUI(on) {
    this._quietToggle = !!on;
    this.quiet = !!on;
  }

  get moveVector() {
    let x = 0;
    let z = 0;
    if (this.keys.has("ArrowLeft") || this.keys.has("a")) x -= 1;
    if (this.keys.has("ArrowRight") || this.keys.has("d")) x += 1;
    if (this.keys.has("ArrowUp") || this.keys.has("w")) z -= 1;
    if (this.keys.has("ArrowDown") || this.keys.has("s")) z += 1;
    if (this.touch.active) {
      x += this.touch.x;
      z += this.touch.y;
    }
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    this.vec.x = x;
    this.vec.z = z;
    return this.vec;
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!on) {
      this.keys.clear();
      this._setTouchVector(0, 0);
      this.touch.active = false;
    }
  }

  reset() {
    this.keys.clear();
    this._quietToggle = false;
    this.quiet = false;
    this._setTouchVector(0, 0);
  }
}
