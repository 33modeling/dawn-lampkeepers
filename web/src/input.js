// 입력: 키보드(WASD·방향키), 터치 가상 조이스틱(화면 아무 곳이나 눌러 끌기), 게임패드(왼쪽 스틱·D패드)
export class Input {
  constructor(surface, stickBase, stickKnob) {
    this.keys = new Set();
    this.touch = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.base = stickBase;
    this.knob = stickKnob;
    this.padButtons = {};
    this.onPadButton = null;
    this.R = 56;
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    surface.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this.touch.id !== null) return;
      this.touch = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      surface.setPointerCapture?.(e.pointerId);
      this.showStick(true);
      e.preventDefault();
    });
    surface.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.touch.id) return;
      this.touch.x = e.clientX; this.touch.y = e.clientY;
      this.showStick(true);
    });
    const end = (e) => { if (e.pointerId === this.touch.id) { this.touch.id = null; this.showStick(false); } };
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);
  }

  showStick(on) {
    if (!this.base) return;
    this.base.hidden = !on;
    if (!on) return;
    const t = this.touch;
    let dx = t.x - t.ox, dy = t.y - t.oy;
    const d = Math.hypot(dx, dy);
    if (d > this.R) { dx = (dx / d) * this.R; dy = (dy / d) * this.R; }
    this.base.style.transform = `translate(${t.ox - 64}px, ${t.oy - 64}px)`;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  reset() { this.keys.clear(); this.touch.id = null; this.showStick(false); }

  // 게임패드 단추 눌림(가장자리)만 알린다: 0=A, 1=B, 9=시작, 12~15=D패드
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      gp.buttons.forEach((b, i) => {
        const was = this.padButtons[i];
        this.padButtons[i] = b.pressed;
        if (b.pressed && !was && this.onPadButton) this.onPadButton(i);
      });
      return gp;
    }
    return null;
  }

  vector() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (this.touch.id !== null) {
      const dx = this.touch.x - this.touch.ox, dy = this.touch.y - this.touch.oy;
      const d = Math.hypot(dx, dy);
      if (d > 6) { const m = Math.min(1, d / this.R); x += (dx / d) * m; y += (dy / d) * m; }
    }
    const gp = this.pollPad();
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.2) { x += ax; y += ay; }
      if (gp.buttons[14]?.pressed) x -= 1;
      if (gp.buttons[15]?.pressed) x += 1;
      if (gp.buttons[12]?.pressed) y -= 1;
      if (gp.buttons[13]?.pressed) y += 1;
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }
}

// 자동 플레이(시험·데모): 아주 가까운 적은 피하고, 조금 먼 무리 쪽으로는 다가가며(무기 사거리), 별가루·복주머니를 줍는다
export function autoPilot(g) {
  const p = g.player;
  let ax = 0, ay = 0, cx = 0, cy = 0, cn = 0;
  for (const e of g.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
    const danger = (e.r + 48) * (e.boss ? 2 : 1);
    if (d2 < danger * danger && d2 > 1) { const w = 1 / d2; ax += dx * w; ay += dy * w; }
    else if (d2 < 420 * 420) { cx -= dx; cy -= dy; cn++; }
  }
  let best = null, bd = 300 * 300;
  for (const gem of g.gems) {
    const d = (gem.x - p.x) ** 2 + (gem.y - p.y) ** 2;
    if (d < bd) { bd = d; best = gem; }
  }
  for (const u of g.pickups) if (u.kind === 'chest' || u.kind === 'rice') { best = u; bd = (u.x - p.x) ** 2 + (u.y - p.y) ** 2; break; }
  let x = ax * 9000, y = ay * 9000;
  if (best) { const d = Math.sqrt(bd) || 1; x += ((best.x - p.x) / d) * 0.7; y += ((best.y - p.y) / d) * 0.7; }
  else if (cn) { const d = Math.hypot(cx, cy) || 1; x += (cx / d) * 0.35; y += (cy / d) * 0.35; }
  x += Math.cos(g.t * 0.3) * 0.2; y += Math.sin(g.t * 0.23) * 0.2;
  const m = Math.hypot(x, y);
  return m > 1 ? { x: x / m, y: y / m } : { x, y };
}
