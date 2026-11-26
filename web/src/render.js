// 그리기: 모든 그림은 이 파일에서 도형으로 직접 그린다(외부 그림 파일 없음).
import { ENEMIES, WEAPONS } from './data.js';
import { weaponStats } from './logic.js';

const sprites = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// 그을음 무리: 몸 모양만 달리한 오리지널 그림자 생물. 미리 그려 두고 drawImage 로 찍는다
function enemySprite(type, flash) {
  const key = type + (flash ? '!' : '');
  if (sprites.has(key)) return sprites.get(key);
  const E = ENEMIES[type];
  const pad = 6, R = E.r, S = (R + pad) * 2;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  x.translate(S / 2, S / 2);
  const body = flash ? '#ffffff' : E.color;
  x.fillStyle = body;
  x.strokeStyle = flash ? '#fff' : 'rgba(255,255,255,0.18)';
  x.lineWidth = 1.5;
  x.beginPath();
  if (type === 'leafbat' || type === 'moth') {
    x.ellipse(0, 0, R * 0.55, R * 0.7, 0, 0, Math.PI * 2);
    x.moveTo(-R * 0.4, -R * 0.2); x.quadraticCurveTo(-R * 1.2, -R, -R, R * 0.3); x.closePath();
    x.moveTo(R * 0.4, -R * 0.2); x.quadraticCurveTo(R * 1.2, -R, R, R * 0.3); x.closePath();
  } else if (type === 'scare' || type === 'gargoyl') {
    x.moveTo(0, -R); x.lineTo(R, -R * 0.2); x.lineTo(R * 0.7, R); x.lineTo(-R * 0.7, R); x.lineTo(-R, -R * 0.2); x.closePath();
  } else if (type === 'lantern') {
    x.roundRect(-R * 0.75, -R, R * 1.5, R * 2, R * 0.5);
  } else if (type === 'frog') {
    x.ellipse(0, R * 0.15, R, R * 0.75, 0, 0, Math.PI * 2);
  } else if (E.boss) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, rr = i % 2 ? R : R * 0.78;
      x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    x.closePath();
  } else {
    // 방울 모양: 아래가 너울지는 그을음
    x.arc(0, -R * 0.1, R * 0.9, Math.PI, 0);
    for (let i = 0; i <= 4; i++) x.lineTo(R * 0.9 - (i * R * 1.8) / 4, R * (i % 2 ? 0.65 : 0.95));
    x.closePath();
  }
  x.fill();
  x.stroke();
  // 눈
  x.fillStyle = flash ? '#000' : E.eye;
  const ey = E.boss ? -R * 0.15 : -R * 0.15, es = Math.max(2, R * 0.16);
  x.beginPath();
  x.arc(-R * 0.32, ey, es, 0, Math.PI * 2);
  x.arc(R * 0.32, ey, es, 0, Math.PI * 2);
  x.fill();
  if (E.elite || E.boss) {
    x.strokeStyle = E.eye;
    x.lineWidth = 2;
    x.beginPath();
    x.arc(0, 0, R + 2, 0, Math.PI * 2);
    x.stroke();
  }
  sprites.set(key, c);
  return c;
}

const patterns = new Map();
function groundPattern(ctx, stage) {
  if (patterns.has(stage.id)) return patterns.get(stage.id);
  const T = 128, c = makeCanvas(T, T), x = c.getContext('2d');
  x.fillStyle = stage.bg.ground; x.fillRect(0, 0, T, T);
  let s = stage.id.length * 97;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.fillStyle = stage.bg.dot;
  for (let i = 0; i < 26; i++) { x.beginPath(); x.arc(rnd() * T, rnd() * T, 1 + rnd() * 2, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = stage.bg.line; x.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    const px = rnd() * T, py = rnd() * T;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 3, py - 8, px + (rnd() - 0.5) * 6, py - 14); x.stroke();
  }
  const pat = ctx.createPattern(c, 'repeat');
  patterns.set(stage.id, pat);
  return pat;
}

const GEM_COLORS = ['#7cc8ff', '#7dffa8', '#ff7d9a'];

function drawPlayer(ctx, g) {
  const p = g.player, c = g.char;
  const blink = p.inv > 0 && Math.floor(g.t * 20) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.45;
  const bob = p.moving ? Math.sin(g.t * 14) * 2 : 0;
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 14, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
  // 몸(두루마기)
  ctx.fillStyle = c.color;
  ctx.beginPath(); ctx.moveTo(-11, 12); ctx.lineTo(-7, -4); ctx.lineTo(7, -4); ctx.lineTo(11, 12); ctx.closePath(); ctx.fill();
  // 얼굴
  ctx.fillStyle = '#ffe2c2';
  ctx.beginPath(); ctx.arc(0, -10, 8, 0, Math.PI * 2); ctx.fill();
  // 머리(캐릭터마다 다른 머리 모양)
  ctx.fillStyle = '#2a1f1a';
  ctx.beginPath();
  if (c.id === 'sodam') { ctx.arc(0, -13, 8, Math.PI, 0); ctx.arc(8, -18, 3, 0, Math.PI * 2); }
  else if (c.id === 'haesol') { ctx.moveTo(-10, -12); ctx.lineTo(0, -24); ctx.lineTo(10, -12); }
  else if (c.id === 'mir') { ctx.arc(0, -13, 8.5, Math.PI, 0); ctx.rect(-9, -14, 18, 3); }
  else if (c.id === 'darae') { ctx.arc(0, -13, 8, Math.PI, 0); ctx.moveTo(-8, -12); ctx.lineTo(-12, 0); ctx.lineTo(-6, -8); }
  else { ctx.rect(-9, -20, 18, 6); }
  ctx.fill();
  // 눈 — 바라보는 쪽
  ctx.fillStyle = '#1a1a1a';
  const fx = p.facing.x * 2.5;
  ctx.fillRect(-3.5 + fx, -11, 2, 2.5); ctx.fillRect(1.5 + fx, -11, 2, 2.5);
  // 손에 든 등불
  const lx = p.facing.x >= 0 ? 12 : -12;
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(lx * 0.6, 0); ctx.lineTo(lx, 2); ctx.stroke();
  ctx.fillStyle = '#ffcf5a';
  ctx.beginPath(); ctx.ellipse(lx, 7, 4, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function render(ctx, g, W, H, opts = {}) {
  const p = g.player;
  let camX = p.x - W / 2, camY = p.y - H / 2;
  if (opts.shake > 0) { camX += (Math.random() - 0.5) * opts.shake; camY += (Math.random() - 0.5) * opts.shake; }

  // 바닥(무늬 반복)
  ctx.save();
  ctx.fillStyle = groundPattern(ctx, g.stage);
  ctx.translate(-camX, -camY);
  ctx.fillRect(camX, camY, W, H);

  const inView = (x, y, r) => x + r > camX && x - r < camX + W && y + r > camY && y - r < camY + H;

  // 불씨 자리
  for (const z of g.zones) {
    if (z.delay > 0) {
      const k = 1 - z.delay / 0.45;
      const x = z.sx + (z.x - z.sx) * k, y = z.sy + (z.y - z.sy) * k - Math.sin(k * Math.PI) * 60;
      ctx.fillStyle = '#c4713a'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    if (!inView(z.x, z.y, z.r)) continue;
    const a = Math.min(1, (z.dur - z.t) * 2);
    ctx.globalAlpha = 0.35 * a;
    ctx.fillStyle = z.wid === 'goblinfire' ? '#7f5cff' : '#ff6a2a';
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.8 * a;
    ctx.fillStyle = '#ffd27a';
    for (let i = 0; i < 5; i++) {
      const aa = g.t * 3 + i * 1.3, rr = z.r * (0.3 + 0.5 * ((i * 37) % 10) / 10);
      ctx.fillRect(z.x + Math.cos(aa) * rr - 1.5, z.y + Math.sin(aa * 1.3) * rr - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  // 별가루
  for (const gem of g.gems) {
    if (!inView(gem.x, gem.y, 8)) continue;
    const tier = gem.v >= 25 ? 2 : gem.v >= 5 ? 1 : 0;
    const s = 3 + tier * 1.5;
    ctx.fillStyle = GEM_COLORS[tier];
    ctx.beginPath();
    ctx.moveTo(gem.x, gem.y - s * 1.4); ctx.lineTo(gem.x + s, gem.y); ctx.lineTo(gem.x, gem.y + s * 1.4); ctx.lineTo(gem.x - s, gem.y);
    ctx.fill();
  }
  // 줍는 것들
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const u of g.pickups) {
    if (!inView(u.x, u.y, 20)) continue;
    if (u.kind === 'coin') { ctx.fillStyle = '#e8b84a'; ctx.beginPath(); ctx.arc(u.x, u.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#7a5a1a'; ctx.fillRect(u.x - 2, u.y - 2, 4, 4); }
    else if (u.kind === 'chest') {
      const b = Math.sin(g.t * 4) * 2;
      ctx.fillStyle = '#c8384a'; ctx.beginPath(); ctx.ellipse(u.x, u.y + 2 + b, 12, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f6c453'; ctx.fillRect(u.x - 10, u.y - 8 + b, 20, 4);
    }
    else if (u.kind === 'rice') { ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.moveTo(u.x, u.y - 9); ctx.lineTo(u.x + 9, u.y + 7); ctx.lineTo(u.x - 9, u.y + 7); ctx.fill(); ctx.fillStyle = '#20302a'; ctx.fillRect(u.x - 6, u.y + 2, 12, 5); }
    else if (u.kind === 'magnet') { ctx.fillStyle = '#e8e2c8'; ctx.fillRect(u.x - 6, u.y - 9, 12, 18); ctx.fillStyle = '#c33'; ctx.fillRect(u.x - 3, u.y - 6, 6, 12); }
  }

  // 적
  for (const e of g.enemies) {
    if (!inView(e.x, e.y, e.r + 6)) continue;
    const spr = enemySprite(e.type, e.flash > 0);
    ctx.drawImage(spr, e.x - spr.width / 2, e.y - spr.height / 2);
  }

  // 투사체
  for (const pr of g.projectiles) {
    if (!inView(pr.x, pr.y, pr.r)) continue;
    const id = pr.wid;
    if (id === 'pine' || id === 'gale') {
      ctx.strokeStyle = id === 'gale' ? '#b8ffcf' : '#6fcf6f'; ctx.lineWidth = 2.5;
      const sp = pr.spd || 1;
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x - (pr.vx / sp) * pr.r * 2.4, pr.y - (pr.vy / sp) * pr.r * 2.4); ctx.stroke();
    } else {
      ctx.fillStyle = id === 'firefly' || id === 'galaxy' ? '#d8ff7a' : id === 'salt' ? '#f2f2f2' : id === 'halo' ? '#fff1a8' : '#ffd166';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 종이연(궤도)
  for (const w of g.weapons) {
    if (WEAPONS[w.id].kind !== 'orbit' || !(w.active > 0)) continue;
    const s = weaponStats(w.id, w.level), R = s.radius * g.stats.area, sz = s.size * g.stats.area;
    for (let i = 0; i < w.orbs; i++) {
      const a = w.angle + (i / w.orbs) * Math.PI * 2;
      const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 4);
      ctx.fillStyle = w.id === 'dragonkite' ? '#ff6b4a' : '#ffe3f0';
      ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * 0.7, 0); ctx.lineTo(0, sz); ctx.lineTo(-sz * 0.7, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c0395a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(0, sz); ctx.moveTo(-sz * 0.7, 0); ctx.lineTo(sz * 0.7, 0); ctx.stroke();
      ctx.restore();
    }
  }

  // 효과
  for (const f of g.fx) {
    const k = f.t / f.life;
    if (f.type === 'ring') {
      ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * k), 0, Math.PI * 2); ctx.stroke();
    } else if (f.type === 'sweep') {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang); ctx.globalAlpha = 0.6 * (1 - k);
      ctx.fillStyle = f.color; ctx.fillRect(-f.len / 2, -f.w / 2, f.len, f.w); ctx.restore();
    } else if (f.type === 'bolt') {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#e6f0ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(f.x + 6, f.y - 160); ctx.lineTo(f.x - 8, f.y - 90); ctx.lineTo(f.x + 6, f.y - 50); ctx.lineTo(f.x, f.y); ctx.stroke();
      ctx.fillStyle = 'rgba(190,210,255,0.5)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill();
    } else if (f.type === 'puff') {
      ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = '#9a90b8';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + k), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawPlayer(ctx, g);

  // 피해 숫자
  ctx.font = 'bold 14px sans-serif';
  for (const t of g.texts) {
    ctx.globalAlpha = Math.min(1, t.t * 3);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(t.v), t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 밤 어둠: 등불 둘레만 밝다
  const dawnK = Math.max(0, (g.t - g.duration * 0.85) / (g.duration * 0.15));
  const grad = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, 'rgba(8,5,20,0)');
  grad.addColorStop(1, `rgba(8,5,20,${0.6 * (1 - dawnK)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  if (dawnK > 0) { ctx.fillStyle = `rgba(255,170,120,${0.12 * dawnK})`; ctx.fillRect(0, 0, W, H); }

  // 체력 막대(플레이어 아래)
  const hpW = 36;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - hpW / 2, H / 2 + 20, hpW, 5);
  ctx.fillStyle = '#ff5a6a'; ctx.fillRect(W / 2 - hpW / 2, H / 2 + 20, hpW * Math.max(0, p.hp / p.maxHp), 5);

  drawOffscreenArrow(ctx, g, W, H, camX, camY);
}

// 화면 밖 보스·복주머니 방향 표시
function drawOffscreenArrow(ctx, g, W, H, camX, camY) {
  const marks = [];
  if (g.boss && !g.boss.dead) marks.push([g.boss.x, g.boss.y, '#ff3355']);
  for (const u of g.pickups) if (u.kind === 'chest') marks.push([u.x, u.y, '#f6c453']);
  for (const [x, y, col] of marks) {
    const sx = x - camX, sy = y - camY;
    if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
    const a = Math.atan2(sy - H / 2, sx - W / 2);
    const ax = Math.max(24, Math.min(W - 24, W / 2 + Math.cos(a) * W)), ay = Math.max(80, Math.min(H - 24, H / 2 + Math.sin(a) * H));
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
