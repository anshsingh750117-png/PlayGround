import { clamp } from './utils.js';

export class Input {
  constructor(dom, audio) {
    this.dom = dom;
    this.audio = audio;
    this.keys = new Set();
    this.lookX = 0; this.lookY = 0;
    this.firing = false; this.aiming = false; this.sprinting = false;
    this.jumpQueued = false; this.interactQueued = false; this.reloadQueued = false;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.stick = { x: 0, y: 0, active: false, id: null };
    this.lookActive = false; this.lookId = null; this.lastLook = null;
    this.enabled = true;
    this.locked = false;
    this.callbacks = {};
    this.bind();
    if (this.touch) document.body.classList.add('touch');
  }

  on(name, cb) { this.callbacks[name] = cb; }

  bind() {
    addEventListener('keydown', (e) => {
      if (e.repeat) { if (['Space'].includes(e.code)) e.preventDefault(); return; }
      this.keys.add(e.code);
      if (e.code === 'Escape') this.emit('pause');
      if (e.code === 'KeyQ') this.emit('phone');
      if (e.code === 'KeyM') this.emit('map');
      if (e.code === 'Tab') { e.preventDefault(); this.emit('map'); }
      if (e.code === 'KeyE') this.interactQueued = true;
      if (e.code === 'KeyR') this.reloadQueued = true;
      if (e.code === 'KeyF') this.emit('vehicle');
      if (e.code === 'Space') { this.jumpQueued = true; e.preventDefault(); }
      if (e.code === 'KeyH') this.emit('horn');
      if (/^Digit[1-8]$/.test(e.code)) this.emit('weapon', Number(e.code.slice(5)) - 1);
      if (e.code === 'KeyC') this.emit('crouch');
      if (e.code === 'KeyT') this.emit('radio');
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.firing = false; this.aiming = false; });

    const canvas = this.dom;
    canvas.addEventListener('mousedown', (e) => {
      if (!this.touch) {
        if (!this.locked && e.button === 0) { this.dom.requestPointerLock?.(); return; }
        if (e.button === 0) this.firing = true;
        if (e.button === 2) this.aiming = true;
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.firing = false;
      if (e.button === 2) this.aiming = false;
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      this.emit('lock', this.locked);
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const s = 0.0022;
      this.lookX += e.movementX * s;
      this.lookY += e.movementY * s;
    });

    // ---- touch ----
    const stickZone = document.getElementById('stickZone');
    const base = document.getElementById('stickBase');
    const knob = document.getElementById('stickKnob');
    const lookZone = document.getElementById('touchLook');
    if (stickZone) {
      stickZone.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.stick.active = true; this.stick.id = e.pointerId;
        const r = base.getBoundingClientRect();
        this.stick.cx = r.left + r.width / 2; this.stick.cy = r.top + r.height / 2;
        this.updateStick(e.clientX, e.clientY, knob);
        stickZone.setPointerCapture(e.pointerId);
      });
      stickZone.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.stick.id) return;
        this.updateStick(e.clientX, e.clientY, knob);
      });
      const end = (e) => {
        if (e.pointerId !== this.stick.id) return;
        this.stick.active = false; this.stick.x = 0; this.stick.y = 0; this.stick.id = null;
        if (knob) knob.style.transform = 'translate(0,0)';
      };
      stickZone.addEventListener('pointerup', end);
      stickZone.addEventListener('pointercancel', end);
    }
    if (lookZone) {
      lookZone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.lookActive = true; this.lookId = e.pointerId; this.lastLook = { x: e.clientX, y: e.clientY };
        lookZone.setPointerCapture(e.pointerId);
      });
      lookZone.addEventListener('pointermove', (e) => {
        if (!this.lookActive || e.pointerId !== this.lookId) return;
        const dx = e.clientX - this.lastLook.x;
        const dy = e.clientY - this.lastLook.y;
        this.lastLook = { x: e.clientX, y: e.clientY };
        this.lookX += dx * 0.005;
        this.lookY += dy * 0.005;
      });
      const endLook = (e) => { if (e.pointerId === this.lookId) { this.lookActive = false; this.lookId = null; } };
      lookZone.addEventListener('pointerup', endLook);
      lookZone.addEventListener('pointercancel', endLook);
    }
    this.bindHold('tFire', (on) => { this.firing = on; });
    this.bindHold('tAim', (on) => { this.aiming = on; });
    this.bindHold('tRun', (on) => { this.sprinting = on; });
    this.bindTap('tJump', () => { this.jumpQueued = true; });
    this.bindTap('tReload', () => { this.reloadQueued = true; });
    this.bindTap('tInteract', () => { this.interactQueued = true; });
    this.bindTap('tPhone', () => this.emit('phone'));
    this.bindTap('tPause', () => this.emit('pause'));
  }

  updateStick(x, y, knob) {
    const r = document.getElementById('stickBase').getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = x - cx, dy = y - cy;
    const max = r.width / 2 - 10;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx /= len; dy /= len; dx *= max; dy *= max; }
    this.stick.x = dx / max;
    this.stick.y = dy / max;
    if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
  }

  bindHold(id, cb) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); cb(true); this.audio?.click(); });
    const up = (e) => { e.stopPropagation(); el.classList.remove('down'); cb(false); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => { if (e.buttons) up(e); });
  }
  bindTap(id, cb) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); cb(); this.audio?.click(); });
    el.addEventListener('pointerup', (e) => { e.stopPropagation(); el.classList.remove('down'); });
    el.addEventListener('pointercancel', () => el.classList.remove('down'));
  }

  emit(name, v) { this.callbacks[name]?.(v); }

  get forward() {
    let f = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    if (this.stick.active) f += -this.stick.y;
    return clamp(f, -1, 1);
  }
  get right() {
    let r = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    if (this.stick.active) r += this.stick.x;
    return clamp(r, -1, 1);
  }
  get sprintHeld() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.sprinting;
  }
  consumeLook() {
    const l = { x: this.lookX, y: this.lookY };
    this.lookX = 0; this.lookY = 0;
    return l;
  }
  consumeJump() { const j = this.jumpQueued; this.jumpQueued = false; return j; }
  consumeInteract() { const i = this.interactQueued; this.interactQueued = false; return i; }
  consumeReload() { const r = this.reloadQueued; this.reloadQueued = false; return r; }
  clearOneShots() { this.jumpQueued = false; this.interactQueued = false; this.reloadQueued = false; this.lookX = 0; this.lookY = 0; }
}
