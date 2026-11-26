// 새벽 등불지기 — 게임 규칙(화면·입력과 분리된 순수 로직). 브라우저와 node 시험 모두에서 쓴다.
import {
  WEAPONS, PASSIVES, CHARACTERS, STAGES, ENEMIES, META_UPGRADES, BASE_WEAPON_IDS,
  MAX_WEAPONS, MAX_PASSIVES, WEAPON_MAX_LEVEL, PASSIVE_MAX_LEVEL, xpForLevel,
} from './data.js';
import { SpatialGrid, circleHit, rectCircleHit } from './grid.js';

export const ENEMY_CAP = 900;
const MAX_ENEMY_R = 52;
const BASE_MAGNET = 90;
const BASE_SPEED = 150;
const BASE_HP = 100;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 무기 레벨별 수치: 1레벨 base 에 up[0..level-2] 를 더한다
export function weaponStats(id, level) {
  const w = WEAPONS[id];
  const s = { ...w.base };
  for (let i = 0; i < level - 1 && i < w.up.length; i++) {
    for (const [k, v] of Object.entries(w.up[i])) s[k] = (s[k] || 0) + v;
  }
  return s;
}

export function computeStats(g) {
  const s = { might: 1, area: 1, cooldown: 1, duration: 1, magnet: 1, armor: 0, speed: 1, amount: 0, projSpeed: 1, maxHp: 1, growth: 1, greed: 1, regen: 0 };
  const add = (k, v) => { s[k] = (s[k] ?? 0) + v; };
  for (const [k, v] of Object.entries(g.char.bonus || {})) add(k, v);
  for (const up of META_UPGRADES) {
    const lv = g.meta[up.id] || 0;
    if (lv && up.id in s) add(up.id, up.per * lv);
  }
  for (const p of g.passives) {
    const P = PASSIVES[p.id];
    add(P.stat, P.per * p.level);
    if (p.id === 'ricecake') add('regen', 0.3 * p.level);
  }
  s.cooldown = Math.max(0.35, s.cooldown);
  g.stats = s;
  const p = g.player;
  const oldMax = p.maxHp || BASE_HP;
  p.maxHp = Math.round(BASE_HP * s.maxHp);
  if (p.hp != null) p.hp = Math.min(p.maxHp, p.hp + Math.max(0, p.maxHp - oldMax));
  return s;
}

export function createGame(opts = {}) {
  const stage = typeof opts.stage === 'object' ? opts.stage : STAGES.find((s) => s.id === opts.stage) || STAGES[0];
  const char = CHARACTERS.find((c) => c.id === opts.character) || CHARACTERS[0];
  const g = {
    rng: mulberry32(opts.seed ?? 1234),
    t: 0, stage, char, meta: opts.meta || {},
    duration: opts.duration ?? stage.duration,
    view: { w: opts.viewW || 900, h: opts.viewH || 640 },
    over: false, won: false,
    player: { x: 0, y: 0, r: 14, hp: null, maxHp: BASE_HP, facing: { x: 1, y: 0 }, moving: false, inv: 0, level: 1, xp: 0, xpNext: xpForLevel(1), revives: 0 },
    stats: null,
    weapons: [], passives: [],
    enemies: [], projectiles: [], gems: [], pickups: [], zones: [], fx: [], texts: [],
    grid: new SpatialGrid(64, 56, 56, 2048),
    pending: 0, choices: null, rerolls: opts.meta?.reroll || 0,
    kills: 0, coins: 0, damageDone: 0,
    bossSpawned: false, boss: null, bossKilled: false, eliteIdx: 0, spawnAcc: 0,
    events: [], nextId: 1, noSpawn: !!opts.noSpawn,
  };
  computeStats(g);
  g.player.hp = g.player.maxHp;
  g.player.revives = g.meta.revive ? 1 : 0;
  addWeapon(g, char.weapon);
  return g;
}

export function addWeapon(g, id) {
  if (g.weapons.length >= MAX_WEAPONS) return false;
  g.weapons.push({ id, level: 1, timer: 0.3, active: 0, angle: 0, tickT: 0 });
  return true;
}

export function addPassive(g, id) {
  const have = g.passives.find((p) => p.id === id);
  const max = PASSIVES[id].max || PASSIVE_MAX_LEVEL;
  if (have) { if (have.level >= max) return false; have.level++; }
  else { if (g.passives.length >= MAX_PASSIVES) return false; g.passives.push({ id, level: 1 }); }
  computeStats(g);
  return true;
}

// ───────── 레벨업 선택지 ─────────
export function candidateOptions(g) {
  const out = [];
  for (const w of g.weapons) {
    const W = WEAPONS[w.id];
    if (!W.evolved && w.level < WEAPON_MAX_LEVEL) out.push({ type: 'weapon', id: w.id, level: w.level + 1, weight: 3 });
  }
  for (const p of g.passives) {
    if (p.level < (PASSIVES[p.id].max || PASSIVE_MAX_LEVEL)) out.push({ type: 'passive', id: p.id, level: p.level + 1, weight: 2 });
  }
  if (g.weapons.length < MAX_WEAPONS) {
    for (const id of BASE_WEAPON_IDS) {
      if (g.weapons.some((w) => w.id === id || WEAPONS[id].evo?.into === w.id)) continue;
      out.push({ type: 'weapon', id, level: 1, weight: 1.5 });
    }
  }
  if (g.passives.length < MAX_PASSIVES) {
    for (const id of Object.keys(PASSIVES)) {
      if (g.passives.some((p) => p.id === id)) continue;
      out.push({ type: 'passive', id, level: 1, weight: 1 });
    }
  }
  return out;
}

export function rollChoices(g, n = 3) {
  const pool = candidateOptions(g);
  const picked = [];
  while (picked.length < n && pool.length) {
    let total = 0;
    for (const o of pool) total += o.weight;
    let r = g.rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].weight; if (r <= 0) break; }
    picked.push(pool.splice(i, 1)[0]);
  }
  if (!picked.length) {
    picked.push({ type: 'heal', id: 'rice' }, { type: 'coins', id: 'coins' });
  }
  return picked;
}

export function chooseOption(g, index) {
  if (!g.choices) return false;
  const o = g.choices[index];
  if (!o) return false;
  if (o.type === 'weapon') {
    const w = g.weapons.find((x) => x.id === o.id);
    if (w) w.level++; else addWeapon(g, o.id);
  } else if (o.type === 'passive') {
    addPassive(g, o.id);
  } else if (o.type === 'heal') {
    g.player.hp = Math.min(g.player.maxHp, g.player.hp + 30);
  } else if (o.type === 'coins') {
    g.coins += 20;
  }
  g.pending--;
  g.choices = g.pending > 0 ? rollChoices(g) : null;
  return true;
}

export function rerollChoices(g) {
  if (!g.choices || g.rerolls <= 0) return false;
  g.rerolls--;
  g.choices = rollChoices(g);
  return true;
}

export function addXp(g, amount) {
  const p = g.player;
  p.xp += amount * g.stats.growth;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = xpForLevel(p.level);
    g.pending++;
    g.events.push({ type: 'levelup', level: p.level });
  }
  if (g.pending > 0 && !g.choices) g.choices = rollChoices(g);
}

// ───────── 진화 ─────────
export function evolvable(g) {
  return g.weapons.filter((w) => {
    const evo = WEAPONS[w.id].evo;
    return evo && w.level >= WEAPON_MAX_LEVEL && g.passives.some((p) => p.id === evo.passive);
  });
}

// 복주머니(상자) 열기: 진화할 무기가 있으면 진화, 없으면 무기 한 단계, 그것도 없으면 엽전
export function openChest(g) {
  const ev = evolvable(g);
  let result;
  if (ev.length) {
    const w = ev[Math.floor(g.rng() * ev.length)];
    const from = w.id;
    w.id = WEAPONS[from].evo.into;
    w.level = 1;
    w.timer = 0.1;
    w.active = 0;
    result = { type: 'evolve', from, to: w.id };
  } else {
    const up = g.weapons.filter((w) => !WEAPONS[w.id].evolved && w.level < WEAPON_MAX_LEVEL);
    if (up.length) {
      const w = up[Math.floor(g.rng() * up.length)];
      w.level++;
      result = { type: 'upgrade', id: w.id, level: w.level };
    } else {
      g.coins += 30;
      result = { type: 'coins', amount: 30 };
    }
  }
  g.events.push({ type: 'chest', result });
  return result;
}

// ───────── 적 생성 ─────────
export function currentWave(g) {
  const ws = g.stage.waves;
  let w = ws[0];
  for (const x of ws) if (x[0] <= g.t) w = x;
  return w;
}

function spawnRadius(g) {
  return Math.hypot(g.view.w / 2, g.view.h / 2) + 60;
}

export function spawnEnemy(g, type, x, y) {
  if (g.enemies.length >= ENEMY_CAP && !ENEMIES[type].boss && !ENEMIES[type].elite) return null;
  const E = ENEMIES[type];
  if (x == null) {
    const a = g.rng() * Math.PI * 2;
    const R = spawnRadius(g) + g.rng() * 80;
    x = g.player.x + Math.cos(a) * R;
    y = g.player.y + Math.sin(a) * R;
  }
  const timeMul = 1 + (g.t / 60) * 0.15;
  const hpMul = E.boss ? g.stage.hpMul ** 0.5 : g.stage.hpMul * timeMul;
  const e = {
    id: g.nextId++, type, x, y, r: E.r, hp: E.hp * hpMul, maxHp: E.hp * hpMul,
    speed: E.speed * (0.9 + g.rng() * 0.2), dmg: Math.round(E.dmg * (1 + (g.stage.hpMul - 1) * 0.5)),
    xp: E.xp, kx: 0, ky: 0, stun: 0, flash: 0, dead: false, phase: g.rng() * 6.28,
    elite: !!E.elite, boss: !!E.boss, dashT: 0,
  };
  g.enemies.push(e);
  return e;
}

function updateSpawning(g, dt) {
  if (g.noSpawn) return;
  const w = currentWave(g);
  const rate = w[2] * (1 + Math.min(1, g.t / g.duration) * 0.6);
  g.spawnAcc += rate * dt;
  while (g.spawnAcc >= 1) {
    g.spawnAcc -= 1;
    const types = w[1];
    spawnEnemy(g, types[Math.floor(g.rng() * types.length)]);
  }
  const el = g.stage.elites;
  while (g.eliteIdx < el.length && g.t >= el[g.eliteIdx] * (g.duration / g.stage.duration)) {
    spawnEnemy(g, 'elite');
    g.eliteIdx++;
    g.events.push({ type: 'elite' });
  }
  if (!g.bossSpawned && g.t >= g.duration - 60 * (g.duration / g.stage.duration)) {
    g.bossSpawned = true;
    g.boss = spawnEnemy(g, g.stage.boss);
    g.events.push({ type: 'boss', id: g.stage.boss });
  }
}

// ───────── 피해·처치 ─────────
export function damageEnemy(g, e, amount, kx = 0, ky = 0) {
  if (e.dead) return false;
  const dmg = amount * g.stats.might;
  e.hp -= dmg;
  g.damageDone += dmg;
  e.flash = 0.1;
  const kb = e.boss ? 0.1 : e.elite ? 0.4 : 1;
  e.kx += kx * kb;
  e.ky += ky * kb;
  if (g.texts.length < 50 && (dmg >= 15 || g.rng() < 0.35)) {
    g.texts.push({ x: e.x, y: e.y - e.r, v: Math.round(dmg), t: 0.6 });
  }
  if (e.hp <= 0) { killEnemy(g, e); return true; }
  return false;
}

function killEnemy(g, e) {
  e.dead = true;
  g.kills++;
  g.gems.push({ x: e.x, y: e.y, v: e.xp, pull: false, sp: 0 });
  const r = g.rng();
  if (e.boss) {
    g.bossKilled = true;
    g.pickups.push({ kind: 'chest', x: e.x, y: e.y }, { kind: 'coin', x: e.x + 20, y: e.y, v: 50 });
    g.events.push({ type: 'bossdown' });
  } else if (e.elite) {
    g.pickups.push({ kind: 'chest', x: e.x, y: e.y });
  } else if (r < 0.03) g.pickups.push({ kind: 'coin', x: e.x, y: e.y, v: 1 });
  else if (r < 0.036) g.pickups.push({ kind: 'rice', x: e.x, y: e.y });
  else if (r < 0.0375) g.pickups.push({ kind: 'magnet', x: e.x, y: e.y });
  if (g.fx.length < 120) g.fx.push({ type: 'puff', x: e.x, y: e.y, r: e.r, t: 0, life: 0.35 });
}

function hurtPlayer(g, amount) {
  const p = g.player;
  if (p.inv > 0 || g.over) return;
  const d = Math.max(1, amount - g.stats.armor);
  p.hp -= d;
  p.inv = 0.4;
  g.events.push({ type: 'hurt', amount: d });
  if (p.hp <= 0) {
    if (p.revives > 0) {
      p.revives--;
      p.hp = p.maxHp * 0.5;
      p.inv = 2;
      // 둘레 적을 밀어낸다
      for (const e of g.enemies) {
        const dx = e.x - p.x, dy = e.y - p.y, d2 = Math.hypot(dx, dy) || 1;
        if (d2 < 260) { e.kx += (dx / d2) * 600; e.ky += (dy / d2) * 600; }
      }
      g.events.push({ type: 'revive' });
    } else {
      p.hp = 0;
      g.over = true;
      g.won = false;
      g.events.push({ type: 'dead' });
    }
  }
}

// ───────── 무기 ─────────
function nearestEnemies(g, k, range) {
  const p = g.player;
  const best = [];
  const r2 = range * range;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d > r2) continue;
    if (best.length < k) { best.push([d, e]); best.sort((a, b) => a[0] - b[0]); }
    else if (d < best[k - 1][0]) { best[k - 1] = [d, e]; best.sort((a, b) => a[0] - b[0]); }
  }
  return best.map((b) => b[1]);
}

function shoot(g, wid, s, ang, homing = false) {
  const sp = s.speed * g.stats.projSpeed;
  g.projectiles.push({
    wid, x: g.player.x, y: g.player.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
    dmg: s.dmg, pierce: s.pierce, r: s.size * g.stats.area ** 0.5, life: s.life * g.stats.duration ** 0.5,
    homing, turn: s.turn || 0, target: null, hit: [], spd: sp,
  });
}

export function fireWeapon(g, w) {
  const W = WEAPONS[w.id];
  const s = weaponStats(w.id, w.level);
  const st = g.stats;
  const p = g.player;
  const amount = (s.amount || 1) + st.amount;
  const faceAng = Math.atan2(p.facing.y, p.facing.x);
  switch (W.kind) {
    case 'bolt': {
      if (s.ring) {
        const n = amount + 4;
        for (let i = 0; i < n; i++) shoot(g, w.id, s, g.t * 0.7 + (i / n) * Math.PI * 2);
        return true;
      }
      const targets = nearestEnemies(g, amount, 520);
      if (!targets.length) return false;
      for (let i = 0; i < amount; i++) {
        const e = targets[i % targets.length];
        const jitter = i >= targets.length ? (g.rng() - 0.5) * 0.3 : 0;
        shoot(g, w.id, s, Math.atan2(e.y - p.y, e.x - p.x) + jitter);
      }
      return true;
    }
    case 'fan': {
      const full = s.spread >= 6.2;
      // 가까운 적(300px 안)이 있으면 그쪽으로, 없으면 바라보는 쪽으로 뿌린다
      const near = full ? [] : nearestEnemies(g, 1, 300);
      const aim = near.length ? Math.atan2(near[0].y - p.y, near[0].x - p.x) : faceAng;
      for (let i = 0; i < amount; i++) {
        const a = full ? g.t + (i / amount) * Math.PI * 2 : aim + (amount === 1 ? 0 : (i / (amount - 1) - 0.5) * s.spread);
        shoot(g, w.id, s, a);
      }
      return true;
    }
    case 'pulse': {
      const R = s.radius * st.area;
      g.grid.query(p.x, p.y, R + MAX_ENEMY_R, (i) => {
        const e = g.enemies[i];
        if (e.dead || !circleHit(p.x, p.y, R, e.x, e.y, e.r)) return false;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (s.stun) e.stun = Math.max(e.stun, s.stun * (e.boss ? 0.2 : 1));
        damageEnemy(g, e, s.dmg, (dx / d) * s.knock, (dy / d) * s.knock);
        return false;
      });
      g.fx.push({ type: 'ring', x: p.x, y: p.y, r: R, t: 0, life: 0.35, color: w.id === 'greatbell' ? '#ffe9a8' : '#a8c8ff' });
      return true;
    }
    case 'orbit': {
      w.active = s.dur * st.duration;
      return true;
    }
    case 'lob': {
      for (let i = 0; i < amount; i++) {
        let tx, ty;
        const near = nearestEnemies(g, 6, 380);
        if (near.length) { const e = near[Math.floor(g.rng() * near.length)]; tx = e.x; ty = e.y; }
        else { const a = g.rng() * 6.28; tx = p.x + Math.cos(a) * 140; ty = p.y + Math.sin(a) * 140; }
        g.zones.push({ wid: w.id, x: tx, y: ty, sx: p.x, sy: p.y, r: s.radius * st.area, dmg: s.dmg, tick: s.tick, tickT: 0, delay: 0.45, t: 0, dur: s.dur * st.duration, follow: s.follow || 0 });
      }
      return true;
    }
    case 'seeker': {
      for (let i = 0; i < amount; i++) shoot(g, w.id, s, faceAng + (i / amount) * Math.PI * 2, true);
      return true;
    }
    case 'sweep': {
      const len = s.length * st.area, wd = s.width * st.area;
      let healed = 0;
      const near = nearestEnemies(g, 1, len + 60);
      const aim = near.length ? Math.atan2(near[0].y - p.y, near[0].x - p.x) : faceAng;
      for (let i = 0; i < amount; i++) {
        const a = aim + (i % 2 ? Math.PI : 0) + (i >= 2 ? Math.PI / 2 : 0);
        const cx = p.x + Math.cos(a) * len / 2, cy = p.y + Math.sin(a) * len / 2;
        g.grid.query(cx, cy, len / 2 + MAX_ENEMY_R, (j) => {
          const e = g.enemies[j];
          if (e.dead || !rectCircleHit(cx, cy, a, len, wd, e.x, e.y, e.r)) return false;
          damageEnemy(g, e, s.dmg, Math.cos(a) * 120, Math.sin(a) * 120);
          if (s.lifesteal && healed < 6) { healed++; p.hp = Math.min(p.maxHp, p.hp + s.lifesteal); }
          return false;
        });
        g.fx.push({ type: 'sweep', x: cx, y: cy, ang: a, len, w: wd, t: 0, life: 0.2, color: w.id === 'fireporker' ? '#ff9a3c' : '#e8d8b8' });
      }
      return true;
    }
    case 'strike': {
      const hw = g.view.w / 2, hh = g.view.h / 2;
      const inView = g.enemies.filter((e) => !e.dead && Math.abs(e.x - p.x) < hw && Math.abs(e.y - p.y) < hh);
      if (!inView.length) return false;
      const R = s.radius * st.area;
      for (let i = 0; i < amount; i++) {
        const t = inView[Math.floor(g.rng() * inView.length)];
        const x = t.x, y = t.y;
        g.grid.query(x, y, R + MAX_ENEMY_R, (j) => {
          const e = g.enemies[j];
          if (!e.dead && circleHit(x, y, R, e.x, e.y, e.r)) damageEnemy(g, e, s.dmg);
          return false;
        });
        g.fx.push({ type: 'bolt', x, y, r: R, t: 0, life: 0.25 });
      }
      return true;
    }
  }
  return false;
}

function updateWeapons(g, dt) {
  const st = g.stats;
  const p = g.player;
  for (const w of g.weapons) {
    const W = WEAPONS[w.id];
    const s = weaponStats(w.id, w.level);
    if (W.kind === 'orbit') {
      const n = (s.amount || 1) + st.amount;
      w.orbs = n;
      if (w.active > 0) {
        w.active -= dt;
        w.angle += s.spin * dt;
        w.tickT -= dt;
        if (w.tickT <= 0) {
          w.tickT = 0.2;
          const R = s.radius * st.area, sz = s.size * st.area;
          for (let i = 0; i < n; i++) {
            const a = w.angle + (i / n) * Math.PI * 2;
            const ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R;
            g.grid.query(ox, oy, sz + MAX_ENEMY_R, (j) => {
              const e = g.enemies[j];
              if (!e.dead && circleHit(ox, oy, sz, e.x, e.y, e.r)) damageEnemy(g, e, s.dmg, Math.cos(a) * 80, Math.sin(a) * 80);
              return false;
            });
          }
        }
        continue;
      }
    }
    w.timer -= dt;
    if (w.timer <= 0) {
      const fired = fireWeapon(g, w);
      w.timer = fired ? s.cd * st.cooldown : 0.15;
    }
  }
}

// ───────── 한 걸음 ─────────
export function update(g, dt, input = { x: 0, y: 0 }) {
  if (g.over || g.choices) return;
  dt = Math.min(dt, 0.05);
  g.t += dt;
  const p = g.player;
  const st = g.stats;

  // 플레이어 이동
  let mx = input.x || 0, my = input.y || 0;
  const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  p.moving = m > 0.1;
  if (p.moving) { const k = Math.hypot(mx, my); p.facing.x = mx / k; p.facing.y = my / k; }
  const spd = BASE_SPEED * st.speed;
  p.x += mx * spd * dt;
  p.y += my * spd * dt;
  if (p.inv > 0) p.inv -= dt;
  if (st.regen > 0) p.hp = Math.min(p.maxHp, p.hp + st.regen * dt);

  updateSpawning(g, dt);

  // 격자 채우기 → 적 이동·밀어내기
  const E = g.enemies;
  g.grid.build(E, E.length, p.x, p.y);
  const far = spawnRadius(g) * 1.7;
  for (let i = 0; i < E.length; i++) {
    const e = E[i];
    if (e.dead) continue;
    if (e.flash > 0) e.flash -= dt;
    let dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > far && !e.boss) {
      // 너무 멀어진 적은 플레이어 앞쪽 바깥으로 옮긴다(놓친 적이 무한히 쌓이지 않게)
      const a = Math.atan2(p.facing.y, p.facing.x) + (g.rng() - 0.5) * 1.6;
      e.x = p.x + Math.cos(a) * spawnRadius(g);
      e.y = p.y + Math.sin(a) * spawnRadius(g);
      continue;
    }
    let vx = 0, vy = 0;
    if (e.stun > 0) e.stun -= dt;
    else {
      let sp = e.speed;
      const T = ENEMIES[e.type];
      if (T.hop) sp *= 0.4 + Math.max(0, Math.sin(g.t * 5 + e.phase)) * 1.4;
      if (e.boss) {
        e.dashT -= dt;
        if (e.dashT <= 0) e.dashT = 4;
        if (e.dashT < 0.7) sp *= 3.2;
      }
      vx = (dx / d) * sp;
      vy = (dy / d) * sp;
      if (T.wobble) { const wv = Math.sin(g.t * 4 + e.phase) * sp * 0.6; vx += (-dy / d) * wv; vy += (dx / d) * wv; }
    }
    // 이웃과 겹치지 않게 살짝 밀기(가까운 6마리까지)
    let pushes = 0;
    const ex = e.x, ey = e.y, er = e.r;
    g.grid.query(ex, ey, er * 2, (j) => {
      if (j === i) return false;
      const o = E[j];
      const ox = ex - o.x, oy = ey - o.y;
      const rr = er + o.r;
      const d2 = ox * ox + oy * oy;
      if (d2 < rr * rr && d2 > 0.0001) {
        const dd = Math.sqrt(d2);
        const f = ((rr - dd) / rr) * 90 * (o.boss ? 3 : 1);
        vx += (ox / dd) * f;
        vy += (oy / dd) * f;
        if (++pushes >= 6) return true;
      }
      return false;
    });
    e.x += (vx + e.kx) * dt;
    e.y += (vy + e.ky) * dt;
    const decay = Math.pow(0.002, dt);
    e.kx *= decay;
    e.ky *= decay;
  }

  // 플레이어와 부딪침
  g.grid.query(p.x, p.y, p.r + MAX_ENEMY_R, (i) => {
    const e = E[i];
    if (!e.dead && circleHit(p.x, p.y, p.r, e.x, e.y, e.r * 0.85)) { hurtPlayer(g, e.dmg); return p.inv > 0; }
    return false;
  });

  updateWeapons(g, dt);
  updateProjectiles(g, dt);
  updateZones(g, dt);

  // 죽은 적 걷어내기(자리 바꿔 빼기)
  let k = 0;
  for (let i = 0; i < E.length; i++) if (!E[i].dead) E[k++] = E[i];
  E.length = k;
  if (g.boss && g.boss.dead) g.boss = null;

  updateGems(g, dt);
  updatePickups(g, dt);

  for (let i = g.fx.length - 1; i >= 0; i--) { const f = g.fx[i]; f.t += dt; if (f.t >= f.life) g.fx.splice(i, 1); }
  for (let i = g.texts.length - 1; i >= 0; i--) { const t = g.texts[i]; t.t -= dt; t.y -= 30 * dt; if (t.t <= 0) g.texts.splice(i, 1); }

  if (!g.over && g.t >= g.duration) {
    g.over = true;
    g.won = true;
    g.events.push({ type: 'dawn' });
  }
}

function updateProjectiles(g, dt) {
  const P = g.projectiles;
  const E = g.enemies;
  for (let i = P.length - 1; i >= 0; i--) {
    const pr = P[i];
    pr.life -= dt;
    if (pr.homing) {
      if (!pr.target || pr.target.dead) {
        let best = null, bd = 1e12;
        g.grid.query(pr.x, pr.y, 320, (j) => {
          const e = E[j];
          if (e.dead || pr.hit.includes(e.id)) return false;
          const d = (e.x - pr.x) ** 2 + (e.y - pr.y) ** 2;
          if (d < bd) { bd = d; best = e; }
          return false;
        });
        pr.target = best;
      }
      if (pr.target) {
        const want = Math.atan2(pr.target.y - pr.y, pr.target.x - pr.x);
        let cur = Math.atan2(pr.vy, pr.vx);
        let diff = want - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cur += Math.max(-pr.turn * dt, Math.min(pr.turn * dt, diff));
        pr.vx = Math.cos(cur) * pr.spd;
        pr.vy = Math.sin(cur) * pr.spd;
      }
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.life > 0) {
      g.grid.query(pr.x, pr.y, pr.r + MAX_ENEMY_R, (j) => {
        const e = E[j];
        if (e.dead || pr.hit.includes(e.id) || !circleHit(pr.x, pr.y, pr.r, e.x, e.y, e.r)) return false;
        pr.hit.push(e.id);
        const sp = pr.spd || 1;
        damageEnemy(g, e, pr.dmg, (pr.vx / sp) * 60, (pr.vy / sp) * 60);
        pr.pierce--;
        if (pr.homing) pr.target = null;
        return pr.pierce <= 0;
      });
    }
    if (pr.life <= 0 || pr.pierce <= 0) { P[i] = P[P.length - 1]; P.pop(); }
  }
}

function updateZones(g, dt) {
  const Z = g.zones;
  const E = g.enemies;
  const p = g.player;
  for (let i = Z.length - 1; i >= 0; i--) {
    const z = Z[i];
    if (z.delay > 0) { z.delay -= dt; continue; }
    z.t += dt;
    if (z.follow) { z.x += (p.x - z.x) * Math.min(1, dt * 0.8); z.y += (p.y - z.y) * Math.min(1, dt * 0.8); }
    z.tickT -= dt;
    if (z.tickT <= 0) {
      z.tickT = z.tick;
      g.grid.query(z.x, z.y, z.r + MAX_ENEMY_R, (j) => {
        const e = E[j];
        if (!e.dead && circleHit(z.x, z.y, z.r, e.x, e.y, e.r)) damageEnemy(g, e, z.dmg);
        return false;
      });
    }
    if (z.t >= z.dur) { Z[i] = Z[Z.length - 1]; Z.pop(); }
  }
}

function updateGems(g, dt) {
  const p = g.player;
  const G = g.gems;
  const mag = BASE_MAGNET * g.stats.magnet;
  const mag2 = mag * mag;
  // 너무 많으면 멀리 있는 별가루를 하나로 모은다
  if (G.length > 350) {
    let sum = 0, keep = [];
    for (const gem of G) {
      if (!gem.pull && (gem.x - p.x) ** 2 + (gem.y - p.y) ** 2 > 600 * 600) sum += gem.v; else keep.push(gem);
    }
    if (sum > 0) { keep.push({ x: p.x + 300, y: p.y, v: sum, pull: false, sp: 0 }); g.gems = keep; }
  }
  const GG = g.gems;
  for (let i = GG.length - 1; i >= 0; i--) {
    const gem = GG[i];
    const dx = p.x - gem.x, dy = p.y - gem.y;
    const d2 = dx * dx + dy * dy;
    if (!gem.pull && d2 < mag2) gem.pull = true;
    if (gem.pull) {
      gem.sp = Math.min(700, gem.sp + 900 * dt);
      const d = Math.sqrt(d2) || 1;
      const step = Math.min(d, gem.sp * dt);
      gem.x += (dx / d) * step;
      gem.y += (dy / d) * step;
      if (d < p.r + 6) {
        GG[i] = GG[GG.length - 1];
        GG.pop();
        addXp(g, gem.v);
      }
    }
  }
}

function updatePickups(g, dt) {
  const p = g.player;
  const U = g.pickups;
  for (let i = U.length - 1; i >= 0; i--) {
    const u = U[i];
    const d = Math.hypot(p.x - u.x, p.y - u.y);
    if (d < BASE_MAGNET * g.stats.magnet * 0.6 && u.kind !== 'chest') {
      u.x += ((p.x - u.x) / (d || 1)) * Math.min(d, 400 * dt);
      u.y += ((p.y - u.y) / (d || 1)) * Math.min(d, 400 * dt);
    }
    if (d < p.r + 14) {
      U.splice(i, 1);
      if (u.kind === 'coin') g.coins += u.v;
      else if (u.kind === 'rice') { p.hp = Math.min(p.maxHp, p.hp + 30); g.events.push({ type: 'heal' }); }
      else if (u.kind === 'magnet') { for (const gem of g.gems) gem.pull = true; g.events.push({ type: 'magnet' }); }
      else if (u.kind === 'chest') openChest(g);
    }
  }
}

// 판이 끝났을 때 받을 엽전(처치·생존 시간·보스·깸 보너스)
export function runReward(g) {
  const base = g.coins + Math.floor(g.kills / 25) + Math.floor(g.t / 30) + (g.bossKilled ? 40 : 0) + (g.won ? 60 : 0);
  return Math.round(base * g.stats.greed);
}
